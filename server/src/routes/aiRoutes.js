import { Router } from "express";
import {
  generateSummary,
  getSummary,
  toggleActionItem,
  chat,
} from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.post("/meetings/:code/summary", generateSummary);
router.get("/meetings/:code/summary", getSummary);
router.patch("/summaries/:id/action-items/:itemId", toggleActionItem);
router.post("/chat", chat);

export default router;
