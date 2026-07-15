import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Meeting from "../models/Meeting.js";
import Notification from "../models/Notification.js";
import Message from "../models/Message.js";
import Summary from "../models/Summary.js";
import User from "../models/User.js";
import cloudinary from "../config/cloudinary.js";
import { ApiError, asyncHandler, isHost, isMember } from "../utils/helpers.js";
import { sendEmail, meetingInviteEmail } from "../utils/mailer.js";

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function cloudinaryConfigured() {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function recordingExtension(mimetype) {
  const baseType = String(mimetype || "").split(";")[0].trim().toLowerCase();
  return baseType === "video/mp4" ? "mp4" : "webm";
}

// Split the invitees string into clean, unique, valid email addresses.
function parseEmails(raw) {
  if (!raw) return [];
  return [
    ...new Set(
      String(raw)
        .split(/[,\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    ),
  ];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseScheduledAt({ date, time, scheduledAt }) {
  if (scheduledAt) {
    const parsed = new Date(scheduledAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

// GET /api/meetings  -> list meetings for the current user (host or participant)
export const listMeetings = asyncHandler(async (req, res) => {
  const emailPattern = new RegExp(`(^|[\\s,])${escapeRegex(req.user.email)}([\\s,]|$)`, "i");
  const meetings = await Meeting.find({
    $or: [{ host: req.user._id }, { participants: req.user._id }, { emails: emailPattern }],
  }).sort({ scheduledAt: 1, createdAt: -1 });
  res.json({ success: true, meetings: meetings.map((m) => m.toPublic()) });
});

// GET /api/meetings/recordings -> recording/transcript artifacts for accessible meetings.
export const listRecordingArtifacts = asyncHandler(async (req, res) => {
  const emailPattern = new RegExp(`(^|[\\s,])${escapeRegex(req.user.email)}([\\s,]|$)`, "i");
  const meetings = await Meeting.find({
    recordingUrl: { $ne: "" },
    $or: [{ host: req.user._id }, { participants: req.user._id }, { emails: emailPattern }],
  }).sort({ endedAt: -1, createdAt: -1 });

  const summaries = await Summary.find({ meeting: { $in: meetings.map((m) => m._id) } });
  const summaryByMeeting = new Map(summaries.map((summary) => [summary.meeting.toString(), summary]));

  res.json({
    success: true,
    recordings: meetings.map((meeting) => {
      const summary = summaryByMeeting.get(meeting._id.toString());
      return {
        meeting: meeting.toPublic(),
        recordingUrl: meeting.recordingUrl,
        transcript: summary?.transcript ?? "",
        summary: summary ? summary.toPublic() : null,
      };
    }),
  });
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
  const { title, date, time, type, description, emails, scheduledAt, timezone } = req.body;
  if (!title || !date || !time) {
    throw new ApiError(400, "title, date and time are required");
  }
  const parsedScheduledAt = parseScheduledAt({ date, time, scheduledAt });
  if (!parsedScheduledAt) throw new ApiError(400, "Invalid meeting date or time");

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
    scheduledAt: parsedScheduledAt,
    timezone,
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

  // Fire off invite emails to each valid invitee. Sends never throw (the mailer
  // degrades to console logging when no provider key is set), so a failed email
  // can't break meeting creation. We report how many actually went out.
  const recipients = parseEmails(emails);
  let invitedCount = 0;
  if (recipients.length) {
    const appUrl =
      process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";
    const joinUrl = `${appUrl}/app/room/${meeting.code}`;
    const { subject, html, text } = meetingInviteEmail({
      hostName: req.user.name,
      title,
      date,
      time,
      type: type || "Team Meeting",
      code: meeting.code,
      joinUrl,
    });
    const results = await Promise.all(
      recipients.map((to) => sendEmail({ to, subject, html, text }))
    );
    invitedCount = results.filter((r) => r.sent).length;
  }

  res.status(201).json({
    success: true,
    meeting: meeting.toPublic(),
    invited: { total: recipients.length, sent: invitedCount },
  });
});

// PUT /api/meetings/:code
export const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (meeting.host.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the host can update this meeting");
  }
  const fields = ["title", "date", "time", "type", "description", "emails", "timezone"];
  for (const f of fields) if (f in req.body) meeting[f] = req.body[f];
  if ("scheduledAt" in req.body || "date" in req.body || "time" in req.body) {
    const parsedScheduledAt = parseScheduledAt({
      date: meeting.date,
      time: meeting.time,
      scheduledAt: req.body.scheduledAt,
    });
    if (!parsedScheduledAt) throw new ApiError(400, "Invalid meeting date or time");
    meeting.scheduledAt = parsedScheduledAt;
  }
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
  if (meeting.status === "ended") {
    throw new ApiError(400, "This meeting has already ended");
  }
  if (!meeting.canJoinNow()) {
    throw new ApiError(400, "This meeting is not open yet");
  }
  if (meeting.status === "live") {
    return res.json({ success: true, meeting: meeting.toPublic() });
  }
  meeting.status = "live";
  meeting.startedAt = new Date();
  meeting.endedAt = null;
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
  if (meeting.status === "scheduled") {
    throw new ApiError(400, "Start the meeting before ending it");
  }
  if (meeting.status === "ended") {
    return res.json({ success: true, meeting: meeting.toPublic() });
  }
  meeting.status = "ended";
  meeting.endedAt = new Date();
  await meeting.save();
  res.json({ success: true, meeting: meeting.toPublic() });
});

// POST /api/meetings/:code/recording
export const uploadRecording = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isHost(meeting, req.user)) {
    throw new ApiError(403, "Only the host can upload the recording");
  }
  if (!req.file) throw new ApiError(400, "Recording file is required");

  if (cloudinaryConfigured()) {
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "intellmeet/recordings",
          public_id: `${meeting.code}-${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    meeting.recordingUrl = uploaded.secure_url;
  } else {
    const directory = path.join(SERVER_ROOT, "uploads", "recordings");
    await fs.mkdir(directory, { recursive: true });
    const filename = `${meeting.code}-${Date.now()}.${recordingExtension(req.file.mimetype)}`;
    await fs.writeFile(path.join(directory, filename), req.file.buffer);
    const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`;
    meeting.recordingUrl = `${serverUrl}/uploads/recordings/${filename}`;
  }

  await meeting.save();

  res.json({
    success: true,
    recordingUrl: meeting.recordingUrl,
    meeting: meeting.toPublic(),
  });
});

// PUT /api/meetings/:code/transcript
export const saveTranscript = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ code: req.params.code });
  if (!meeting) throw new ApiError(404, "Meeting not found");
  if (!isHost(meeting, req.user)) {
    throw new ApiError(403, "Only the host can save the transcript");
  }

  const transcript = String(req.body.transcript ?? "").trim();
  if (!transcript) throw new ApiError(400, "Transcript is required");

  const summary = await Summary.findOneAndUpdate(
    { meeting: meeting._id },
    { $set: { meeting: meeting._id, transcript } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, transcript: summary.transcript, summary: summary.toPublic() });
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
