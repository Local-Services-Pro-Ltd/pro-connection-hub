/**
 * Waiting-list confirmation email (double opt-in). Server-only.
 *
 * Sending goes live automatically the moment the sender domain
 * (tradesmanfinder.org) is verified and an API key is present — no code change
 * needed. Until then `sent: false` comes back and the sign-up flow falls back
 * to accepting the entry without the confirmation step, so nobody is lost.
 *
 * Unsubscribe / manage-updates: the mail platform appends the preference link
 * to the footer of every app email automatically, so we must not build our own
 * unsubscribe page — the template below simply must not strip that footer.
 */

const FROM = "TradesmanFinder <hello@tradesmanfinder.org>";

function apiKey() {
  return (
    process.env["RESEND_API_KEY"] ??
    process.env["EMAIL_API_KEY"] ??
    process.env["LOVABLE_EMAIL_API_KEY"] ??
    ""
  );
}

/** True when a sender is configured, i.e. we can actually deliver mail. */
export function emailEnabled() {
  return Boolean(apiKey());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function template(opts: {
  name: string | undefined;
  postcode: string;
  role: "homeowner" | "trader";
  confirmUrl: string;
}) {
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi there,";
  const who =
    opts.role === "trader"
      ? "get you set up with local work"
      : "help you find a trusted local tradesman";

  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f4f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b1a19">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#b4531f;margin:0 0 24px">TradesmanFinder</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">Confirm your waiting-list place</h1>
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px">
      Thanks for joining the waiting list for <strong>${escapeHtml(opts.postcode)}</strong>.
      One quick step and you're in — confirm your email address so we can ${who}
      the moment we open in your area.
    </p>
    <p style="margin:28px 0">
      <a href="${opts.confirmUrl}" style="display:inline-block;background:#c85a22;color:#fff;text-decoration:none;padding:14px 26px;border-radius:4px;font-weight:600">Confirm my email</a>
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">
      Or paste this link into your browser:<br>
      <a href="${opts.confirmUrl}" style="color:#b4531f">${escapeHtml(opts.confirmUrl)}</a>
    </p>
    <p style="margin:24px 0 0;font-size:14px;color:#57534e">
      What happens next: we email you once when your postcode goes live. Nothing
      else — and you can stop updates at any time from the link below.
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#8a827c">
      If you didn't sign up, ignore this email and nothing further happens.
    </p>
  </div>
</body></html>`;
}

export async function sendWaitingListConfirmation(payload: {
  email: string;
  name: string | undefined;
  postcode: string;
  role: "homeowner" | "trader";
  confirmUrl: string;
}): Promise<{ sent: boolean }> {
  const key = apiKey();
  if (!key) {
    console.info(
      `[waiting-list] confirmation email pending sender-domain setup (${payload.role}, ${payload.postcode})`,
    );
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [payload.email],
        subject: "Confirm your TradesmanFinder waiting-list place",
        html: template(payload),
      }),
    });
    if (!response.ok) {
      console.error(
        "[waiting-list] confirmation email rejected",
        response.status,
      );
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("[waiting-list] confirmation email failed", error);
    return { sent: false };
  }
}
