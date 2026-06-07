import { Router } from "express";
import {
  listMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  startMeeting,
  endMeeting,
  getMessages,
} from "../controllers/meetingController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.route("/").get(listMeetings).post(createMeeting);
router.route("/:code").get(getMeeting).put(updateMeeting).delete(deleteMeeting);
router.post("/:code/start", startMeeting);
router.post("/:code/end", endMeeting);
router.get("/:code/messages", getMessages);

export default router;
