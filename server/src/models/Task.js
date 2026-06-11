import mongoose from "mongoose";

// Kanban task. Columns are the three standard states. `order` keeps cards
// sorted within a column; `fromMeeting` links a task back to the meeting whose
// AI action item created it (F03 -> F06 handoff).

const taskSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    assignee: { type: String, default: "Unassigned" },
    order: { type: Number, default: 0 },
    fromMeeting: { type: String, default: "" }, // meeting code, if created from an action item
  },
  { timestamps: true }
);

taskSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    status: this.status,
    priority: this.priority,
    assignee: this.assignee,
    order: this.order,
    fromMeeting: this.fromMeeting,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model("Task", taskSchema);
