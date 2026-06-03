import mongoose from "mongoose";

// Matches the AISummary page: a summary, key points / notes, and action items
// with assignees (per PDF F03: "action items with assignees").

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    assignee: { type: String, default: "Unassigned" },
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

const summarySchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    transcript: { type: String, default: "" },
    summary: { type: String, default: "" },
    keyPoints: [{ type: String }],
    actionItems: [actionItemSchema],
    accuracy: { type: Number, default: 0 }, // 0–100 (PDF target: >85%)
    generatedBy: { type: String, enum: ["openai", "mock"], default: "mock" },
  },
  { timestamps: true }
);

summarySchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    meeting: this.meeting.toString(),
    summary: this.summary,
    keyPoints: this.keyPoints,
    actionItems: this.actionItems.map((a) => ({
      id: a._id.toString(),
      text: a.text,
      assignee: a.assignee,
      done: a.done,
    })),
    accuracy: this.accuracy,
    generatedBy: this.generatedBy,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Summary", summarySchema);
