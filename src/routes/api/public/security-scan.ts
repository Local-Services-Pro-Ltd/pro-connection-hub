import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Scheduled vulnerability / regression scan endpoint.
 *
 * Runs the database-side security suites (`security_regression_run`), stores
 * the result in `security_scan_runs`, and emails the owner when any check
 * fails. Called by the deployment hook and by a daily schedule; the caller
 * must present the SECURITY_SCAN_TOKEN shared secret.
 */

type CheckRow = {
  suite: string;
  check_name: string;
  passed: boolean | null;
  detail: string;
};

function presentedToken(request: Request): string {
  return (
    request.headers.get("x-security-scan-token") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  );
}

function matchesEnvToken(provided: string): boolean {
  const expected = process.env["SECURITY_SCAN_TOKEN"];
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runScan(request: Request): Promise<Response> {
  const token = presentedToken(request);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let allowed = matchesEnvToken(token);
  if (!allowed && token) {
    // The database scheduler authenticates with its own secret, which never
    // leaves Postgres.
    const { data } = await supabaseAdmin.rpc("security_scan_token_matches", {
      p_token: token,
    });
    allowed = data === true;
  }

  if (!allowed) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { data, error } = await supabaseAdmin.rpc("security_regression_run");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }


  const rows = (data ?? []) as CheckRow[];
  const failures = rows.filter((r) => r.passed === false);
  const source = new URL(request.url).searchParams.get("source") ?? "scheduled";

  let alerted = false;
  if (failures.length > 0) {
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("security-scan-alert", "", {
        templateData: {
          failures,
          total: rows.length,
          ranAt: new Date().toISOString(),
          environment: new URL(request.url).host,
        },
      });
      alerted = true;
    } catch (err) {
      console.error("[security-scan] alert email failed", err);
    }
  }

  await supabaseAdmin.from("security_scan_runs").insert({
    source,
    total: rows.length,
    failed: failures.length,
    results: rows,
    alerted,
  });

  return new Response(
    JSON.stringify({
      ok: failures.length === 0,
      total: rows.length,
      failed: failures.length,
      alerted,
      checks: rows,
    }),
    {
      status: failures.length === 0 ? 200 : 500,
      headers: { "content-type": "application/json" },
    },
  );
}

export const Route = createFileRoute("/api/public/security-scan")({
  server: {
    handlers: {
      GET: ({ request }) => runScan(request),
      POST: ({ request }) => runScan(request),
    },
  },
});
