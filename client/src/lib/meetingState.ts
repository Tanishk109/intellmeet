import type { Meeting } from "@/types";

export function isMeetingJoinable(meeting: Meeting): boolean {
  if (meeting.status === "live") return true;
  if (meeting.status === "scheduled") {
    if (!meeting.scheduledAt) return true;
    return new Date(meeting.scheduledAt).getTime() - 15 * 60 * 1000 <= Date.now();
  }
  if (!meeting.joinAvailableUntil) return false;
  return new Date(meeting.joinAvailableUntil).getTime() > Date.now();
}

export function isMeetingOver(meeting: Meeting): boolean {
  return meeting.status === "ended" && !isMeetingJoinable(meeting);
}

export function minutesUntilClose(meeting: Meeting): number {
  if (!meeting.joinAvailableUntil) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(meeting.joinAvailableUntil).getTime() - Date.now()) / 60000)
  );
}

export function minutesUntilOpen(meeting: Meeting): number {
  if (!meeting.scheduledAt) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(meeting.scheduledAt).getTime() - 15 * 60 * 1000 - Date.now()) / 60000)
  );
}

export function meetingTimeValue(meeting: Meeting): number {
  const value = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).getTime()
    : new Date(`${meeting.date}T${meeting.time}`).getTime();
  return Number.isNaN(value) ? 0 : value;
}
