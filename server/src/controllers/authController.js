import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";

const REFRESH_COOKIE = "refreshToken";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth",
  };
}

export async function issueTokens(res, user) {
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return accessToken;
}

// POST /api/auth/signup
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, "name, email and password are required");
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, "Email already registered");

  const user = await User.create({ name, email, password });
  const accessToken = await issueTokens(res, user);

  res.status(201).json({ success: true, accessToken, user: user.toPublic() });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "email and password are required");

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessToken = await issueTokens(res, user);
  res.json({ success: true, accessToken, user: user.toPublic() });
});

// POST /api/auth/refresh  (uses httpOnly cookie)
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, "No refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }

  const user = await User.findById(payload.sub).select("+refreshTokenHash");
  if (!user || !user.refreshTokenHash) throw new ApiError(401, "Session expired");

  const match = await bcrypt.compare(token, user.refreshTokenHash);
  if (!match) throw new ApiError(401, "Session expired");

  const accessToken = await issueTokens(res, user); // rotate
  res.json({ success: true, accessToken, user: user.toPublic() });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await User.findByIdAndUpdate(payload.sub, { refreshTokenHash: null });
    } catch {
      /* ignore */
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ success: true, message: "Logged out" });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toPublic() });
});

// POST /api/auth/forgot-password  (stub matching the ForgotPassword page)
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "email is required");
  // In production: generate a reset token and email it. We always 200 to avoid
  // leaking which emails exist.
  res.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
});
