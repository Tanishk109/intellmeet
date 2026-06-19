import User from "../models/User.js";
import { asyncHandler } from "../utils/helpers.js";
import { issueTokens } from "./authController.js";

// Dependency-free Google OAuth 2.0 (Authorization Code flow). We redirect the
// user to Google, receive a code on the callback, exchange it for an access
// token, fetch their profile, upsert a user, and issue OUR JWTs — then bounce
// back to the frontend with the access token in the URL fragment.

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri() {
  // Must EXACTLY match an Authorized redirect URI in the Google Cloud console.
  const base = process.env.SERVER_URL || "http://localhost:5000";
  return `${base}/api/auth/google/callback`;
}

function frontendUrl() {
  return (process.env.CLIENT_ORIGIN?.split(",")[0]?.trim()) || "http://localhost:5173";
}

// GET /api/auth/google -> redirect to Google's consent screen.
export const googleStart = asyncHandler(async (req, res) => {
  // Not configured? This is an expected operational state, not a server fault —
  // bounce the user back to login with a friendly flag instead of erroring out
  // (which would dump a stack trace and show a raw JSON page on full-page nav).
  if (!googleConfigured()) {
    return res.redirect(`${frontendUrl()}/login?oauth=unavailable`);
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback?code=...
export const googleCallback = asyncHandler(async (req, res) => {
  const fe = frontendUrl();
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${fe}/login?oauth=failed`);
  }

  // 1) Exchange the authorization code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return res.redirect(`${fe}/login?oauth=failed`);
  const { access_token } = await tokenRes.json();

  // 2) Fetch the Google profile.
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileRes.ok) return res.redirect(`${fe}/login?oauth=failed`);
  const profile = await profileRes.json(); // { id, email, name, picture, ... }

  if (!profile.email) return res.redirect(`${fe}/login?oauth=failed`);

  // 3) Upsert the user. If an account with this email already exists (e.g. a
  // local signup), link the Google id to it; otherwise create a new OAuth user.
  let user = await User.findOne({ email: profile.email.toLowerCase() });
  if (user) {
    if (!user.googleId) {
      user.googleId = profile.id;
      user.authProvider = user.authProvider === "local" ? "local" : "google";
      if (!user.avatar && profile.picture) user.avatar = profile.picture;
      await user.save();
    }
  } else {
    user = await User.create({
      name: profile.name || profile.email.split("@")[0],
      email: profile.email.toLowerCase(),
      avatar: profile.picture || "",
      authProvider: "google",
      googleId: profile.id,
    });
  }

  // 4) Issue our own tokens (sets the refresh cookie) and hand the access token
  // to the frontend via the URL fragment (not query) so it stays out of logs.
  const accessToken = await issueTokens(res, user);
  res.redirect(`${fe}/oauth/callback#token=${accessToken}`);
});
