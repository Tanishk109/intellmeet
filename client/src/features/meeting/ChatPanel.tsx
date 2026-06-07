import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import type { AppSocket } from "@/lib/socket";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { meetingApi } from "@/api";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  senderName: string;
  text: string;
  createdAt: string;
  mine: boolean;
}

interface ChatPanelProps {
  socket: AppSocket | null;
  code: string;
  myName: string;
}

const TYPING_TIMEOUT = 1500;

export function ChatPanel({ socket, code, myName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  // Load persisted history so people who join late see prior messages.
  const { data: history } = useQuery({
    queryKey: ["messages", code],
    queryFn: () => meetingApi.messages(code),
    enabled: !!code,
  });

  useEffect(() => {
    if (!history) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fromHistory = history
        .filter((m) => !seen.has(m.id))
        .map((m) => ({
          id: m.id,
          senderName: m.senderName,
          text: m.text,
          createdAt: m.createdAt,
          mine: m.senderName === myName,
        }));
      // History is chronological; show it before any live messages already in.
      return [...fromHistory, ...prev];
    });
  }, [history, myName]);

  // Subscribe to inbound chat + typing events.
  useEffect(() => {
    if (!socket) return;

    const onMessage = (m: {
      id: string;
      senderName: string;
      text: string;
      createdAt: string;
    }) => {
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev; // dedupe
        return [...prev, { ...m, mine: m.senderName === myName }];
      });
    };

    const onTyping = ({ user }: { user: { name: string } }) => {
      setTypingUser(user.name);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(null), TYPING_TIMEOUT + 500);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
    };
  }, [socket, myName]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typingUser]);

  const onDraftChange = (value: string) => {
    setDraft(value);
    // Throttle typing events to at most one per TYPING_TIMEOUT.
    const now = Date.now();
    if (socket && now - lastTypingSent.current > TYPING_TIMEOUT) {
      socket.emit("chat:typing", { code });
      lastTypingSent.current = now;
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !socket) return;
    socket.emit("chat:message", { code, text });
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-text-hi">In-meeting chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-xs text-text-lo">
            No messages yet. Say hello 👋
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col", m.mine && "items-end")}>
              {!m.mine && (
                <span className="mb-0.5 px-1 text-xs text-text-lo">{m.senderName}</span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                  m.mine
                    ? "rounded-br-sm bg-signal-500 text-ink-950"
                    : "rounded-bl-sm bg-ink-700 text-text-hi"
                )}
              >
                {m.text}
              </div>
            </div>
          ))
        )}

        {typingUser && (
          <div className="flex items-center gap-1.5 px-1 text-xs text-text-lo">
            <span className="flex gap-0.5">
              <span className="size-1.5 animate-bounce rounded-full bg-text-lo [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-text-lo [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-text-lo" />
            </span>
            {typingUser} is typing…
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Message…"
          aria-label="Chat message"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
