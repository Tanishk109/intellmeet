import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import miscRoutes from "./routes/miscRoutes.js";
import { notFound, errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  // Global, gentle rate limit (auth routes have a stricter one of their own).
  app.use(
    "/api",
    rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
  );

  app.get("/api/health", (req, res) =>
    res.json({ success: true, status: "ok", time: new Date().toISOString() })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/meetings", meetingRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api", miscRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
