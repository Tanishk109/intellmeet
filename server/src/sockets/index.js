import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/tokens.js";
import User from "../models/User.js";
import Meeting from "../models/Meeting.js";
import Message from "../models/Message.js";
import { isMember } from "../utils/helpers.js";

// Tracks who is in each meeting room: roomCode -> Map(socketId -> {userId, name})
const rooms = new Map();

export function initSockets(httpServer, allowedOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigin, credentials: true },
  });

  // Authenticate the socket using the same access token as the REST API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error("User not found"));
      socket.user = { id: user._id.toString(), name: user.name, email: user.email };
      next();
    } catch {
      next(new Error("Unauthorized socket"));
    }
  });

  io.on("connection", (socket) => {
    // ---- Join a meeting room ----
    socket.on("meeting:join", async ({ code }) => {
      if (!code) return;
      const meeting = await Meeting.findOne({ code });
      if (!meeting || !isMember(meeting, { _id: socket.user.id, email: socket.user.email })) {
        socket.emit("meeting:closed", { reason: "Meeting not found or access denied" });
        return;
      }
      if (!meeting.canJoinNow()) {
        socket.emit("meeting:closed", { reason: "This meeting is over" });
        return;
      }

      const attendee = meeting.attendees.find(
        (entry) => entry.user?.toString() === socket.user.id
      );
      if (attendee) {
        attendee.name = socket.user.name;
        attendee.email = socket.user.email;
        attendee.leftAt = null;
      } else {
        meeting.attendees.push({
          user: socket.user.id,
          name: socket.user.name,
          email: socket.user.email,
          joinedAt: new Date(),
        });
      }
      await meeting.save();

      socket.join(code);
      socket.data.room = code;

      if (!rooms.has(code)) rooms.set(code, new Map());
      const room = rooms.get(code);
      room.set(socket.id, socket.user);

      // Tell the newcomer who is already here (for WebRTC offer initiation).
      const others = [...room.entries()]
        .filter(([id]) => id !== socket.id)
        .map(([id, u]) => ({ socketId: id, ...u }));
      socket.emit("meeting:peers", others);

      // Notify the room of the new participant.
      socket.to(code).emit("meeting:peer-joined", {
        socketId: socket.id,
        ...socket.user,
      });

      io.to(code).emit("meeting:presence", {
        count: room.size,
        participants: [...room.values()],
      });
    });

    // ---- WebRTC signaling relay (offer / answer / ICE) ----
    socket.on("webrtc:offer", ({ to, sdp }) => {
      io.to(to).emit("webrtc:offer", { from: socket.id, sdp, user: socket.user });
    });
    socket.on("webrtc:answer", ({ to, sdp }) => {
      io.to(to).emit("webrtc:answer", { from: socket.id, sdp });
    });
    socket.on("webrtc:ice", ({ to, candidate }) => {
      io.to(to).emit("webrtc:ice", { from: socket.id, candidate });
    });

    // ---- In-meeting chat (persisted) ----
    socket.on("chat:message", async ({ code, text }) => {
      if (!code || !text?.trim()) return;
      const meeting = await Meeting.findOne({ code });
      if (!meeting) return;
      const msg = await Message.create({
        meeting: meeting._id,
        sender: socket.user.id,
        senderName: socket.user.name,
        text: text.trim(),
      });
      io.to(code).emit("chat:message", msg.toPublic());
    });

    // ---- Typing indicator (matches MeetingRoom typing UI) ----
    socket.on("chat:typing", ({ code }) => {
      socket.to(code).emit("chat:typing", { user: socket.user });
    });

    // ---- Live captions broadcast (matches AILiveCaptions) ----
    socket.on("captions:update", ({ code, caption }) => {
      socket.to(code).emit("captions:update", { caption, user: socket.user });
    });

    // ---- Media state (mute / camera) for participant list ----
    socket.on("media:state", ({ code, micOn, cameraOn }) => {
      socket.to(code).emit("media:state", {
        socketId: socket.id,
        micOn,
        cameraOn,
      });
    });

    // ---- Board collaboration: a user's current board is treated as a workspace ----
    socket.on("workspace:join", ({ workspaceId }) => {
      if (workspaceId) socket.join(`workspace:${workspaceId}`);
    });

    socket.on("task:changed", ({ workspaceId, task }) => {
      if (workspaceId) socket.to(`workspace:${workspaceId}`).emit("task:changed", task);
    });

    // ---- Leave / disconnect cleanup ----
    const leave = () => {
      const code = socket.data.room;
      if (!code) return;
      const room = rooms.get(code);
      if (room) {
        room.delete(socket.id);
        void Meeting.updateOne(
          { code, "attendees.user": socket.user.id },
          { $set: { "attendees.$.leftAt": new Date() } }
        );
        socket.to(code).emit("meeting:peer-left", { socketId: socket.id });
        io.to(code).emit("meeting:presence", {
          count: room.size,
          participants: [...room.values()],
        });
        if (room.size === 0) rooms.delete(code);
      }
      socket.leave(code);
      socket.data.room = null;
    };

    socket.on("meeting:leave", leave);
    socket.on("disconnect", leave);
  });

  return io;
}
