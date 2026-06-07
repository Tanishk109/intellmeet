// Wrap async route handlers so thrown errors hit the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- Authorization helpers (shared by meeting + AI controllers) ---

/** True if the user owns (hosts) the meeting. */
export function isHost(meeting, user) {
  return meeting.host?.toString() === user._id.toString();
}

/**
 * True if the user may access a meeting: the host, an added participant, or an
 * invitee matched by email (so people invited before they signed up still get in).
 */
export function isMember(meeting, user) {
  if (isHost(meeting, user)) return true;
  if (meeting.participants?.some((p) => p.toString() === user._id.toString())) {
    return true;
  }
  if (meeting.emails && user.email) {
    const invited = meeting.emails
      .toLowerCase()
      .split(/[,\s]+/)
      .filter(Boolean);
    if (invited.includes(user.email.toLowerCase())) return true;
  }
  return false;
}
