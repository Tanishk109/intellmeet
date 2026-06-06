# Slice 3 — Live Meeting Room (real multi-party WebRTC video)

The `/app/room/:code` placeholder is now a working video room. Multiple people
who open the same meeting code see and hear each other over peer-to-peer WebRTC,
relayed by the Socket.io signaling the backend already exposes.

## Files in this zip (drop into `client/`, preserving paths)

**New:**
- `src/lib/socketTypes.ts` — typed event contracts mirroring the backend's
  `sockets/index.js` (offer/answer/ice, presence, peer-joined/left, media:state).
- `src/lib/socket.ts` — authenticated socket factory (sends the JWT access token
  in `auth.token`, same as the REST API).
- `src/features/meeting/useWebRTC.ts` — the core hook: acquires camera/mic,
  builds a full mesh of `RTCPeerConnection`s, handles the initiator pattern
  (offer to existing peers, answer to newcomers), ICE, mute/camera toggles, and
  screen-share via `replaceTrack`.
- `src/features/meeting/VideoTile.tsx` — binds a `MediaStream` to a `<video>`,
  mirrors the local tile, shows an avatar when the camera is off, and overlays
  mic/camera status.
- `src/pages/MeetingRoom.tsx` — responsive video grid, control bar (mic /
  camera / share / leave), participant count, and host Start / End controls.

**Changed:**
- `src/App.tsx` — `/app/room/:code` now renders `MeetingRoom`.

## How the signaling works (so you can explain it in your demo/report)

1. On join, the client emits `meeting:join`. The server replies with
   `meeting:peers` = everyone already in the room.
2. The joiner is the **initiator**: it creates a peer connection per existing
   peer and sends each an `webrtc:offer`. Existing peers answer. This
   initiator-only-toward-older-peers rule prevents "glare" (both sides offering
   at once).
3. ICE candidates are relayed via `webrtc:ice` until the P2P link is direct.
4. `media:state` broadcasts mute/camera changes; `meeting:peer-left` +
   `meeting:presence` keep the roster correct.

## Test it (needs 2 browsers)

```bash
# backend running on :5050 (or :5000), client on :5173
```
1. Log in as the demo user, open a meeting, click **Join**.
2. In a second browser (or an incognito window logged into another account),
   open the same `/app/room/<CODE>`.
3. You should see both tiles, hear audio, and see mute/camera changes reflect
   across windows. Try **Share screen** too.

> Allow camera/mic when the browser prompts. WebRTC requires a secure context:
> `localhost` is treated as secure, so dev works; in production you MUST serve
> over HTTPS (the brief requires HTTPS anyway).
> Public STUN is configured; for users behind strict NATs in production, add a
> TURN server in `useWebRTC.ts` (`ICE_SERVERS`).

## Suggested commit

```bash
git add client/src
git commit -m "feat: live meeting room with multi-party WebRTC video, screen share, and controls"
```

## Verified
- `tsc --noEmit` passes (0 errors)
- production `vite build` succeeds

## Next slice
- In-meeting **chat + typing indicator + live captions** (reuses the same socket).
- Then **AI Intelligence** (F03) and the **Kanban board** (F06).
- A dedicated **code-splitting pass** to bring the bundle under the <5s load bar.
