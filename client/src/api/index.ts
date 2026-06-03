import { http } from "@/lib/http";
import type {
  Analytics,
  AppNotification,
  AuthResponse,
  Meeting,
  Summary,
  User,
} from "@/types";

// One typed function per backend endpoint. Components never call http directly.

export const authApi = {
  signup: (body: { name: string; email: string; password: string }) =>
    http.post<AuthResponse>("/auth/signup", body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    http.post<AuthResponse>("/auth/login", body).then((r) => r.data),
  logout: () => http.post("/auth/logout").then((r) => r.data),
  me: () => http.get<{ success: true; user: User }>("/auth/me").then((r) => r.data.user),
  forgotPassword: (body: { email: string }) =>
    http.post<{ success: true; message: string }>("/auth/forgot-password", body).then((r) => r.data),
};

export const meetingApi = {
  list: () =>
    http.get<{ success: true; meetings: Meeting[] }>("/meetings").then((r) => r.data.meetings),
  get: (code: string) =>
    http.get<{ success: true; meeting: Meeting }>(`/meetings/${code}`).then((r) => r.data.meeting),
  create: (body: Partial<Meeting>) =>
    http.post<{ success: true; meeting: Meeting }>("/meetings", body).then((r) => r.data.meeting),
  update: (code: string, body: Partial<Meeting>) =>
    http.put<{ success: true; meeting: Meeting }>(`/meetings/${code}`, body).then((r) => r.data.meeting),
  remove: (code: string) => http.delete(`/meetings/${code}`).then((r) => r.data),
  start: (code: string) =>
    http.post<{ success: true; meeting: Meeting }>(`/meetings/${code}/start`).then((r) => r.data.meeting),
  end: (code: string) =>
    http.post<{ success: true; meeting: Meeting }>(`/meetings/${code}/end`).then((r) => r.data.meeting),
};

export const aiApi = {
  generateSummary: (code: string, transcript: string) =>
    http
      .post<{ success: true; summary: Summary }>(`/ai/meetings/${code}/summary`, { transcript })
      .then((r) => r.data.summary),
  getSummary: (code: string) =>
    http.get<{ success: true; summary: Summary }>(`/ai/meetings/${code}/summary`).then((r) => r.data.summary),
  toggleActionItem: (summaryId: string, itemId: string, done: boolean) =>
    http
      .patch<{ success: true; summary: Summary }>(
        `/ai/summaries/${summaryId}/action-items/${itemId}`,
        { done }
      )
      .then((r) => r.data.summary),
  chat: (message: string) =>
    http.post<{ success: true; reply: string }>("/ai/chat", { message }).then((r) => r.data.reply),
};

export const miscApi = {
  notifications: () =>
    http
      .get<{ success: true; notifications: AppNotification[] }>("/notifications")
      .then((r) => r.data.notifications),
  markRead: (id: string) => http.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => http.patch("/notifications/read-all").then((r) => r.data),
  analytics: () =>
    http.get<{ success: true; analytics: Analytics }>("/analytics").then((r) => r.data.analytics),
  updateProfile: (body: { name?: string; avatar?: string }) =>
    http.put<{ success: true; user: User }>("/profile", body).then((r) => r.data.user),
};
