import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Temporary placeholder for routes built in upcoming turns
 *  (Meetings list, Schedule, AI Intelligence, Board, Analytics, Notifications,
 *   and the live MeetingRoom with WebRTC). */
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-ai-500/15 text-ai-400">
          <Construction className="size-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-text-hi">{title}</h1>
        <p className="max-w-sm text-sm text-text-mid">
          This screen is part of the next build slice. The auth flow, app shell,
          and dashboard are fully wired to the backend.
        </p>
      </Card>
    </div>
  );
}
