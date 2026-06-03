import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

messageSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    meeting: this.meeting.toString(),
    sender: this.sender.toString(),
    senderName: this.senderName,
    text: this.text,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Message", messageSchema);
