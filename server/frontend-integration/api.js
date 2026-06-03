// src/lib/api.js
// Drop this into the IntellMeet client (create the folder src/lib/).
// A tiny fetch wrapper that talks to the IntellMeet backend, attaches the JWT
// access token, and transparently refreshes it on 401.

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

let accessToken = null;
export const setToken = (t) => { accessToken = t; };
export const getToken = () => accessToken;

async function request(path, { method = "GET", body, _retry } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include", // send/receive the refresh cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  // Try a silent refresh once on 401.
  if (res.status === 401 && !_retry && path !== "/auth/refresh") {
    const ok = await refresh();
    if (ok) return request(path, { method, body, _retry: true });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

async function refresh() {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

export const api = {
  // auth
  signup: (b) => request("/auth/signup", { method: "POST", body: b }),
  login: (b) => request("/auth/login", { method: "POST", body: b }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  forgotPassword: (b) => request("/auth/forgot-password", { method: "POST", body: b }),
  // meetings
  listMeetings: () => request("/meetings"),
  createMeeting: (b) => request("/meetings", { method: "POST", body: b }),
  getMeeting: (code) => request(`/meetings/${code}`),
  updateMeeting: (code, b) => request(`/meetings/${code}`, { method: "PUT", body: b }),
  deleteMeeting: (code) => request(`/meetings/${code}`, { method: "DELETE" }),
  startMeeting: (code) => request(`/meetings/${code}/start`, { method: "POST" }),
  endMeeting: (code) => request(`/meetings/${code}/end`, { method: "POST" }),
  // ai
  generateSummary: (code, transcript) =>
    request(`/ai/meetings/${code}/summary`, { method: "POST", body: { transcript } }),
  getSummary: (code) => request(`/ai/meetings/${code}/summary`),
  toggleActionItem: (sumId, itemId, done) =>
    request(`/ai/summaries/${sumId}/action-items/${itemId}`, { method: "PATCH", body: { done } }),
  aiChat: (message) => request("/ai/chat", { method: "POST", body: { message } }),
  // misc
  notifications: () => request("/notifications"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
  analytics: () => request("/analytics"),
  updateProfile: (b) => request("/profile", { method: "PUT", body: b }),
};
