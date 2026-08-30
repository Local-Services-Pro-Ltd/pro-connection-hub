import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { guardPublicRequest } from "@/lib/api-guard.server";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  daysUntil,
} from "@/lib/application-verification";

/**
 * Scheduled certification maintenance.
 *
 * Re-runs the Companies House / insurance / paperwork checks for a bounded
 * batch of open applications and emails the firm when paperwork is missing,
 * a document was rejected, or insurance is expiring. Every reminder is
 * recorded in `application_reminders` before it is sent, so a re-run never
 * emails the same firm twice for the same thing.
 *
 * Authenticated with the database-held scheduler secret (never leaves
 * Postgres) or the SECURITY_SCAN_TOKEN env secret.
 */

const JOB = "application-maintenance";
const BATCH = 20;
const LEASE_SECONDS = 600;
const SITE = "https://tradesmanfinder.org";

const OPEN = ["pending", "in_review", "changes_requested", "resubmitted"];

type ReminderPlan = {
  kind: string;
  dedupeKey: string;
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

function weekBucket(date = new Date()) {
  return Math.floor(date.getTime() / (7 * 86_400_000)).toString();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function run(request: Request): Promise<Response> {
  const blocked = await guardPublicRequest(request, {
    bucket: "api:application-maintenance",
    limit: 10,
    windowSeconds: 300,
    methods: ["GET", "POST"],
  });
  if (blocked) return blocked;

  const token = presentedToken(request);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let allowed = matchesEnvToken(token);
  if (!allowed && token) {
    const { data } = await supabaseAdmin.rpc("security_scan_token_matches", {
      p_token: token,
    });
    allowed = data === true;
  }
  if (!allowed) {
    const { logApiDenial } = await import("@/lib/api-guard.server");
    await logApiDenial(request, {
      bucket: "api:application-maintenance",
      outcome: "unauthorized",
      status: 401,
      detail: "invalid or missing maintenance token",
    });
    return json({ error: "unauthorized" }, 401);
  }

  // Paused-state guard: a paused job does no work until an admin resumes it.
  const { data: jobRow } = await supabaseAdmin
    .from("background_jobs")
    .select("paused_reason")
    .eq("name", JOB)
    .maybeSingle();
  if (jobRow?.paused_reason) {
    return json({ skipped: "paused", reason: jobRow.paused_reason });
  }

  // Single-flight lease.
  const { data: leased } = await supabaseAdmin.rpc("acquire_job_lease", {
    p_name: JOB,
    p_seconds: LEASE_SECONDS,
  });
  if (leased !== true) return json({ skipped: "locked" });

  let checked = 0;
  let reminders = 0;
  let failed = 0;
  let lastError: string | null = null;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("pro_applications")
      .select(
        "id, company, contact_name, email, reference, status, tracking_token, insurance_expiry, created_at",
      )
      .in("status", OPEN)
      .order("updated_at", { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(error.message);

    const { runVerificationForApplication } = await import(
      "@/lib/application-checks.server"
    );
    const { sendTemplateEmail } = await import(
      "@/lib/email-templates/send-email"
    );

    for (const row of rows ?? []) {
      try {
        await runVerificationForApplication(supabaseAdmin, row.id as string);
        checked += 1;
      } catch (verifyError) {
        failed += 1;
        lastError = (verifyError as Error).message;
      }

      const plans: ReminderPlan[] = [];

      const { data: docs } = await supabaseAdmin
        .from("pro_application_documents")
        .select("id, kind, status, file_name")
        .eq("application_id", row.id as string);

      const missing = DOCUMENT_KINDS.filter((d) => d.required).filter(
        (d) =>
          !(docs ?? []).some(
            (doc) => doc.kind === d.key && doc.status !== "rejected",
          ),
      );
      const ageDays =
        (Date.now() - new Date(row.created_at as string).getTime()) / 86_400_000;
      if (missing.length > 0 && ageDays >= 2) {
        plans.push({
          kind: "documents_pending",
          dedupeKey: `${weekBucket()}:${missing.map((m) => m.key).join(",")}`,
          detail: `Still missing: ${missing.map((m) => m.label).join(", ")}.`,
        });
      }

      for (const doc of (docs ?? []).filter((d) => d.status === "rejected")) {
        plans.push({
          kind: "document_rejected",
          dedupeKey: doc.id as string,
          detail: `${DOCUMENT_KIND_LABEL[doc.kind as string] ?? doc.kind} — "${doc.file_name}" couldn't be accepted. Please upload a replacement.`,
        });
      }

      const expiry = row.insurance_expiry as string | null;
      if (expiry) {
        const days = daysUntil(expiry);
        if (days < 0) {
          plans.push({
            kind: "insurance_expired",
            dedupeKey: `${expiry}:${weekBucket()}`,
            detail: `Cover expired on ${expiry}.`,
          });
        } else if (days <= 30) {
          plans.push({
            kind: "insurance_expiring",
            dedupeKey: `${expiry}:${days <= 7 ? "7" : "30"}`,
            detail: `Cover expires on ${expiry} — ${days} day${days === 1 ? "" : "s"} left.`,
          });
        }
      }

      for (const plan of plans) {
        // Claim the reminder first: the unique index makes the send idempotent.
        const { error: claimError } = await supabaseAdmin
          .from("application_reminders")
          .insert({
            application_id: row.id as string,
            kind: plan.kind,
            dedupe_key: plan.dedupeKey,
            detail: plan.detail,
          });
        if (claimError) continue; // already sent

        if (!row.email) continue;
        try {
          await sendTemplateEmail("application-reminder", row.email as string, {
            templateData: {
              company: row.company,
              contactName: row.contact_name,
              reference: row.reference,
              kind: plan.kind,
              detail: plan.detail,
              statusUrl: row.tracking_token
                ? `${SITE}/application-status?token=${row.tracking_token}`
                : `${SITE}/application-status`,
            },
            idempotencyKey: `app-reminder-${row.id}-${plan.kind}-${plan.dedupeKey}`,
          });
          reminders += 1;
          await supabaseAdmin.from("pro_application_audit").insert({
            application_id: row.id as string,
            reference: (row.reference as string) ?? null,
            company: (row.company as string) ?? "",
            action: "reminder_sent",
            from_status: row.status as string,
            to_status: row.status as string,
            reviewer_note: plan.detail,
          });
        } catch (emailError) {
          failed += 1;
          lastError = (emailError as Error).message;
        }
      }
    }

    await supabaseAdmin.rpc("release_job_lease", {
      p_name: JOB,
      p_result: { checked, reminders, failed, at: new Date().toISOString() },
      ...(lastError ? { p_error: lastError } : {}),
    });

    return json({ ok: true, checked, reminders, failed });
  } catch (runError) {
    await supabaseAdmin.rpc("release_job_lease", {
      p_name: JOB,
      p_result: { checked, reminders, failed },
      p_error: (runError as Error).message,
    });
    return json({ error: (runError as Error).message }, 500);
  }
}

export const Route = createFileRoute("/api/public/application-maintenance")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
