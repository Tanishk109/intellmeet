import dns from "node:dns";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

// Email delivery supports Gmail API first, then Gmail SMTP, then Resend as a
// fallback. If no provider is configured, invites are logged instead of failing
// so meeting creation still works in local development and tests.

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_GMAIL_USER = "tanishkmittal183@gmail.com";

// Render's network can expose IPv6 DNS answers even when outbound IPv6 is not
// reachable. Prefer IPv4 so Gmail SMTP does not fail with ENETUNREACH on IPv6.
dns.setDefaultResultOrder?.("ipv4first");

function lookupIPv4(hostname, options, callback) {
  dns.lookup(hostname, { ...options, family: 4, all: false }, callback);
}

function hasResend() {
  return Boolean(process.env.RESEND_API_KEY);
}

function hasGmailApi() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
  );
}

function gmailUser() {
  return process.env.GMAIL_USER || DEFAULT_GMAIL_USER;
}

function hasGmailSmtp() {
  return Boolean(process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_SMTP_PASSWORD);
}

function fromAddress() {
  return process.env.MAIL_FROM || `IntellMeet <${gmailUser()}>`;
}

let gmailTransporter;

function getGmailTransporter() {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      host: process.env.GMAIL_SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.GMAIL_SMTP_PORT || 587),
      secure: false,
      requireTLS: true,
      family: 4,
      lookup: lookupIPv4,
      auth: {
        user: gmailUser(),
        pass: process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_SMTP_PASSWORD,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  }
  return gmailTransporter;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function detailRow(label, value) {
  if (!value) return "";
  return `<tr><td style="padding:6px 0;color:#9fb0d0">${label}</td><td style="padding:6px 0;color:#eef2ff">${escapeHtml(value)}</td></tr>`;
}

function cleanHeader(value = "") {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value = "") {
  const clean = cleanHeader(value);
  return /^[\x00-\x7F]*$/.test(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean).toString("base64")}?=`;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawEmail({ from, to, subject, text, html }) {
  const boundary = `intellmeet-${randomUUID()}`;
  return [
    `From: ${cleanHeader(from)}`,
    `To: ${cleanHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text || "",
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html || "",
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function getGmailApiAccessToken() {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`token ${res.status}: ${body}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("token response did not include access_token");
  return data.access_token;
}

async function sendWithGmailApi({ from, to, subject, html, text }) {
  const accessToken = await getGmailApiAccessToken();
  const raw = base64Url(buildRawEmail({ from, to, subject, html, text }));

  const res = await fetch(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`send ${res.status}: ${body}`);
  }
}

/**
 * Send one email. Returns { sent: boolean }. Never throws on a provider error —
 * a meeting must still be created even if the invite email fails.
 */
export async function sendEmail({ to, subject, html, text }) {
  const from = fromAddress();

  if (process.env.NODE_ENV === "test") {
    console.log(`[mail:test] would send from ${from} to ${to}: ${subject}`);
    return { sent: false, reason: "test" };
  }

  if (hasGmailApi()) {
    try {
      await sendWithGmailApi({ from, to, subject, html, text });
      return { sent: true, provider: "gmail_api" };
    } catch (err) {
      console.error("[mail] Gmail API send failed:", err.message);
    }
  }

  if (hasGmailSmtp()) {
    try {
      await getGmailTransporter().sendMail({ from, to, subject, html, text });
      return { sent: true, provider: "gmail" };
    } catch (err) {
      console.error("[mail] Gmail SMTP send failed:", err.message);
      return { sent: false, reason: "gmail_error" };
    }
  }

  if (hasResend()) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[mail] Resend error ${res.status}: ${body}`);
        return { sent: false, reason: "resend_error" };
      }
      return { sent: true, provider: "resend" };
    } catch (err) {
      console.error("[mail] Resend send failed:", err.message);
      return { sent: false, reason: "network_error" };
    }
  }

  console.log(
    `[mail:dev] (no GMAIL_APP_PASSWORD or RESEND_API_KEY) would send from ${from} to ${to}: ${subject}`
  );
  return { sent: false, reason: "no_provider" };
}

/** Branded HTML for a meeting invitation. */
export function meetingInviteEmail({
  hostName,
  hostEmail,
  title,
  date,
  time,
  timezone,
  type,
  code,
  joinUrl,
  description,
}) {
  const subject = `Meeting invite: ${title}`;
  const text = [
    `${hostName} (${hostEmail}) invited you to a meeting on IntellMeet.`,
    ``,
    `Title: ${title}`,
    `When: ${date} at ${time}`,
    timezone ? `Timezone: ${timezone}` : "",
    `Type: ${type}`,
    description ? `Agenda: ${description}` : "",
    `Meeting code: ${code}`,
    ``,
    `Join: ${joinUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const safeTitle = escapeHtml(title);
  const safeHostName = escapeHtml(hostName);
  const safeJoinUrl = escapeHtml(joinUrl);
  const safeDescription = escapeHtml(description);

  const html = `
  <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:520px;margin:auto;background:#0a0e1a;color:#eef2ff;border-radius:16px;overflow:hidden;border:1px solid #1e2840">
    <div style="padding:24px 28px;background:linear-gradient(135deg,#0d9488,#14b8a6)">
      <h1 style="margin:0;font-size:18px;color:#06080f">IntellMeet</h1>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 8px;color:#9fb0d0">${safeHostName} invited you to a meeting</p>
      <h2 style="margin:0 0 16px;font-size:22px">${safeTitle}</h2>
      <table style="width:100%;font-size:14px;color:#9fb0d0;border-collapse:collapse">
        ${detailRow("Host", `${hostName} <${hostEmail}>`)}
        ${detailRow("When", `${date} at ${time}`)}
        ${detailRow("Timezone", timezone)}
        ${detailRow("Type", type)}
        <tr><td style="padding:6px 0;color:#9fb0d0">Meeting code</td><td style="padding:6px 0;color:#eef2ff;font-family:monospace">${escapeHtml(code)}</td></tr>
      </table>
      ${
        safeDescription
          ? `<div style="margin-top:18px;padding:14px;border-radius:10px;background:#121a2e;border:1px solid #1e2840">
              <div style="font-size:12px;color:#9fb0d0;margin-bottom:6px">Agenda / details</div>
              <div style="font-size:14px;line-height:1.5;color:#eef2ff;white-space:pre-wrap">${safeDescription}</div>
            </div>`
          : ""
      }
      <a href="${safeJoinUrl}" style="display:inline-block;margin-top:24px;background:#14b8a6;color:#06080f;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px">Join meeting</a>
      <p style="margin:20px 0 0;font-size:12px;color:#5d6b8a">Or paste this link: ${safeJoinUrl}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#5d6b8a">Sent by IntellMeet from ${escapeHtml(gmailUser())}.</p>
    </div>
  </div>`;

  return { subject, text, html };
}
