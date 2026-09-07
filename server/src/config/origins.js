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

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function vercelPreviewPrefixes() {
  return allowedOrigins()
    .map(hostnameFromOrigin)
    .filter((host) => host.endsWith(".vercel.app"))
    .map((host) => host.replace(/\.vercel\.app$/, ""))
    .filter(Boolean);
}

function isAllowedVercelPreview(origin) {
  const host = hostnameFromOrigin(origin);
  if (!host.endsWith(".vercel.app")) return false;

  return vercelPreviewPrefixes().some(
    (prefix) => host === `${prefix}.vercel.app` || host.startsWith(`${prefix}-`)
  );
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins().includes(normalized) || isAllowedVercelPreview(normalized);
}
