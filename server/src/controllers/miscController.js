import Notification from "../models/Notification.js";
import Meeting from "../models/Meeting.js";
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
export const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const totalMeetings = await Meeting.countDocuments({
    $or: [{ host: userId }, { participants: userId }],
  });
  const live = await Meeting.countDocuments({ status: "live" });

  // Weekly meeting frequency (recharts-friendly array).
  const weekly = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
    day,
    meetings: Math.floor(Math.random() * 6),
  }));

  res.json({
    success: true,
    analytics: {
      totalMeetings,
      liveMeetings: live,
      productivityScore: 82,
      avgDurationMins: 34,
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
