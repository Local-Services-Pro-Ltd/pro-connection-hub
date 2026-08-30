import { createFileRoute } from "@tanstack/react-router";
import {
  guardPublicRequest,
  logApiDenial,
  secretMatches,
} from "@/lib/api-guard.server";

/**
 * Alert relay for the CI security job.
 *
 * The GitHub Actions security workflow posts here when the scan fails or the
 * job itself errors; the app then fans the alert out to Slack and the owner
 * email. Callers must present the SECURITY_SCAN_TOKEN shared secret, and the
 * endpoint is rate limited so the secret cannot be brute-forced.
 */
type Body = {
  failures?: { suite?: string; check_name?: string; detail?: string }[];
  total?: number;
  source?: string;
  url?: string;
};

async function handler({ request }: { request: Request }): Promise<Response> {
  const blocked = await guardPublicRequest(request, {
    bucket: "api:security-alert",
    limit: 20,
    windowSeconds: 300,
    methods: ["POST"],
  });
  if (blocked) return blocked;

  const token =
    request.headers.get("x-security-scan-token") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (!secretMatches(token, process.env["SECURITY_SCAN_TOKEN"])) {
    await logApiDenial(request, {
      bucket: "api:security-alert",
      outcome: "unauthorized",
      status: 401,
      detail: "invalid or missing scan token",
    });
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const failures = Array.isArray(body.failures) ? body.failures.slice(0, 50) : [];
  const { sendSecurityAlert } = await import("@/lib/security-alerts.server");
  const result = await sendSecurityAlert({
    failures,
    total: Number(body.total) || failures.length,
    source: String(body.source ?? "ci").slice(0, 60),
    environment: new URL(request.url).host,
    url: typeof body.url === "string" ? body.url.slice(0, 300) : undefined,
  });

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const notAllowed = ({ request }: { request: Request }) =>
  guardPublicRequest(request, {
    bucket: "api:security-alert",
    limit: 20,
    windowSeconds: 300,
    methods: ["POST"],
  }) as Promise<Response>;

export const Route = createFileRoute("/api/public/security-alert")({
  server: {
    handlers: {
      POST: handler,
      GET: notAllowed,
      PUT: notAllowed,
      PATCH: notAllowed,
      DELETE: notAllowed,
    },
  },
});
