# Wiring the IntellMeet frontend to this backend

The frontend you submitted is currently a **static UI** — every page holds its
data in `useState` and the Login/Signup forms only call `alert()`. There is no
`fetch`, no socket, and no env config. This guide shows the minimal changes to
make it talk to the backend. Compatibility was a design goal: the API returns
the same field names the UI already uses.

## 0. Install the client deps the integration needs

```bash
cd client
npm install socket.io-client
```

Add a `.env` in `client/`:

```
VITE_API_URL=http://localhost:5000
```

Copy `api.js` (in this folder) to `client/src/lib/api.js`.

## 1. Login (`pages/Login.jsx`)

Replace the fake handler:

```jsx
import { api, setToken } from "../lib/api";
import { useNavigate } from "react-router-dom";
// ...
const navigate = useNavigate();
const handleLogin = async (e) => {
  e.preventDefault();
  if (!email || !password) return alert("Please fill all fields");
  try {
    const { accessToken, user } = await api.login({ email, password });
    setToken(accessToken);
    localStorage.setItem("user", JSON.stringify(user)); // for display only
    navigate("/dashboard");
  } catch (err) {
    alert(err.message);
  }
};
```

Apply the same pattern in `Signup.jsx` (call `api.signup`) and
`ForgotPassword.jsx` (call `api.forgotPassword`).

> Note: `App.jsx` routes `/login` and `/signup`, but no page links to them. Add
> links (e.g. on `Home.jsx`) or make `/login` the default route if you want auth
> to gate the app.

## 2. Schedule meeting (`pages/ScheduleMeeting.jsx`)

The form state (`title,date,time,type,description,emails`) already matches the
POST body. Replace `handleSchedule` and load the real list:

```jsx
import { useEffect } from "react";
import { api } from "../lib/api";

useEffect(() => {
  api.listMeetings().then((d) => setMeetings(d.meetings)).catch(() => {});
}, []);

const handleSchedule = async () => {
  if (!title || !date || !time) return alert("Please fill all required fields 🚨");
  try {
    const { meeting } = await api.createMeeting({ title, date, time, type, description, emails });
    setMeetings([meeting, ...meetings]); // meeting.id is the MT-xxxx code
    alert("Meeting Scheduled Successfully 🚀");
    setTitle(""); setDate(""); setTime(""); setEmails(""); setDescription(""); setType("Team Meeting");
  } catch (err) {
    alert(err.message);
  }
};
```

Because `meeting.id` is the `MT-xxxx` string (same as before), the rest of the
UI keeps working unchanged.

## 3. Dashboard / Analytics

```jsx
import { api } from "../lib/api";
const [stats, setStats] = useState(null);
useEffect(() => { api.analytics().then((d) => setStats(d.analytics)); }, []);
// stats.weekly -> feed directly into your recharts <BarChart data={stats.weekly} />
```

## 4. AI Summary (`pages/AISummary.jsx`)

```jsx
const { summary } = await api.getSummary(code);      // existing summary
// or generate from a transcript:
const { summary } = await api.generateSummary(code, transcript);
// summary.summary, summary.keyPoints[], summary.actionItems[{id,text,assignee,done}]
await api.toggleActionItem(summary.id, itemId, true); // check off an item
```

## 5. AI Chatbot (`components/AIChatbot.jsx`)

Replace the canned reply with:

```jsx
const { reply } = await api.aiChat(input);
setMessages([...messages, { sender: "user", text: input }, { sender: "ai", text: reply }]);
```

## 6. Notifications (`pages/Notifications.jsx`)

```jsx
useEffect(() => { api.notifications().then((d) => setItems(d.notifications)); }, []);
// each item: {id,title,message,type,read,createdAt}
const dismiss = (id) => api.markRead(id).then(() => /* update state */);
```

## 7. Real multi-party video (`pages/MeetingRoom.jsx`)

Today the page only shows your **own** camera via `getUserMedia`. To make it a
real meeting, add the socket signaling. Sketch:

```jsx
import { io } from "socket.io-client";
import { getToken } from "../lib/api";
import { useParams } from "react-router-dom";

const { id: code } = useParams();
const socket = useRef(null);
const peers = useRef({}); // socketId -> RTCPeerConnection

useEffect(() => {
  socket.current = io(import.meta.env.VITE_API_URL, { auth: { token: getToken() } });
  const s = socket.current;

  s.emit("meeting:join", { code });

  // For each existing peer, create an offer.
  s.on("meeting:peers", (list) => list.forEach((p) => createOffer(p.socketId)));
  s.on("meeting:peer-joined", (p) => { /* they'll send us an offer */ });
  s.on("webrtc:offer", async ({ from, sdp }) => {
    const pc = makePeer(from);
    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    s.emit("webrtc:answer", { to: from, sdp: answer });
  });
  s.on("webrtc:answer", ({ from, sdp }) => peers.current[from]?.setRemoteDescription(sdp));
  s.on("webrtc:ice", ({ from, candidate }) => peers.current[from]?.addIceCandidate(candidate));
  s.on("chat:message", (m) => setMessages((prev) => [...prev, m]));
  s.on("captions:update", ({ caption }) => setCaption(caption));

  return () => { s.emit("meeting:leave"); s.disconnect(); };

  function makePeer(socketId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));
    pc.onicecandidate = (e) => e.candidate && s.emit("webrtc:ice", { to: socketId, candidate: e.candidate });
    pc.ontrack = (e) => addRemoteVideo(socketId, e.streams[0]); // render in a grid
    peers.current[socketId] = pc;
    return pc;
  }
  async function createOffer(socketId) {
    const pc = makePeer(socketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    s.emit("webrtc:offer", { to: socketId, sdp: offer });
  }
}, [code]);

// Send chat: socket.current.emit("chat:message", { code, text });
```

`stun:stun.l.google.com:19302` is fine for development; for production add a
TURN server for participants behind strict NATs.

## 8. CORS / cookies

The backend sets `CLIENT_ORIGIN` for CORS and uses an httpOnly refresh cookie.
Keep the frontend on `http://localhost:5173` (or update `CLIENT_ORIGIN` in the
server `.env`), and always call the API with `credentials: "include"` (the
provided `api.js` already does).
