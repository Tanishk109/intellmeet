# IntellMeet — Backend (Express + MongoDB + JWT + Socket.io)

Production-style MERN backend for the **IntellMeet** frontend. It implements the
feature set described in the Zidio project brief: JWT auth (with refresh tokens
+ bcrypt), real-time video **signaling** + chat over Socket.io, AI meeting
intelligence (summary + action items, with an optional OpenAI path), meetings
CRUD, notifications, analytics, and profile.

The data shapes returned by the API are designed to **match the React frontend
exactly** so wiring it up requires minimal change. For example, a meeting's
`id` field is the human-readable `MT-xxxx` code the `ScheduleMeeting` page
already uses.

---

## 1. Requirements

- Node.js 18+ (uses native `fetch`)
- MongoDB (local `mongod`, Docker, or MongoDB Atlas)

## 2. Setup

```bash
cd server
cp .env.example .env        # then edit values (especially MONGO_URI + JWT secrets)
npm install
npm run seed                # optional: creates demo user + the 2 demo meetings
npm run dev                 # starts on http://localhost:5000
```

Demo login after seeding: `demo@intellmeet.io` / `demo1234`.

Health check: `GET http://localhost:5000/api/health`.

## 3. Environment variables

See `.env.example`. Key ones: `MONGO_URI`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CLIENT_ORIGIN` (the Vite dev origin, default
`http://localhost:5173`). Set `OPENAI_API_KEY` to switch AI from the built-in
mock to real OpenAI calls — leave it blank and everything still works with mock
responses (no key needed for the demo).

## 4. Auth model

- Access token (short-lived) returned in the JSON body → frontend sends it as
  `Authorization: Bearer <token>`.
- Refresh token (long-lived) stored in an **httpOnly cookie** scoped to
  `/api/auth`; the bcrypt hash is kept on the user document and rotated on every
  refresh and cleared on logout.

## 5. REST API reference

All non-auth routes require `Authorization: Bearer <accessToken>`.
Responses are `{ success, ... }`; errors are `{ success:false, message }`.

### Auth — `/api/auth`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/signup` | `{name,email,password}` | returns `{accessToken,user}` |
| POST | `/login` | `{email,password}` | returns `{accessToken,user}` |
| POST | `/refresh` | – (cookie) | rotates tokens |
| POST | `/logout` | – | clears refresh cookie |
| GET | `/me` | – | current user |
| POST | `/forgot-password` | `{email}` | always 200 (no enumeration) |

### Meetings — `/api/meetings`
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | – | meetings where you're host/participant |
| POST | `/` | `{title,date,time,type,description,emails}` | **matches ScheduleMeeting form** |
| GET | `/:code` | – | one meeting by `MT-xxxx` |
| PUT | `/:code` | partial fields | host only |
| DELETE | `/:code` | – | host only |
| POST | `/:code/start` | – | status → `live` |
| POST | `/:code/end` | – | status → `ended` |

### AI — `/api/ai`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/meetings/:code/summary` | `{transcript}` | generates/updates summary + action items |
| GET | `/meetings/:code/summary` | – | fetch stored summary (for AISummary page) |
| PATCH | `/summaries/:id/action-items/:itemId` | `{done}` | toggle action item |
| POST | `/chat` | `{message}` | powers the AIChatbot widget |

### Misc
| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications` | Notifications page |
| PATCH | `/api/notifications/:id/read` | mark one read |
| PATCH | `/api/notifications/read-all` | mark all read |
| GET | `/api/analytics` | Dashboard/Analytics charts (recharts-ready `weekly[]`) |
| PUT | `/api/profile` | `{name,avatar}` |

## 6. Socket.io events (real-time meeting room)

Connect with the access token:

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: accessToken } });
```

| Direction | Event | Payload |
|---|---|---|
| emit | `meeting:join` | `{code}` |
| on | `meeting:peers` | existing peers (initiate WebRTC offers to these) |
| on | `meeting:peer-joined` / `meeting:peer-left` | `{socketId,id,name}` |
| on | `meeting:presence` | `{count,participants}` |
| emit/on | `webrtc:offer` / `webrtc:answer` / `webrtc:ice` | `{to,sdp}` / `{to,candidate}` |
| emit/on | `chat:message` | `{code,text}` → broadcast persisted message |
| emit/on | `chat:typing` | `{code}` |
| emit/on | `captions:update` | `{code,caption}` |
| emit/on | `media:state` | `{code,micOn,cameraOn}` |
| emit | `meeting:leave` | – |

The relay implements mesh WebRTC signaling — the current frontend only renders
the local camera, so see `FRONTEND_INTEGRATION.md` for how to upgrade
`MeetingRoom.jsx` to real multi-party video.

## 7. Project structure

```
server/
  src/
    config/db.js            Mongo connection
    models/                 User, Meeting, Message, Summary, Notification
    controllers/            auth, meeting, ai, misc
    routes/                 mounted under /api/*
    middleware/             auth (JWT + roles), error handling
    sockets/                Socket.io: signaling, chat, presence, captions
    utils/                  tokens, helpers, seed
    app.js                  express app (helmet, cors, rate-limit, morgan)
    index.js                http server + sockets bootstrap
```

## 8. Security (per the brief)

helmet, CORS locked to `CLIENT_ORIGIN`, bcrypt password hashing, JWT access +
rotating refresh tokens, per-route rate limiting (stricter on auth), no secrets
in responses, input validation, and authenticated Socket.io connections.
