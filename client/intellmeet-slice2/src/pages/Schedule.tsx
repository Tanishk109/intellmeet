import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Users, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { meetingApi } from "@/api";
import { apiErrorMessage } from "@/lib/http";
import { MEETING_TYPES, parseEmails } from "@/lib/meetings";
import type { Meeting, MeetingType } from "@/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Schedule() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const push = useToast((s) => s.push);

  const [form, setForm] = useState({
    title: "",
    date: todayISO(),
    time: "10:00",
    type: "Team Meeting" as MeetingType,
    description: "",
    emails: "",
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const emailChips = parseEmails(form.emails);

  const mutation = useMutation({
    mutationFn: (body: Partial<Meeting>) => meetingApi.create(body),
    onSuccess: (meeting) => {
      // Refresh any cached meetings lists so the new one shows immediately.
      void qc.invalidateQueries({ queryKey: ["meetings"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
      push("Meeting scheduled 🚀", "success");
      navigate("/app/meetings");
      void meeting;
    },
    onError: (err) => push(apiErrorMessage(err), "error"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return push("Give the meeting a title", "error");
    if (!form.date || !form.time) return push("Pick a date and time", "error");
    mutation.mutate(form);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-signal-500/15 text-signal-400">
          <CalendarPlus className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-hi">Schedule a meeting</h1>
          <p className="text-sm text-text-mid">
            Set it up, invite your team, and join when it's time.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Q3 Product Sync"
              value={form.title}
              onChange={set("title")}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={form.date} onChange={set("date")} />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={form.time} onChange={set("time")} />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" value={form.type} onChange={set("type")}>
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="emails">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" /> Invite (comma-separated emails)
              </span>
            </Label>
            <Input
              id="emails"
              placeholder="alex@team.com, sam@team.com"
              value={form.emails}
              onChange={set("emails")}
            />
            {emailChips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emailChips.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-ink-800 px-2.5 py-1 text-xs text-text-mid"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          emails: emailChips.filter((x) => x !== email).join(", "),
                        }))
                      }
                      className="text-text-lo hover:text-danger-500"
                      aria-label={`Remove ${email}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Agenda, links, context…"
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner /> : "Schedule meeting"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
