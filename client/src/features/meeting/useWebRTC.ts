import { useCallback, useEffect, useRef, useState } from "react";
import { createSocket, type AppSocket } from "@/lib/socket";

const ICE_SERVERS: RTCConfiguration = {
  // Public STUN is fine for development / same-network demos. For participants
  // behind strict NATs in production, add a TURN server here.
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export interface RemotePeer {
  socketId: string;
  name: string;
  stream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
}

interface UseWebRTCResult {
  localStream: MediaStream | null;
  remotePeers: RemotePeer[];
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  participantCount: number;
  error: string | null;
  socket: AppSocket | null;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleShare: () => Promise<void>;
  leave: () => void;
}

/**
 * Manages a full-mesh WebRTC session for one meeting room.
 *
 * Signaling contract (see server/src/sockets/index.js):
 *  - On join we receive `meeting:peers` (everyone already here). WE are the
 *    initiator toward each of them: create a peer connection + send an offer.
 *  - When someone new joins after us we get `meeting:peer-joined`; THEY will
 *    send US the offer, so we just wait. This split prevents "glare".
 */
export function useWebRTC(code: string | undefined, displayName: string): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Reactive mirror of the socket ref so consumers (chat panel) re-render once
  // the connection exists.
  const [socket, setSocket] = useState<AppSocket | null>(null);

  const socketRef = useRef<AppSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const namesRef = useRef<Map<string, string>>(new Map());

  // --- helpers to update a single remote peer immutably ---
  const upsertPeer = useCallback((socketId: string, patch: Partial<RemotePeer>) => {
    setRemotePeers((prev) => {
      const idx = prev.findIndex((p) => p.socketId === socketId);
      if (idx === -1) {
        return [
          ...prev,
          {
            socketId,
            name: namesRef.current.get(socketId) ?? "Guest",
            stream: null,
            micOn: true,
            cameraOn: true,
            ...patch,
          },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removePeer = useCallback((socketId: string) => {
    peersRef.current.get(socketId)?.close();
    peersRef.current.delete(socketId);
    namesRef.current.delete(socketId);
    setRemotePeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  // --- create (or fetch) a peer connection toward a given socket ---
  const makePeer = useCallback(
    (socketId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(socketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Push our local tracks so the remote side receives our audio/video.
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current?.emit("webrtc:ice", {
            to: socketId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (e) => {
        upsertPeer(socketId, { stream: e.streams[0] });
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          // Let presence/peer-left drive removal; nothing forced here.
        }
      };

      peersRef.current.set(socketId, pc);
      return pc;
    },
    [upsertPeer]
  );

  // --- main effect: acquire media, connect socket, wire signaling ---
  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const socket = createSocket();
    socketRef.current = socket;
    setSocket(socket);

    async function start() {
      // 1) Local camera + mic.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setError("Camera/microphone access was denied. Enable it to join with video.");
        // Continue with an empty stream so signaling still works (receive-only).
        stream = new MediaStream();
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);

      // 2) Connect + join the room.
      socket.connect();
      socket.emit("meeting:join", { code: code! });

      // 3) We are initiator toward everyone already present.
      socket.on("meeting:peers", async (peers) => {
        for (const peer of peers) {
          namesRef.current.set(peer.socketId, peer.name);
          upsertPeer(peer.socketId, { name: peer.name });
          const pc = makePeer(peer.socketId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc:offer", { to: peer.socketId, sdp: offer });
        }
      });

      // 4) Someone joined after us — record their name; they'll offer to us.
      socket.on("meeting:peer-joined", (peer) => {
        namesRef.current.set(peer.socketId, peer.name);
        upsertPeer(peer.socketId, { name: peer.name });
      });

      // 5) Inbound offer -> answer.
      socket.on("webrtc:offer", async ({ from, sdp, user }) => {
        namesRef.current.set(from, user.name);
        upsertPeer(from, { name: user.name });
        const pc = makePeer(from);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { to: from, sdp: answer });
      });

      // 6) Inbound answer.
      socket.on("webrtc:answer", async ({ from, sdp }) => {
        const pc = peersRef.current.get(from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      });

      // 7) Inbound ICE.
      socket.on("webrtc:ice", async ({ from, candidate }) => {
        const pc = peersRef.current.get(from);
        try {
          await pc?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          /* candidate may arrive before remote desc; browser retries internally */
        }
      });

      // 8) Presence + departures + remote media state.
      socket.on("meeting:presence", ({ count }) => setParticipantCount(count));
      socket.on("meeting:peer-left", ({ socketId }) => removePeer(socketId));
      socket.on("media:state", ({ socketId, micOn: m, cameraOn: c }) =>
        upsertPeer(socketId, { micOn: m, cameraOn: c })
      );
    }

    void start();

    return () => {
      cancelled = true;
      socket.emit("meeting:leave");
      socket.removeAllListeners();
      socket.disconnect();
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      socketRef.current = null;
      setSocket(null);
    };
  }, [code, displayName, makePeer, removePeer, upsertPeer]);

  // --- controls ---
  const broadcastState = useCallback(
    (m: boolean, c: boolean) => {
      if (code) socketRef.current?.emit("media:state", { code, micOn: m, cameraOn: c });
    },
    [code]
  );

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    broadcastState(track.enabled, cameraOn);
  }, [broadcastState, cameraOn]);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
    broadcastState(micOn, track.enabled);
  }, [broadcastState, micOn]);

  // Replace the outgoing video track on every peer connection (screen <-> cam).
  const replaceVideoTrack = useCallback((newTrack: MediaStreamTrack) => {
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      void sender?.replaceTrack(newTrack);
    });
  }, []);

  const toggleShare = useCallback(async () => {
    if (sharing) {
      // Stop sharing -> go back to camera.
      const cam = cameraTrackRef.current;
      if (cam) replaceVideoTrack(cam);
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      replaceVideoTrack(screenTrack);
      setSharing(true);
      // When the user clicks the browser's native "Stop sharing", revert.
      screenTrack.onended = () => {
        const cam = cameraTrackRef.current;
        if (cam) replaceVideoTrack(cam);
        setSharing(false);
      };
    } catch {
      /* user cancelled the picker */
    }
  }, [sharing, replaceVideoTrack]);

  const leave = useCallback(() => {
    socketRef.current?.emit("meeting:leave");
    socketRef.current?.disconnect();
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return {
    localStream,
    remotePeers,
    micOn,
    cameraOn,
    sharing,
    participantCount,
    error,
    socket,
    toggleMic,
    toggleCamera,
    toggleShare,
    leave,
  };
}
