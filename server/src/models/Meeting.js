import mongoose from "mongoose";

// Mirrors the meeting object the ScheduleMeeting page builds:
// { id: "MT-1001", title, date, time, type, description, emails }
// We expose `code` (the MT-xxxx string) plus the real Mongo `id`.

function generateCode() {
  return `MT-${Date.now().toString().slice(-5)}`;
}

const meetingSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true, default: generateCode },
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" (matches frontend <input type=date>)
    time: { type: String, required: true }, // "HH:mm" (matches frontend <input type=time>)
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
  },
  { timestamps: true }
);

meetingSchema.methods.toPublic = function () {
  return {
    id: this.code, // frontend treats this human-readable string as the id
    _id: this._id.toString(),
    code: this.code,
    host: this.host?.toString() ?? "", // lets the client gate host-only controls
    title: this.title,
    date: this.date,
    time: this.time,
    type: this.type,
    description: this.description,
    emails: this.emails,
    status: this.status,
    recordingUrl: this.recordingUrl,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Meeting", meetingSchema);
