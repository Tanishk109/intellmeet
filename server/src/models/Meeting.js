import mongoose from "mongoose";

// Mirrors the meeting object the ScheduleMeeting page builds:
// { id: "MT-1001", title, date, time, type, description, emails }
// We expose `code` (the MT-xxxx string) plus the real Mongo `id`.

function generateCode() {
  return `MT-${Date.now().toString().slice(-5)}`;
}

const JOIN_GRACE_MS = 15 * 60 * 1000;
const START_GRACE_MS = 15 * 60 * 1000;

function parseLocalDateTime(date, time) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const attendeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "Guest" },
    email: { type: String, default: "" },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true, default: generateCode },
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" (matches frontend <input type=date>)
    time: { type: String, required: true }, // "HH:mm" (matches frontend <input type=time>)
    scheduledAt: { type: Date, default: null },
    timezone: { type: String, default: "" },
    type: {
      type: String,
      enum: ["Team Meeting", "Client Meeting", "1:1", "Standup", "Other"],
      default: "Team Meeting",
    },
    description: { type: String, default: "" },
    // The frontend collects invitees as a comma-separated string; we keep both.
    emails: { type: String, default: "" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    recordingUrl: { type: String, default: "" },
    attendees: [attendeeSchema],
  },
  { timestamps: true }
);

meetingSchema.pre("validate", function (next) {
  if (!this.scheduledAt) {
    const parsed = parseLocalDateTime(this.date, this.time);
    if (parsed) this.scheduledAt = parsed;
  }
  next();
});

meetingSchema.methods.joinAvailableUntil = function () {
  if (!this.endedAt) return null;
  return new Date(this.endedAt.getTime() + JOIN_GRACE_MS);
};

meetingSchema.methods.canJoinNow = function () {
  if (this.status === "live") return true;
  if (this.status === "scheduled") {
    if (!this.scheduledAt) return true;
    return this.scheduledAt.getTime() - START_GRACE_MS <= Date.now();
  }
  const until = this.joinAvailableUntil();
  return !!until && until.getTime() > Date.now();
};

meetingSchema.methods.toPublic = function () {
  const joinAvailableUntil = this.joinAvailableUntil();
  return {
    id: this.code, // frontend treats this human-readable string as the id
    _id: this._id.toString(),
    code: this.code,
    host: this.host?.toString() ?? "", // lets the client gate host-only controls
    title: this.title,
    date: this.date,
    time: this.time,
    scheduledAt: this.scheduledAt,
    timezone: this.timezone,
    type: this.type,
    description: this.description,
    emails: this.emails,
    status: this.status,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    joinAvailableUntil,
    canJoin: this.canJoinNow(),
    recordingUrl: this.recordingUrl,
    attendees: this.attendees.map((attendee) => ({
      user: attendee.user?.toString() ?? "",
      name: attendee.name,
      email: attendee.email,
      joinedAt: attendee.joinedAt,
      leftAt: attendee.leftAt,
    })),
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Meeting", meetingSchema);
