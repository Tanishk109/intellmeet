import Meeting from "../models/Meeting.js";
import Notification from "../models/Notification.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

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
  res.json({ success: true, meeting: meeting.toPublic() });
});

// POST /api/meetings  -> matches ScheduleMeeting payload { title, date, time, type, description, emails }
export const createMeeting = asyncHandler(async (req, res) => {
  const { title, date, time, type, description, emails } = req.body;
  if (!title || !date || !time) {
    throw new ApiError(400, "title, date and time are required");
  }
  const meeting = await Meeting.create({
    title,
    date,
    time,
    type,
    description,
    emails,
    host: req.user._id,
    participants: [req.user._id],
  });

  await Notification.create({
    user: req.user._id,
    title: "Meeting scheduled",
    message: `${title} on ${date} at ${time}`,
    type: "meeting",
  });

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
  meeting.status = "live";
  meeting.startedAt = new Date();
  await meeting.save();
  res.json({ success: true, meeting: meeting.toPublic() });
});

// POST /api/meetings/:code/end
export const endMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  meeting.status = "ended";
  meeting.endedAt = new Date();
  await meeting.save();
  res.json({ success: true, meeting: meeting.toPublic() });
});
