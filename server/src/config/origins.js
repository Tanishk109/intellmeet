const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";

export function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

export function allowedOrigins() {
  const raw = process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN;
  return raw
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins().includes(normalizeOrigin(origin));
}
