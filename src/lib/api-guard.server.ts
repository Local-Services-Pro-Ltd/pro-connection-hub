/**
 * Shared authorization + rate limiting for the public HTTP endpoints
 * (`/api/public/*`).
 *
 * Every public endpoint is read-only and unauthenticated by design, so the
 * guard enforces three things before a handler touches the database:
 *
 *  1. Method allow-list — anything outside it is rejected with 405.
 *  2. Per-visitor rate limit, counted in Postgres (`hit_rate_limit`) so the
 *     limit holds across serverless workers rather than per instance.
 *  3. Optional bearer/secret authorization for privileged endpoints.
 *
 * The IP address is hashed before it is stored, so the rate-limit table never
 * holds a raw address.
 */
import { createHash, timingSafeEqual } from "crypto";

export type GuardOptions = {
  /** Short bucket prefix, e.g. "api:reviews". */
  bucket: string;
  /** Requests allowed per window, per visitor. */
  limit: number;
  /** Rate-limit window in seconds. */
  windowSeconds: number;
  /** Allowed HTTP methods. Defaults to GET/HEAD. */
  methods?: string[];
};

export function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip =
    (forwarded.split(",")[0] ?? "").trim() ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function json(body: unknown, status: number, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(extra ?? {}),
    },
  });
}

export type DenialOutcome =
  | "rate_limited"
  | "method_not_allowed"
  | "unauthorized"
  | "bad_request";

/**
 * Records a denied request so admins can review abuse patterns.
 * Only a truncated hash of the caller IP is stored, never the address.
 * Logging never blocks or fails a response.
 */
export async function logApiDenial(
  request: Request,
  args: {
    bucket: string;
    outcome: DenialOutcome;
    status: number;
    detail?: string;
  },
): Promise<void> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin.from("api_access_events").insert({
      endpoint: new URL(request.url).pathname,
      bucket: args.bucket,
      method: request.method,
      outcome: args.outcome,
      status: args.status,
      ip_hash: clientFingerprint(request),
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 240),
      detail: args.detail ?? null,
    });
  } catch (err) {
    console.error("[api-guard] denial logging failed", err);
  }
}

/**
 * Returns a `Response` when the request must be rejected, or `null` when the
 * handler may proceed.
 */
export async function guardPublicRequest(
  request: Request,
  options: GuardOptions,
): Promise<Response | null> {
  const methods = options.methods ?? ["GET", "HEAD"];
  if (!methods.includes(request.method)) {
    await logApiDenial(request, {
      bucket: options.bucket,
      outcome: "method_not_allowed",
      status: 405,
      detail: `allowed: ${methods.join(", ")}`,
    });
    return json({ error: "method_not_allowed" }, 405, {
      allow: methods.join(", "),
    });
  }

  const bucket = `${options.bucket}:${clientFingerprint(request)}`;

  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin.rpc("hit_rate_limit", {
      p_bucket: bucket,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });
    // A limiter outage must not take the public endpoints down.
    if (!error && data === false) {
      await logApiDenial(request, {
        bucket: options.bucket,
        outcome: "rate_limited",
        status: 429,
        detail: `limit ${options.limit}/${options.windowSeconds}s`,
      });
      return json({ error: "rate_limited" }, 429, {
        "retry-after": String(options.windowSeconds),
      });
    }
  } catch (err) {
    console.error("[api-guard] rate limit check failed", err);
  }

  return null;
}


/** Constant-time comparison for shared-secret endpoints. */
export function secretMatches(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unauthorized = () => json({ error: "unauthorized" }, 401);
export const badRequest = (detail: string) =>
  json({ error: "bad_request", detail }, 400);
