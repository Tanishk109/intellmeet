# Slice 2 — Schedule + Meetings (create → join loop)

This slice completes the core meeting loop: create a meeting → see it in a
searchable/filterable list → join it (routes into the room) → delete it.
Everything is wired to the backend via TanStack Query.

## Files in this zip (drop into `client/`, preserving paths)

**New:**
- `src/pages/Schedule.tsx` — schedule form (title, date, time, type, invitees,
  description) with validation, email chips, and a create mutation that
  invalidates the meetings + analytics caches.
- `src/pages/Meetings.tsx` — list with search, status filter (all/live/
  scheduled/ended), copy-code, join/review, and host-only delete with a
  confirm dialog.
- `src/components/ui/Select.tsx` — `Select` + `Textarea` primitives.
- `src/components/ui/ConfirmDialog.tsx` — dependency-free modal confirm.
- `src/lib/meetings.ts` — shared helpers (types list, status tone, date format,
  email parsing).

**Changed:**
- `src/App.tsx` — `/app/meetings` and `/app/schedule` now use the real pages
  (previously placeholders). `/app/room/:code` is still a placeholder until the
  WebRTC slice.

## After copying

```bash
cd client
npm run typecheck   # should pass clean
npm run dev
```

Then: Dashboard → "Schedule meeting" → fill the form → it appears in Meetings →
"Join" routes to the room placeholder (the next slice makes that live).

## Suggested commit (matches the brief's semantic-commit guidance)

```bash
git add client/src
git commit -m "feat: schedule meeting form and meetings list with search, filter, delete"
```

## Verified

- `tsc --noEmit` passes (0 errors)
- production `vite build` succeeds

## Next slice options

- **Live Meeting Room** (WebRTC video + chat + presence) — the demo centerpiece.
- **AI Intelligence** (summary + action items, F03).
- **Kanban board** (F06).
