import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  signup,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
} from "../controllers/authController.js";
import { googleStart, googleCallback } from "../controllers/googleController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// PDF Day 3: rate limit auth routes to prevent brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, try again later." },
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, me);

// Google OAuth (no rate limiter — these are browser redirects, not form posts).
router.get("/google", googleStart);
router.get("/google/callback", googleCallback);

export default router;
