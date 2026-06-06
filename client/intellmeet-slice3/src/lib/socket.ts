import { io, type Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "@/lib/socketTypes";
import { getAccessToken } from "@/lib/http";

export type AppSocket = Socket<ServerToClient, ClientToServer>;

/** Create an authenticated socket. The backend's io.use() middleware reads the
 *  JWT from handshake.auth.token (same access token the REST API uses). */
export function createSocket(): AppSocket {
  // Empty base => same origin, so the Vite dev proxy forwards /socket.io to the
  // backend. In production set VITE_API_URL to the API origin.
  const base = import.meta.env.VITE_API_URL ?? "";
  return io(base || "/", {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token: getAccessToken() },
  });
}
