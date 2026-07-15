import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  PlayCircle,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Spinner } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { meetingApi } from "@/api";
import { formatWhen } from "@/lib/meetings";
import { useAuth } from "@/stores/auth";
import { useToast } from "@/components/ui/Toast";

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Recordings() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const push = useToast((s) => s.push);
  const [query, setQuery] = useState("");

  const { data: recordings, isLoading } = useQuery({
    queryKey: ["recordings"],
    queryFn: meetingApi.recordings,
  });

  const filteredRecordings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (recordings ?? [])
      .filter(
        ({ meeting, transcript }) =>
          !q ||
          meeting.title.toLowerCase().includes(q) ||
          meeting.code.toLowerCase().includes(q) ||
          meeting.type.toLowerCase().includes(q) ||
          transcript.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aTime = new Date(a.meeting.endedAt ?? a.meeting.createdAt).getTime();
        const bTime = new Date(b.meeting.endedAt ?? b.meeting.createdAt).getTime();
        return bTime - aTime;
      });
  }, [recordings, query]);

  const copyLink = (url: string) => {
    void navigator.clipboard?.writeText(url);
    push("Recording link copied", "success");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-signal-500/15 text-signal-400">
            <Film className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-hi">Recordings</h1>
            <p className="text-sm text-text-mid">
              Meeting recordings from calls you hosted or were invited to.
            </p>
          </div>
        </div>
        <Link to="/app/meetings">
          <Button variant="outline">
            <Video className="size-4" /> All meetings
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-lo" />
        <Input
          className="pl-9"
          placeholder="Search recordings by title, code, or type..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid h-48 place-items-center">
          <Spinner className="size-6 text-signal-400" />
        </div>
      ) : filteredRecordings.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-ink-700 text-text-lo">
            <Film className="size-6" />
          </div>
          <p className="max-w-md text-text-mid">
            {query
              ? "No recordings match your search."
              : "No meeting recordings are available yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRecordings.map(({ meeting, recordingUrl, transcript, summary }) => (
            <Card key={meeting.code} className="flex flex-col gap-4 p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink-800 text-signal-400">
                  <PlayCircle className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium text-text-hi">{meeting.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-lo">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" />
                      {formatWhen(meeting.date, meeting.time)}
                    </span>
                    <span className="font-mono">{meeting.code}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meeting.host === user?.id ? "signal" : "ai"}>
                  {meeting.host === user?.id ? "Hosted by you" : "Invited"}
                </Badge>
                <Badge tone="muted">{meeting.type}</Badge>
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" onClick={() => window.open(recordingUrl, "_blank", "noopener")}>
                  <ExternalLink className="size-4" /> Open
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyLink(recordingUrl)}>
                  <Copy className="size-4" /> Copy link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadText(`transcript-${meeting.code}.txt`, transcript)}
                  disabled={!transcript}
                >
                  <Download className="size-4" /> Transcript
                </Button>
                <Button
                  size="sm"
                  variant="ai"
                  onClick={() => navigate(`/app/intelligence?m=${meeting.code}`)}
                >
                  <Sparkles className="size-4" /> Summary
                </Button>
              </div>

              <details className="rounded-lg border border-line bg-ink-900/40 p-3">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text-hi">
                  <FileText className="size-4 text-signal-400" />
                  Captured transcript
                </summary>
                <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-text-mid">
                  {transcript ||
                    "No transcript was captured for this recording. Turn on captions during the meeting before ending it."}
                </p>
                {summary?.summary && (
                  <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-text-lo">
                    {summary.summary}
                  </p>
                )}
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
