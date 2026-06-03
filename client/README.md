# IntellMeet — Client (React 19 + TypeScript + Vite)

The frontend for IntellMeet, rebuilt on the stack the project brief specifies:
**React 19 + TypeScript + Vite**, **Tailwind CSS v4**, **Zustand** (client state)
and **TanStack Query** (server state), with shadcn-style UI primitives and
**Socket.io client** ready for the real-time meeting room.

This is **build slice 1 of N**: the foundation, auth flow, app shell, and a
live dashboard — all wired to the Express backend (see `../server`). Remaining
screens (meetings list, schedule, live WebRTC room, AI intelligence, Kanban
board, analytics, notifications) are stubbed with a placeholder and will be
filled in the next slices.

## What works right now

- **Auth**: signup, login, forgot-password → real backend calls
- **Session**: access token kept in memory; silent refresh via the httpOnly
  cookie on 401; session restored on page reload (`bootstrap()`)
- **Protected routing**: `/app/*` is gated behind `RequireAuth`
- **Dashboard**: live stats + weekly chart (recharts) + upcoming meetings,
  fetched from `/api/analytics` and `/api/meetings`
- **Design system**: custom "Signal" dark theme (cyan = real-time, amber = AI),
  tokens in `src/index.css`

## Run it

```bash
# 1) Start the backend first (see ../server/README.md)
cd ../server && npm install && npm run seed && npm run dev   # http://localhost:5000

# 2) Start this client
cd ../client
cp .env.example .env        # leave VITE_API_URL blank to use the dev proxy
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` and `/socket.io` to `localhost:5000`, so cookies are
same-origin in development (no CORS friction). Log in with the seeded demo
account: **demo@intellmeet.io / demo1234** (button on the login page fills it).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (HMR) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm run preview` | Serve the production build locally |

## Structure

```
src/
  api/            typed service layer (one fn per backend endpoint)
  components/
    ui/           Button, Input, Card, Badge, Spinner, Toast
    layout/       AuthLayout, AppShell
    Logo.tsx
  features/auth/  RequireAuth route guard
  lib/            http (axios + refresh), utils (cn), queryClient
  pages/          Login, Signup, ForgotPassword, Dashboard, Placeholder
  stores/         auth (Zustand)
  types/          shared types mirroring backend toPublic() shapes
```

## Notes for the submission

- The brief grades responsive design + accessibility: inputs have labels,
  buttons have `aria-label`s where icon-only, and the layout is mobile-first.
- Bundle is currently a single chunk; route-level `lazy()` code-splitting will
  be added with the remaining screens to keep initial load < 5s (a brief
  requirement).
- Per the brief's originality rule, treat this as a reference to learn from and
  reimplement in your own commits — not drop-in submission code.
