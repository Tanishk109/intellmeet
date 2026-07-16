import http from "http";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { allowedOrigins } from "./config/origins.js";
import { initSockets } from "./sockets/index.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB(process.env.MONGO_URI);

  const app = createApp();
  const server = http.createServer(app);

  const origins = allowedOrigins();
  initSockets(server, origins);

  server.listen(PORT, () => {
    console.log(`[server] IntellMeet API on http://localhost:${PORT}`);
    console.log(`[server] Socket.io ready, CORS origins: ${origins.join(", ")}`);
  });
}

start().catch((err) => {
  console.error("[fatal] failed to start:", err.message);
  process.exit(1);
});
