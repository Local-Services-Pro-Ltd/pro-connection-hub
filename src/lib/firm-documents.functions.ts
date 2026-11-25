import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REGISTERS, credentialState, isCredentialKind, type CredentialKind } from "@/lib/registers";

/**
 * Firms send their own insurance and registration details, with a copy of the
 * document, for an admin to check. Nothing a firm sends is ever shown as
 * checked until an admin has verified it, and changing the details of
 * something already checked sends it back for checking.
 */

const SITE = "https://tradesmanfinder.org";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Kinds a firm can send itself. "Other" stays admin-only so labels can't be invented. */
export const FIRM_DOCUMENT_KINDS = [
  "insurance",
  "companies_house",
  "gas_safe",
  "niceic",
  "napit",
  "fensa",
] as const satisfies readonly CredentialKind[];

export type FirmDocument = {
  id: string;
  kind: CredentialKind;
  label: string;
  reference: string | null;
  expires_on: string | null;
  state: "verified" | "expired" | "pending";
  verified_at: string | null;
  submitted_at: string | null;
  review_note: string | null;
  has_document: boolean;
};

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The document columns are newer than the generated database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function myFirm(userId: string): Promise<{ id: string; company: string }> {
  const db = await adminDb();
  const { data } = await db.from("pros").select("id, company").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("No firm is linked to this account.");
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDocument(row: any): FirmDocument {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    reference: row.reference ?? null,
    expires_on: row.expires_on ?? null,
    state: credentialState(row),
    verified_at: row.verified_at ?? null,
    submitted_at: row.submitted_at ?? null,
    review_note: row.review_note ?? null,
    has_document: Boolean(row.document_path),
  };
}

/** The firm's own checks, including what is still waiting and anything sent back. */
export const listMyDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FirmDocument[]> => {
    const firm = await myFirm(context.userId);
    const db = await adminDb();
    const { data, error } = await db
      .from("pro_credentials")
      .select("*")
      .eq("pro_id", firm.id)
      .order("created_at");
    if (error) throw new Error("Could not load your documents.");
    return (data ?? []).map(toDocument);
  });

export type SubmitDocumentInput = {
  kind: string;
  reference?: string;
  expiresOn?: string;
  /** Path of the file the browser has just uploaded to the firm's own folder. */
  documentPath?: string;
};

/** Send, or replace, one check. It waits for an admin and is never self-verified. */
export const submitMyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SubmitDocumentInput) => {
    const kind = (input.kind ?? "").trim();
    if (!isCredentialKind(kind) || !(FIRM_DOCUMENT_KINDS as readonly string[]).includes(kind))
      throw new Error("Choose what you are sending.");
    const reference = (input.reference ?? "").trim().slice(0, 120);
    const expiresOn = (input.expiresOn ?? "").trim();
    if (expiresOn && !ISO_DATE.test(expiresOn)) throw new Error("Enter a valid expiry date.");
    const documentPath = (input.documentPath ?? "").trim().slice(0, 300);
    return { kind: kind as CredentialKind, reference, expiresOn, documentPath };
  })
  .handler(async ({ data, context }) => {
    const firm = await myFirm(context.userId);
    const today = new Date().toISOString().slice(0, 10);
    if (data.kind === "insurance") {
      if (!data.expiresOn) throw new Error("Enter the date your insurance expires.");
      if (data.expiresOn < today) throw new Error("That policy has already expired.");
      if (!data.documentPath) throw new Error("Attach a copy of your insurance certificate.");
    } else if (!data.reference) {
      throw new Error("Enter your registration or company number.");
    }
    // The file must be in this firm's own folder; a path elsewhere is refused.
    if (data.documentPath && !data.documentPath.startsWith(`${firm.id}/`))
      throw new Error("That file couldn't be attached. Please upload it again.");

    const db = await adminDb();
    const { data: existing } = await db
      .from("pro_credentials")
      .select("id, document_path")
      .eq("pro_id", firm.id)
      .eq("kind", data.kind)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const now = new Date().toISOString();
    const values = {
      label: REGISTERS[data.kind].label,
      reference: data.reference || null,
      expires_on: data.expiresOn || null,
      document_path: data.documentPath || existing?.document_path || null,
      submitted_at: now,
      // The firm has changed what we would check, so it must be checked again.
      verified: false,
      verified_at: null,
      review_note: null,
    };
    const { data: saved, error } = existing
      ? await db.from("pro_credentials").update(values).eq("id", existing.id).select("*").single()
      : await db
          .from("pro_credentials")
          .insert({ pro_id: firm.id, kind: data.kind, ...values })
          .select("*")
          .single();
    if (error || !saved) {
      console.error("[firm-documents] save failed", error);
      throw new Error("We couldn't save that. Please try again.");
    }
    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: `Document to check: ${firm.company}`,
      intro: "A firm has sent details for you to check. They stay unverified until you do.",
      lines: [
        `What: ${REGISTERS[data.kind].label}`,
        ...(data.expiresOn ? [`Expires: ${data.expiresOn}`] : []),
      ],
      path: "/admin/credentials",
      actionLabel: "Check firm credentials",
      dedupeKey: `credential:${saved.id}:${now.slice(0, 13)}`,
    });
    return toDocument(saved);
  });

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const db = await adminDb();
  const { data, error } = await db.storage.from("pro-credentials").createSignedUrl(path, 600);
  if (error) {
    console.error("[firm-documents] signing failed", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** A ten-minute link to a document, for the firm that uploaded it. */
export const myDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: (input.id ?? "").trim() }))
  .handler(async ({ data, context }) => {
    const firm = await myFirm(context.userId);
    const db = await adminDb();
    const { data: row } = await db
      .from("pro_credentials")
      .select("document_path")
      .eq("id", data.id)
      .eq("pro_id", firm.id)
      .maybeSingle();
    const url = await signedUrl(row?.document_path ?? null);
    if (!url) throw new Error("There is no document to open.");
    return { url };
  });

