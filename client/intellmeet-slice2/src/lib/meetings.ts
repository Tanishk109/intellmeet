import type { MeetingStatus, MeetingType } from "@/types";

export const MEETING_TYPES: MeetingType[] = [
  "Team Meeting",
  "Client Meeting",
  "1:1",
  "Standup",
  "Other",
];

/** Badge tone per meeting status. */
export function statusTone(status: MeetingStatus): "signal" | "ai" | "muted" {
  if (status === "live") return "signal";
  if (status === "scheduled") return "ai";
  return "muted";
}

/** "2026-06-10" + "14:30" -> "Wed, Jun 10 · 2:30 PM" */
export function formatWhen(date: string, time: string): string {
  try {
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return `${date} · ${time}`;
    return dt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return `${date} · ${time}`;
  }
}

/** Split the comma/space separated emails string into clean chips. */
export function parseEmails(emails: string): string[] {
  return emails
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}
