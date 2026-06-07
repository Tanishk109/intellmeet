import Meeting from "../models/Meeting.js";
import Notification from "../models/Notification.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { ApiError, asyncHandler, isHost, isMember } from "../utils/helpers.js";

// GET /api/meetings  -> list meetings for the current user (host or participant)
export const listMeetings = asyncHandler(async (req, res) => {
  const meetings = await Meeting.find({
    $or: [{ host: req.user._id }, { participants: req.user._id }],
  }).sort({ createdAt: -1 });
  res.json({ success: true, meetings: meetings.map((m) => m.toPublic()) });
});

// GET /api/meetings/:code
export const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isMember(meeting, req.user)) {
    throw new ApiError(403, "You don't have access to this meeting");
  }
  res.json({ success: true, meeting: meeting.toPublic() });
});

// POST /api/meetings  -> matches ScheduleMeeting payload { title, date, time, type, description, emails }
export const createMeeting = asyncHandler(async (req, res) => {
  const { title, date, time, type, description, emails } = req.body;
  if (!title || !date || !time) {
    throw new ApiError(400, "title, date and time are required");
  }

  // Resolve invited emails to existing user accounts so they actually get
  // access (membership) and a notification — not just a cosmetic string.
  const participants = [req.user._id];
  let invitedUsers = [];
  if (emails) {
    const list = emails
      .toLowerCase()
      .split(/[,\s]+/)
      .filter(Boolean);
    if (list.length) {
      invitedUsers = await User.find({ email: { $in: list } });
      for (const u of invitedUsers) {
        if (u._id.toString() !== req.user._id.toString()) participants.push(u._id);
      }
    }
  }

  const meeting = await Meeting.create({
    title,
    date,
    time,
    type,
    description,
    emails,
    host: req.user._id,
    participants,
  });

  const notifications = [
    {
      user: req.user._id,
      title: "Meeting scheduled",
      message: `${title} on ${date} at ${time}`,
      type: "meeting",
    },
    ...invitedUsers
      .filter((u) => u._id.toString() !== req.user._id.toString())
      .map((u) => ({
        user: u._id,
        title: "You were invited to a meeting",
        message: `${req.user.name} invited you to "${title}" on ${date} at ${time}`,
        type: "meeting",
      })),
  ];
  await Notification.insertMany(notifications);

  res.status(201).json({ success: true, meeting: meeting.toPublic() });
});

// PUT /api/meetings/:code
export const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (meeting.host.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the host can update this meeting");
  }
  const fields = ["title", "date", "time", "type", "description", "emails"];
  for (const f of fields) if (f in req.body) meeting[f] = req.body[f];
  await meeting.save();
  res.json({ success: true, meeting: meeting.toPublic() });
});

// DELETE /api/meetings/:code
export const deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (meeting.host.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the host can delete this meeting");
  }
  await meeting.deleteOne();
  res.json({ success: true, message: "Meeting deleted" });
});

// POST /api/meetings/:code/start
export const startMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isHost(meeting, req.user)) {
    throw new ApiError(403, "Only the host can start this meeting");
  }
  meeting.status = "live";
  meeting.startedAt = new Date();
  await meeting.save();
  res.json({ success: true, meeting: meeting.toPublic() });
});

// POST /api/meetings/:code/end
export const endMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isHost(meeting, req.user)) {
    throw new ApiError(403, "Only the host can end this meeting");
  }
  meeting.status = "ended";
  meeting.endedAt = new Date();
  await meeting.save();
  res.json({ success: true, meeting: meeting.toPublic() });
});

// GET /api/meetings/:code/messages  -> chat history (members only)
export const getMessages = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isMember(meeting, req.user)) {
    throw new ApiError(403, "You don't have access to this meeting");
  }
  const messages = await Message.find({ meeting: meeting._id })
    .sort({ createdAt: 1 })
    .limit(200);
  res.json({ success: true, messages: messages.map((m) => m.toPublic()) });
});
