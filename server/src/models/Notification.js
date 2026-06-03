import mongoose from "mongoose";

// Mirrors the Notifications page items: a title/message, a type, and read state.

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    type: {
      type: String,
      enum: ["meeting", "mention", "action", "system"],
      default: "system",
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    title: this.title,
    message: this.message,
    type: this.type,
    read: this.read,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Notification", notificationSchema);
