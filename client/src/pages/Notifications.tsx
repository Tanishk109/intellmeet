import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Calendar,
  AtSign,
  CheckSquare,
  Info,
  CheckCheck,
} from "lucide-react";
import { Card, Spinner, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { miscApi } from "@/api";
import { apiErrorMessage } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types";

const meta: Record<NotificationType, { icon: typeof Bell; tone: string }> = {
  meeting: { icon: Calendar, tone: "text-signal-400 bg-signal-500/15" },
  mention: { icon: AtSign, tone: "text-ai-400 bg-ai-500/15" },
  action: { icon: CheckSquare, tone: "text-signal-400 bg-signal-500/15" },
  system: { icon: Info, tone: "text-text-mid bg-ink-700" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Notifications() {
  const qc = useQueryClient();
  const push = useToast((s) => s.push);

  const { data: items, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: miscApi.notifications,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => miscApi.markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<AppNotification[]>(["notifications"]);
      qc.setQueryData<AppNotification[]>(["notifications"], (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
      push(apiErrorMessage(err), "error");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => miscApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      push("All marked read", "success");
    },
  });

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative grid size-10 place-items-center rounded-xl bg-signal-500/15 text-signal-400">
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-danger-500 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-hi">Notifications</h1>
            <p className="text-sm text-text-mid">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center">
          <Spinner className="size-6 text-signal-400" />
        </div>
      ) : !items || items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-ink-700 text-text-lo">
            <Bell className="size-6" />
          </div>
          <p className="text-text-mid">No notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const { icon: Icon, tone } = meta[n.type];
            return (
              <Card
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors",
                  !n.read && "border-signal-500/30 bg-signal-500/[0.04]"
                )}
              >
                <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}>
                  <Icon className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-text-hi">{n.title}</h3>
                    {!n.read && <Badge tone="signal">New</Badge>}
                  </div>
                  {n.message && <p className="mt-0.5 text-sm text-text-mid">{n.message}</p>}
                  <p className="mt-1 text-xs text-text-lo">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="shrink-0 text-xs text-signal-400 hover:underline"
                  >
                    Mark read
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
