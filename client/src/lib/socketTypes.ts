// Mirrors server/src/sockets/index.js exactly. Keeping the event names and
// payloads in one typed place prevents client/server drift.

export interface PeerInfo {
  socketId: string;
  id: string; // user id
  name: string;
}

export interface SocketUser {
  id: string;
  name: string;
}

// Events the SERVER emits -> client listens for these.
export interface ServerToClient {
  "meeting:peers": (peers: PeerInfo[]) => void;
  "meeting:peer-joined": (peer: PeerInfo) => void;
  "meeting:peer-left": (data: { socketId: string }) => void;
  "meeting:presence": (data: { count: number; participants: SocketUser[] }) => void;
  "webrtc:offer": (data: { from: string; sdp: RTCSessionDescriptionInit; user: SocketUser }) => void;
  "webrtc:answer": (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  "webrtc:ice": (data: { from: string; candidate: RTCIceCandidateInit }) => void;
  "chat:message": (msg: {
    id: string;
    meeting: string;
    sender: string;
    senderName: string;
    text: string;
    createdAt: string;
  }) => void;
  "chat:typing": (data: { user: SocketUser }) => void;
  "captions:update": (data: { caption: string; user: SocketUser }) => void;
  "media:state": (data: { socketId: string; micOn: boolean; cameraOn: boolean }) => void;
}

// Events the CLIENT emits -> server listens for these.
export interface ClientToServer {
  "meeting:join": (data: { code: string }) => void;
  "meeting:leave": () => void;
  "webrtc:offer": (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  "webrtc:answer": (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  "webrtc:ice": (data: { to: string; candidate: RTCIceCandidateInit }) => void;
  "chat:message": (data: { code: string; text: string }) => void;
  "chat:typing": (data: { code: string }) => void;
  "captions:update": (data: { code: string; caption: string }) => void;
  "media:state": (data: { code: string; micOn: boolean; cameraOn: boolean }) => void;
}
