import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { isAllowedOrigin } from "./config/origins.js";

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp() {
  const app = express();

  // Render and other managed hosts sit behind a reverse proxy. Trusting one
  // proxy lets express-rate-limit read the real client IP from X-Forwarded-For.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(path.join(SERVER_ROOT, "uploads")));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  // Global, gentle rate limit (auth routes have a stricter one of their own).
  app.use(
    "/api",
    rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
  );

  app.get("/", (req, res) =>
    res.status(200).json({
      success: true,
      message: "IntellMeet API is running",
      health: "/api/health",
    })
  );

  app.get("/favicon.ico", (req, res) => res.status(204).end());

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
