import { Router } from "express";
import {
  listNotifications,
  markRead,
  markAllRead,
  getAnalytics,
  updateProfile,
} from "../controllers/miscController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.get("/notifications", listNotifications);
router.patch("/notifications/:id/read", markRead);
router.patch("/notifications/read-all", markAllRead);
router.get("/analytics", getAnalytics);
router.put("/profile", updateProfile);

export default router;
