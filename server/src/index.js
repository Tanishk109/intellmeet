import http from "http";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { initSockets } from "./sockets/index.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB(process.env.MONGO_URI);

  const app = createApp();
  const server = http.createServer(app);

  initSockets(server, process.env.CLIENT_ORIGIN || "http://localhost:5173");

  server.listen(PORT, () => {
    console.log(`[server] IntellMeet API on http://localhost:${PORT}`);
    console.log(`[server] Socket.io ready, CORS origin: ${process.env.CLIENT_ORIGIN}`);
  });
}

start().catch((err) => {
  console.error("[fatal] failed to start:", err.message);
  process.exit(1);
});
