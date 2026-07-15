import { Router } from "express";
import {
  listMeetings,
  listRecordingArtifacts,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  startMeeting,
  endMeeting,
  uploadRecording,
  saveTranscript,
  getMessages,
} from "../controllers/meetingController.js";
import { protect } from "../middleware/auth.js";
import { recordingUpload } from "../middleware/upload.js";

const router = Router();
router.use(protect);

router.route("/").get(listMeetings).post(createMeeting);
router.get("/recordings", listRecordingArtifacts);
router.post("/:code/start", startMeeting);
router.post("/:code/end", endMeeting);
router.post("/:code/recording", recordingUpload.single("recording"), uploadRecording);
router.put("/:code/transcript", saveTranscript);
router.get("/:code/messages", getMessages);
router.route("/:code").get(getMeeting).put(updateMeeting).delete(deleteMeeting);

export default router;
