export function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  // Mongoose duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${Object.keys(err.keyValue || {}).join(", ")}`,
    });
  }
  // Mongoose validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((e) => e.message).join(", "),
    });
  }

  if (status >= 500) console.error("[error]", err);

  res.status(status).json({ success: false, message: err.message || "Server error" });
}
