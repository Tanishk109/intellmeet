import Notification from "../models/Notification.js";
import Meeting from "../models/Meeting.js";
import Summary from "../models/Summary.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

// ---- Notifications (matches Notifications page) ----
export const listNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, notifications: items.map((n) => n.toPublic()) });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new ApiError(404, "Notification not found");
  n.read = true;
  await n.save();
  res.json({ success: true, notification: n.toPublic() });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: "All marked read" });
});

// ---- Analytics (matches Dashboard / Analytics charts) ----
// Everything here is derived from the user's real data so the numbers are
// stable across requests (no more random values that change on every refetch).
export const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const meetings = await Meeting.find({
    $or: [{ host: userId }, { participants: userId }],
  });

  const totalMeetings = meetings.length;
  const liveMeetings = meetings.filter((m) => m.status === "live").length;
  const ended = meetings.filter((m) => m.status === "ended");

  // Average real duration from started/ended timestamps (minutes).
  const durations = ended
    .filter((m) => m.startedAt && m.endedAt)
    .map((m) => (new Date(m.endedAt) - new Date(m.startedAt)) / 60000)
    .filter((d) => d > 0);
  const avgDurationMins = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Weekly frequency by weekday (Mon–Sun) from each meeting's date.
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const m of meetings) {
    const d = new Date(`${m.date}T00:00:00`);
    if (!Number.isNaN(d.getTime())) counts[(d.getDay() + 6) % 7] += 1;
  }
  const weekly = labels.map((day, i) => ({ day, meetings: counts[i] }));

  // Productivity = action-item completion rate across the user's summaries;
  // falls back to the share of meetings that have been completed (ended).
  const summaries = await Summary.find({ meeting: { $in: meetings.map((m) => m._id) } });
  let done = 0;
  let totalItems = 0;
  for (const s of summaries) {
    for (const a of s.actionItems) {
      totalItems += 1;
      if (a.done) done += 1;
    }
  }
  const productivityScore = totalItems
    ? Math.round((done / totalItems) * 100)
    : totalMeetings
      ? Math.round((ended.length / totalMeetings) * 100)
      : 0;

  res.json({
    success: true,
    analytics: {
      totalMeetings,
      liveMeetings,
      productivityScore,
      avgDurationMins,
      weekly,
    },
  });
});

// ---- Profile (matches Profile / Settings pages) ----
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  if (name) req.user.name = name;
  if (avatar !== undefined) req.user.avatar = avatar;
  await req.user.save();
  res.json({ success: true, user: req.user.toPublic() });
});
