import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

// Reads the access token from the Authorization: Bearer header.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Not authenticated");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "User no longer exists");

  req.user = user;
  next();
});

// Restrict to specific roles, e.g. requireRole("Admin").
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    next();
  };
