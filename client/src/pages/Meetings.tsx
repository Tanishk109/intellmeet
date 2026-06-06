import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Video,
  Trash2,
  Plus,
  Radio,
  CalendarClock,
  CheckCircle2,
  Copy,
  Sparkles,
} from "lucide-react";
import { Card, Badge, Spinner } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { meetingApi } from "@/api";
import { apiErrorMessage } from "@/lib/http";
import { formatWhen, statusTone } from "@/lib/meetings";
import type { Meeting, MeetingStatus } from "@/types";

type Filter = "all" | MeetingStatus;

const filterMeta: Record<Filter, { label: string; icon: typeof Radio }> = {
  all: { label: "All", icon: Video },
  live: { label: "Live", icon: Radio },
  scheduled: { label: "Scheduled", icon: CalendarClock },
  ended: { label: "Ended", icon: CheckCircle2 },
};

export default function Meetings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const push = useToast((s) => s.push);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toDelete, setToDelete] = useState<Meeting | null>(null);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: meetingApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => meetingApi.remove(code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
      push("Meeting deleted", "info");
      setToDelete(null);
    },
    onError: (err) => {
      push(apiErrorMessage(err), "error");
      setToDelete(null);
    },
  });

  const filtered = useMemo(() => {
    let list = meetings ?? [];
    if (filter !== "all") list = list.filter((m) => m.status === filter);
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (m) => m.title.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
      );
    // Live first, then scheduled, then ended.
    const order: Record<MeetingStatus, number> = { live: 0, scheduled: 1, ended: 2 };
    return [...list].sort((a, b) => order[a.status] - order[b.status]);
  }, [meetings, filter, query]);

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code);
    push(`Copied ${code}`, "success");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-hi">Meetings</h1>
          <p className="text-sm text-text-mid">Your scheduled, live, and past meetings.</p>
        </div>
        <Link to="/app/schedule">
          <Button>
            <Plus className="size-4" /> New meeting
          </Button>
        </Link>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-lo" />
          <Input
            className="pl-9"
            placeholder="Search by title or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {(Object.keys(filterMeta) as Filter[]).map((f) => (
              <option key={f} value={f}>
                {filterMeta[f].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid h-48 place-items-center">
          <Spinner className="size-6 text-signal-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-ink-700 text-text-lo">
            <Video className="size-6" />
          </div>
          <p className="text-text-mid">
            {query || filter !== "all"
              ? "No meetings match your filters."
              : "No meetings yet. Schedule your first one."}
          </p>
          {!query && filter === "all" && (
            <Link to="/app/schedule">
              <Button variant="outline">
                <Plus className="size-4" /> Schedule a meeting
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((m) => (
            <Card
              key={m.id}
              className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-ink-600"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink-800 text-signal-400">
                <Video className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium text-text-hi">{m.title}</h3>
                  <Badge tone={statusTone(m.status)} className="capitalize">
                    {m.status === "live" && <Radio className="size-3" />}
                    {m.status}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-text-lo">
                  <span>{formatWhen(m.date, m.time)}</span>
                  <span>·</span>
                  <span>{m.type}</span>
                  <button
                    onClick={() => copyCode(m.code)}
                    className="inline-flex items-center gap-1 font-mono hover:text-text-mid"
                  >
                    {m.code} <Copy className="size-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {m.status === "ended" && (
                  <Button
                    size="sm"
                    variant="ai"
                    onClick={() => navigate(`/app/intelligence?m=${m.code}`)}
                  >
                    <Sparkles className="size-4" /> Summary
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={m.status === "ended" ? "outline" : "primary"}
                  onClick={() => navigate(`/app/room/${m.code}`)}
                >
                  {m.status === "ended" ? "Review" : "Join"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 text-text-lo hover:text-danger-500"
                  onClick={() => setToDelete(m)}
                  aria-label="Delete meeting"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this meeting?"
        description={
          <>
            <span className="text-text-hi">{toDelete?.title}</span> will be permanently
            removed. This can't be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.code)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
