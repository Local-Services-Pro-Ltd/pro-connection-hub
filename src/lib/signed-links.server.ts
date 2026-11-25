import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Private links we email to people who have no account (a homeowner's job
 * page) and one-time invitation tokens for firms. Server only.
 *
 * Unlike the human check, there is no fallback secret: if the service key is
 * missing we refuse to issue or accept a link rather than sign with something
 * guessable.
 */

function secret() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Private links are not configured.");
  return key;
}

function sign(scope: string, value: string) {
  return createHmac("sha256", secret()).update(`${scope}:v1:${value}`).digest("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<job id>.<signature>` — proves we issued the link for exactly this job. */
export function jobLinkToken(jobId: string) {
  return `${jobId}.${sign("job-link", jobId)}`;
}

/** Returns the job id when the token is one we issued, otherwise null. */
export function readJobLinkToken(token: string): string | null {
  const [jobId, signature, ...rest] = (token ?? "").trim().split(".");
  if (!jobId || !signature || rest.length || !UUID.test(jobId)) return null;
  const good = Buffer.from(sign("job-link", jobId));
  const given = Buffer.from(signature);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  return jobId.toLowerCase();
}

/** A random one-time token; only its hash is stored. */
export function newInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Buffer.from(bytes).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256")
    .update(`firm-invite:v1:${(token ?? "").trim()}`)
    .digest("hex");
}
