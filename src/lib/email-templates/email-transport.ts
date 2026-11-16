import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";

// Server-only. Resend when RESEND_API_KEY is set (self-hosted production),
// otherwise Lovable's managed email API (preview).

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  senderDomain: string;
  template: string;
  purpose: "transactional";
  idempotencyKey: string;
  replyTo?: string;
};

export type DeliveryResult = { sent: true } | { sent: false; reason: "recipient_suppressed" };

export class TransportError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "TransportError";
  }
}

type Env = Record<string, string | undefined>;
const envOf = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};

export function emailProvider(e: Env = envOf()): "resend" | "lovable" | null {
  if (e["RESEND_API_KEY"]) return "resend";
  if (e["LOVABLE_API_KEY"]) return "lovable";
  return null;
}

const tagValue = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);

export function mapResendError(
  status: number,
  body: string,
  retryAfter: string | null,
): TransportError | "suppressed" {
  const lower = body.toLowerCase();
  if (status === 422 && lower.includes("suppress")) return "suppressed";
  const ra = retryAfter ? Number(retryAfter) : NaN;
  if (status === 403 && lower.includes("domain"))
    return new TransportError(body, "domain_not_verified", status);
  if (status === 401 || status === 403) return new TransportError(body, "emails_disabled", status);
  if (status === 422) return new TransportError(body, "validation_error", status);
  if (status === 429)
    return new TransportError(body, "rate_limited", status, Number.isFinite(ra) ? ra : null);
  return new TransportError(body || `Resend error ${status}`, "send_failed", status);
}

export async function deliverEmail(
  email: OutgoingEmail,
  e: Env = envOf(),
): Promise<DeliveryResult> {
  const provider = emailProvider(e);
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${e["RESEND_API_KEY"]}`,
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        tags: [
          { name: "purpose", value: tagValue(email.purpose) },
          { name: "template", value: tagValue(email.template) },
        ],
      }),
    });
    if (res.ok) return { sent: true };
    const mapped = mapResendError(res.status, await res.text(), res.headers.get("retry-after"));
    if (mapped === "suppressed") return { sent: false, reason: "recipient_suppressed" };
    throw mapped;
  }
  if (provider === "lovable") {
    try {
      await sendLovableEmail(
        {
          to: email.to,
          from: email.from,
          sender_domain: email.senderDomain,
          subject: email.subject,
          html: email.html,
          text: email.text,
          purpose: email.purpose,
          label: email.template,
          idempotency_key: email.idempotencyKey,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        },
        { apiKey: e["LOVABLE_API_KEY"]!, sendUrl: e["LOVABLE_SEND_URL"] },
      );
    } catch (error) {
      if (error instanceof EmailAPIError && error.code === "recipient_suppressed")
        return { sent: false, reason: "recipient_suppressed" };
      throw error;
    }
    return { sent: true };
  }
  throw new TransportError(
    "No email provider configured (RESEND_API_KEY or LOVABLE_API_KEY)",
    "emails_disabled",
    503,
  );
}
