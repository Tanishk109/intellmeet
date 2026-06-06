import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSocket } from "@/lib/socket";

// Minimal typings for the (non-standard) Web Speech API.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export interface Caption {
  name: string;
  text: string;
  at: number;
}

/**
 * Live captions: transcribes the local user's speech via the browser Speech API
 * and broadcasts finalized lines over `captions:update`. Also collects captions
 * coming from other participants. Degrades gracefully if the API is missing.
 */
export function useCaptions(socket: AppSocket | null, code: string, myName: string) {
  const [supported] = useState(() => getRecognition() !== null);
  const [enabled, setEnabled] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantOnRef = useRef(false);

  const pushCaption = useCallback((c: Caption) => {
    setCaptions((prev) => [...prev.slice(-30), c]);
  }, []);

  // Receive captions from remote participants.
  useEffect(() => {
    if (!socket) return;
    const onCaption = ({ caption, user }: { caption: string; user: { name: string } }) =>
      pushCaption({ name: user.name, text: caption, at: Date.now() });
    socket.on("captions:update", onCaption);
    return () => {
      socket.off("captions:update", onCaption);
    };
  }, [socket, pushCaption]);

  // Start/stop local recognition.
  useEffect(() => {
    if (!enabled || !supported) return;
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    wantOnRef.current = true;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (!text) continue;
          pushCaption({ name: myName, text, at: Date.now() });
          socket?.emit("captions:update", { code, caption: text });
        }
      }
    };
    // Chrome stops recognition periodically; restart while still enabled.
    rec.onend = () => {
      if (wantOnRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.onerror = () => {};

    try {
      rec.start();
    } catch {
      /* ignore */
    }

    return () => {
      wantOnRef.current = false;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, supported, socket, code, myName, pushCaption]);

  return {
    supported,
    enabled,
    captions,
    toggle: () => setEnabled((v) => !v),
  };
}