/* ----------------------------------------------------------------- admin */

async function requireAdmin(context: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

export type PendingDocument = {
  id: string;
  pro_id: string;
  company: string;
  kind: string;
  label: string;
  reference: string | null;
  expires_on: string | null;
  submitted_at: string | null;
  has_document: boolean;
};

/** Everything firms have sent that has not been checked yet, oldest first. */
export const adminListPendingDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingDocument[]> => {
    await requireAdmin(context);
    const db = await adminDb();
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await db
      .from("pro_credentials")
      .select("*")
      .eq("verified", false)
      .not("submitted_at", "is", null)
      .is("review_note", null)
      .order("submitted_at")
      .limit(100);
    if (error) throw new Error("Could not load documents.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const waiting = ((rows ?? []) as any[]).filter(
      (row) => !row.expires_on || row.expires_on >= today,
    );
    const ids = [...new Set(waiting.map((row) => row.pro_id as string))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: pros } = await db.from("pros").select("id, company").in("id", ids);
      for (const pro of (pros ?? []) as { id: string; company: string }[])
        names.set(pro.id, pro.company);
    }
    return waiting.map((row) => ({
      id: row.id,
      pro_id: row.pro_id,
      company: names.get(row.pro_id) ?? row.pro_id,
      kind: row.kind,
      label: row.label,
      reference: row.reference,
      expires_on: row.expires_on,
      submitted_at: row.submitted_at,
      has_document: Boolean(row.document_path),
    }));
  });

export const adminDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: (input.id ?? "").trim() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await adminDb();
    const { data: row } = await db
      .from("pro_credentials")
      .select("document_path")
      .eq("id", data.id)
      .maybeSingle();
    const url = await signedUrl(row?.document_path ?? null);
    if (!url) throw new Error("No document was attached.");
    return { url };
  });

/** Verify a firm's document, or send it back with a reason. The firm is emailed. */
export const adminReviewDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: string; note?: string }) => {
    if (!["verify", "return"].includes(input.decision)) throw new Error("Unknown decision.");
    const note = (input.note ?? "").trim().slice(0, 600);
    if (input.decision === "return" && note.length < 10)
      throw new Error("Tell the firm what it needs to put right.");
    return { id: (input.id ?? "").trim(), decision: input.decision as "verify" | "return", note };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await adminDb();
    const verify = data.decision === "verify";
    const { data: row, error } = await db
      .from("pro_credentials")
      .update(
        verify
          ? { verified: true, verified_at: new Date().toISOString(), review_note: null }
          : { verified: false, verified_at: null, review_note: data.note },
      )
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error || !row) throw new Error("Could not save that decision.");
    const { data: firm } = await db
      .from("pros")
      .select("company, contact_email")
      .eq("id", row.pro_id)
      .maybeSingle();
    let emailed = false;
    if (firm?.contact_email) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const result = await sendTemplateEmail("credential-status", firm.contact_email, {
          templateData: {
            company: firm.company,
            label: row.label,
            verified: verify,
            note: data.note,
            expiresOn: row.expires_on,
            dashboardUrl: `${SITE}/dashboard`,
          },
          idempotencyKey: `credential-status:${row.id}:${new Date().toISOString().slice(0, 16)}`,
        });
        emailed = result.sent;
      } catch (emailError) {
        console.error("[firm-documents] status email failed", emailError);
      }
    }
    return { id: row.id as string, verified: verify, emailed };
  });
