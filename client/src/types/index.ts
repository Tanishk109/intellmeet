// Types mirror the backend's `toPublic()` shapes exactly, so the client and
// server stay in sync. See server/src/models/*.js.

export type Role = "Admin" | "Member";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  createdAt?: string;
}

export type MeetingType = "Team Meeting" | "Client Meeting" | "1:1" | "Standup" | "Other";

export type MeetingStatus = "scheduled" | "live" | "ended";

export interface MeetingAttendee {
  user: string;
  name: string;
  email: string;
  joinedAt: string;
  leftAt?: string | null;
}

export interface Meeting {
  id: string; // human-readable MT-xxxx code (matches backend)
  _id: string;
  code: string;
  host: string; // host user id; used to gate host-only controls
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  scheduledAt?: string | null;
  timezone?: string;
  type: MeetingType;
  description: string;
  emails: string;
  status: MeetingStatus;
  recordingUrl: string;
  startedAt?: string | null;
  endedAt?: string | null;
  joinAvailableUntil?: string | null;
  canJoin?: boolean;
  attendees: MeetingAttendee[];
  createdAt: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee: string;
  done: boolean;
}

export interface Summary {
  id: string;
  meeting: string;
  transcript: string;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  accuracy: number;
  generatedBy: "openai" | "mock";
  createdAt: string;
}

export interface RecordingArtifact {
  meeting: Meeting;
  recordingUrl: string;
  transcript: string;
  summary: Summary | null;
}

export type NotificationType = "meeting" | "mention" | "action" | "system";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface Analytics {
  totalMeetings: number;
  liveMeetings: number;
  productivityScore: number;
  avgDurationMins: number;
  weekly: { day: string; meetings: number }[];
}

export interface ChatMessage {
  id: string;
  meeting: string;
  sender: string;
  senderName: string;
  text: string;
  createdAt: string;
}

// Generic API envelope: backend returns { success, ...data } or { success:false, message }.
export interface AuthResponse {
  success: true;
  accessToken: string;
  user: User;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  order: number;
  fromMeeting: string;
  createdAt: string;
  updatedAt: string;
}
