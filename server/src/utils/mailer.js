// Email via Resend (https://resend.com). Uses their HTTP API directly (native
// fetch, no SDK dependency). If RESEND_API_KEY is unset, invites are logged to
// the console instead of failing — so local dev and the demo work with no setup.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function hasResend() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Send one email. Returns { sent: boolean }. Never throws on a provider error —
 * a meeting must still be created even if the invite email fails.
 */
export async function sendEmail({ to, subject, html, text }) {
  // From address must be on a domain you've verified in Resend. Their sandbox
  // sender "onboarding@resend.dev" works for testing without domain setup.
  const from = process.env.MAIL_FROM || "IntellMeet <onboarding@resend.dev>";

  if (!hasResend()) {
    console.log(`[mail:dev] (no RESEND_API_KEY) would send to ${to}: ${subject}`);
    return { sent: false, reason: "no_api_key" };
  }

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
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[mail] send failed:", err.message);
    return { sent: false, reason: "network_error" };
  }
}

/** Branded HTML for a meeting invitation. */
export function meetingInviteEmail({ hostName, title, date, time, type, code, joinUrl }) {
  const subject = `${hostName} invited you to "${title}"`;
  const text = [
    `${hostName} invited you to a meeting on IntellMeet.`,
    ``,
    `${title}`,
    `When: ${date} at ${time}`,
    `Type: ${type}`,
    `Meeting code: ${code}`,
    ``,
    `Join: ${joinUrl}`,
  ].join("\n");

  const html = `
  <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:520px;margin:auto;background:#0a0e1a;color:#eef2ff;border-radius:16px;overflow:hidden;border:1px solid #1e2840">
    <div style="padding:24px 28px;background:linear-gradient(135deg,#0d9488,#14b8a6)">
      <h1 style="margin:0;font-size:18px;color:#06080f">IntellMeet</h1>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 8px;color:#9fb0d0">${hostName} invited you to a meeting</p>
      <h2 style="margin:0 0 16px;font-size:22px">${title}</h2>
      <table style="width:100%;font-size:14px;color:#9fb0d0;border-collapse:collapse">
        <tr><td style="padding:4px 0">📅 When</td><td style="color:#eef2ff">${date} at ${time}</td></tr>
        <tr><td style="padding:4px 0">🏷️ Type</td><td style="color:#eef2ff">${type}</td></tr>
        <tr><td style="padding:4px 0">🔑 Code</td><td style="color:#eef2ff;font-family:monospace">${code}</td></tr>
      </table>
      <a href="${joinUrl}" style="display:inline-block;margin-top:24px;background:#14b8a6;color:#06080f;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px">Join meeting</a>
      <p style="margin:20px 0 0;font-size:12px;color:#5d6b8a">Or paste this link: ${joinUrl}</p>
    </div>
  </div>`;

  return { subject, text, html };
}
