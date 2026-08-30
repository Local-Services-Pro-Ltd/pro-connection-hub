import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";

/**
 * Certification applications from firms that want a TradesmanFinder listing.
 *
 * Anonymous firms submit through `submitProApplication`, which runs the same
 * spam gate as the waiting list (honeypot + signed human check + rate limit)
 * and writes through a SECURITY DEFINER function that the browser cannot call.
 * Reading and reviewing applications is admin-only.
 */

export type ProApplicationInput = {
  company: string;
  contactName: string;
  email: string;
  postcode: string;
  tradeSlug?: string;
  phone?: string;
  years?: number;
  website?: string;
  companiesHouse?: string;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  accreditations?: string;
  about?: string;
  checkToken: string;
  checkAnswer: string;
  /** Honeypot — must stay empty. */
  hp?: string;
};

const SITE = "https://tradesmanfinder.org";

export type ApplicationStatusEvent = {
  action: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
};

export type ApplicationStatus = {
  reference: string;
  company: string;
  trade_slug: string | null;
  postcode: string;
  status: string;
  reviewer_note: string | null;
  submitted_at: string;
  updated_at: string;
  reviewed_at: string | null;
  timeline: ApplicationStatusEvent[];
};

function clean(value: string | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export const submitProApplication = createServerFn({ method: "POST" })
  .inputValidator((input: ProApplicationInput) => {
    const company = (input.company ?? "").trim();
    const contactName = (input.contactName ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    const postcode = (input.postcode ?? "").trim().toUpperCase();
    if (company.length < 2) throw new Error("Please enter your company name.");
    if (contactName.length < 2)
      throw new Error("Please enter the main contact's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new Error("Please enter a valid email address.");
    if (postcode.length < 2)
      throw new Error("Please enter the postcode you work from.");
    const expiry = clean(input.insuranceExpiry, 10);
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))
      throw new Error("Insurance expiry must be a valid date.");
    return {
      company: company.slice(0, 120),
      contactName: contactName.slice(0, 120),
      email,
      postcode,
      tradeSlug: clean(input.tradeSlug, 60),
      phone: clean(input.phone, 40),
      years: Math.max(0, Math.min(Number(input.years ?? 0) || 0, 80)),
      website: clean(input.website, 200),
      companiesHouse: clean(input.companiesHouse, 40),
      insuranceProvider: clean(input.insuranceProvider, 120),
      insuranceExpiry: expiry,
      accreditations: clean(input.accreditations, 500),
      about: clean(input.about, 2000) ?? "",
      checkToken: (input.checkToken ?? "").trim(),
      checkAnswer: (input.checkAnswer ?? "").trim(),
      hp: (input.hp ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const logBlock = async (reason: string) => {
      try {
        await supabaseAdmin.rpc("log_form_block", {
          p_form: "pro_application",
          p_reason: reason,
        });
      } catch (error) {
        console.error("[applications] block logging failed", error);
      }
    };

    if (data.hp) {
      await logBlock("honeypot");
      throw new Error("Something went wrong. Please try again.");
    }

    const { verifyChallenge } = await import("@/lib/human-check.server");
    try {
      verifyChallenge(data.checkToken, data.checkAnswer);
    } catch (error) {
      await logBlock("human_check");
      throw error;
    }

    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const limits: Array<[string, number, number]> = [
      [`app:ip:${ipKey}`, 4, 900],
      [`app:email:${data.email}`, 3, 86_400],
    ];
    for (const [bucket, limit, windowSeconds] of limits) {
      const { data: allowed, error } = await supabaseAdmin.rpc(
        "hit_rate_limit",
        { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds },
      );
      if (!error && allowed === false) {
        await logBlock("rate_limit");
        throw new Error(
          "That's a few applications in a short space of time. Please try again shortly.",
        );
      }
    }

    const { data: id, error } = await supabaseAdmin.rpc(
      "submit_pro_application",
      {
        p_company: data.company,
        p_contact_name: data.contactName,
        p_email: data.email,
        p_postcode: data.postcode,
        ...(data.tradeSlug ? { p_trade_slug: data.tradeSlug } : {}),
        ...(data.phone ? { p_phone: data.phone } : {}),
        p_years: data.years,
        ...(data.website ? { p_website: data.website } : {}),
        ...(data.companiesHouse
          ? { p_companies_house: data.companiesHouse }
          : {}),
        ...(data.insuranceProvider
          ? { p_insurance_provider: data.insuranceProvider }
          : {}),
        ...(data.insuranceExpiry
          ? { p_insurance_expiry: data.insuranceExpiry }
          : {}),
        ...(data.accreditations
          ? { p_accreditations: data.accreditations }
          : {}),
        p_about: data.about,
      },
    );

    if (error) {
      const message = error.message ?? "";
      if (message.includes("invalid_email"))
        throw new Error("Please enter a valid email address.");
      if (message.includes("invalid_postcode"))
        throw new Error("Please enter a valid UK postcode.");
      console.error("[applications] insert failed", error);
      throw new Error("Something went wrong. Please try again.");
    }

    const applicationId = String(id ?? "");

    const { data: row } = await supabaseAdmin
      .from("pro_applications")
      .select("reference, tracking_token, contact_name, company")
      .eq("id", applicationId)
      .maybeSingle();

    const reference = row?.reference ?? "";
    const trackingToken = row?.tracking_token ?? "";
    const statusUrl = trackingToken
      ? `${SITE}/application-status?token=${trackingToken}`
      : `${SITE}/application-status`;

    try {
      const { sendTemplateEmail } = await import(
        "@/lib/email-templates/send-email"
      );
      await sendTemplateEmail("pro-application-status", data.email, {
        templateData: {
          company: data.company,
          contactName: data.contactName,
          reference,
          status: "submitted",
          statusUrl,
        },
        idempotencyKey: `application-submitted-${applicationId}`,
      });
    } catch (emailError) {
      console.error("[applications] submission email failed", emailError);
    }

    return { id: applicationId, reference, trackingToken, statusUrl };
  });

/**
 * Token-gated status lookup for the firm that applied. Anonymous, rate limited,
 * and served through a SECURITY DEFINER function so no table access is exposed.
 */
export const getApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    const token = (input.token ?? "").trim();
    if (token.length < 8) throw new Error("That tracking link isn't valid.");
    return { token: token.slice(0, 120) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const { data: allowed } = await supabaseAdmin.rpc("hit_rate_limit", {
      p_bucket: `appstatus:ip:${ipKey}`,
      p_limit: 40,
      p_window_seconds: 600,
    });
    if (allowed === false)
      throw new Error("Too many lookups. Please try again shortly.");

    const { data: status, error } = await supabaseAdmin.rpc(
      "pro_application_status",
      { p_token: data.token },
    );
    if (error) {
      console.error("[applications] status lookup failed", error);
      throw new Error("Something went wrong. Please try again.");
    }
    if (!status) throw new Error("We couldn't find an application for that link.");
    return status as ApplicationStatus;
  });

export type ProApplication = {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string | null;
  trade_slug: string | null;
  postcode: string;
  years: number;
  website: string | null;
  companies_house: string | null;
  insurance_provider: string | null;
  insurance_expiry: string | null;
  accreditations: string | null;
  about: string;
  status: string;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  reference: string | null;
  tracking_token: string | null;
  requested_fields: string[];
  changes_requested_at: string | null;
  resubmitted_at: string | null;
  applicant_message: string | null;
  escalated_at: string | null;
  escalation_note: string | null;
  priority: string;
  due_at: string | null;
  first_reviewed_at: string | null;
  verification: VerificationResult | Record<string, never>;
  verified_at: string | null;
};


async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => unknown };
  userId: string;
}) {
  const { data, error } = (await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  })) as { data: boolean | null; error: unknown };
  if (error || !data) throw new Error("Admins only.");
}

/** Every application, newest first. Admin-only. */
export const listProApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("pro_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as ProApplication[];
  });

/** Move an application through the vetting pipeline. Admin-only. */
export const reviewProApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      status: string;
      note?: string;
      notify?: boolean;
    }) => {
    const allowed = ["pending", "in_review", "approved", "rejected"];
    if (!allowed.includes(input.status)) throw new Error("Unknown status.");
    if (!input.id) throw new Error("Missing application.");
      return {
        id: input.id,
        status: input.status,
        note: (input.note ?? "").trim().slice(0, 500),
        notify: input.notify !== false,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("pro_applications")
      .update({
        status: data.status,
        reviewer_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: row } = await context.supabase
      .from("pro_applications")
      .select("company, contact_name, email, reference, tracking_token, status")
      .eq("id", data.id)
      .maybeSingle();

    let notified = false;
    if (data.notify !== false && row?.email && data.status !== "pending") {
      try {
        const { sendTemplateEmail } = await import(
          "@/lib/email-templates/send-email"
        );
        const result = await sendTemplateEmail(
          "pro-application-status",
          row.email as string,
          {
            templateData: {
              company: row.company,
              contactName: row.contact_name,
              reference: row.reference,
              status: data.status,
              reviewerNote: data.note || undefined,
              statusUrl: row.tracking_token
                ? `${SITE}/application-status?token=${row.tracking_token}`
                : `${SITE}/application-status`,
            },
            idempotencyKey: `application-${data.status}-${data.id}-${Date.now()}`,
          },
        );
        notified = result.sent;
      } catch (emailError) {
        console.error("[applications] decision email failed", emailError);
      }
    }

    return { ok: true, notified };
  });

export type ProApplicationAudit = {
  id: string;
  application_id: string;
  reference: string | null;
  company: string;
  action: string;
  from_status: string | null;
  to_status: string;
  reviewer_note: string | null;
  changed_by_email: string | null;
  created_at: string;
};

/** Audit trail of application changes and reviewer actions. Admin-only. */
export const listProApplicationAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { applicationId?: string; limit?: number } = {}) => ({
    applicationId: (input.applicationId ?? "").trim() || undefined,
    limit: Math.min(Math.max(Number(input.limit ?? 200) || 200, 1), 1000),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    let query = context.supabase
      .from("pro_application_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.applicationId)
      query = query.eq("application_id", data.applicationId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProApplicationAudit[];
  });

/* ------------------------------------------------------------------ */
/* Document uploads (token-gated, anonymous applicants)                */
/* ------------------------------------------------------------------ */

const DOCS_BUCKET = "application-docs";

async function tokenApplicationId(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(
    "pro_application_id_for_token",
    { p_token: token },
  );
  if (error) {
    console.error("[applications] token lookup failed", error);
    throw new Error("Something went wrong. Please try again.");
  }
  const id = (data as string | null) ?? "";
  if (!id) throw new Error("That tracking link isn't valid.");
  return id;
}

async function limitByIp(bucket: string, limit: number, windowSeconds: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
  const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const { data: allowed } = await supabaseAdmin.rpc("hit_rate_limit", {
    p_bucket: `${bucket}:${ipKey}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (allowed === false)
    throw new Error("That's a lot of requests in a short space of time. Please try again shortly.");
}

/** Applicant uploads one document against their tracking token. */
export const uploadApplicationDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      kind: string;
      fileName: string;
      mimeType: string;
      dataBase64: string;
    }) => {
      const token = (input.token ?? "").trim();
      if (token.length < 8) throw new Error("That tracking link isn't valid.");
      const kind = (input.kind ?? "other").trim();
      if (!DOCUMENT_KINDS.some((d) => d.key === kind))
        throw new Error("Unknown document type.");
      const fileName = (input.fileName ?? "").trim().slice(0, 160);
      const mimeType = (input.mimeType ?? "").trim();
      const dataBase64 = (input.dataBase64 ?? "").trim();
      if (!dataBase64) throw new Error("That file looks empty.");
      const approxBytes = Math.floor((dataBase64.length * 3) / 4);
      const problem = validateDocumentFile({
        name: fileName,
        size: approxBytes,
        type: mimeType,
      });
      if (problem) throw new Error(problem);
      return { token, kind, fileName, mimeType, dataBase64 };
    },
  )
  .handler(async ({ data }) => {
    await limitByIp("appdoc:ip", 30, 900);
    const applicationId = await tokenApplicationId(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.byteLength > MAX_DOCUMENT_BYTES)
      throw new Error("That file is too large.");

    const ext = ALLOWED_DOCUMENT_TYPES[data.mimeType] ?? "bin";
    const path = `${applicationId}/${data.kind}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (uploadError) {
      console.error("[applications] document upload failed", uploadError);
      throw new Error("We couldn't store that file. Please try again.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("pro_application_documents")
      .insert({
        application_id: applicationId,
        kind: data.kind,
        file_path: path,
        file_name: data.fileName,
        mime_type: data.mimeType,
        size_bytes: bytes.byteLength,
      })
      .select("id, kind, file_name, size_bytes, status, reviewer_note, created_at")
      .single();
    if (error) {
      console.error("[applications] document row failed", error);
      throw new Error("We couldn't record that file. Please try again.");
    }

    await supabaseAdmin.from("pro_application_audit").insert({
      application_id: applicationId,
      company: "",
      action: "document_uploaded",
      to_status: "document",
      reviewer_note: `${data.kind}: ${data.fileName}`,
    });

    return row as ApplicationDocument;
  });

/** Applicant answers a change request and resubmits. */
export const resubmitApplication = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      updates: Record<string, string>;
      message?: string;
    }) => {
      const token = (input.token ?? "").trim();
      if (token.length < 8) throw new Error("That tracking link isn't valid.");
      const allowed = [
        "contact_name",
        "phone",
        "website",
        "companies_house",
        "insurance_provider",
        "insurance_expiry",
        "accreditations",
        "about",
      ];
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.updates ?? {})) {
        if (!allowed.includes(key)) continue;
        const trimmed = String(value ?? "").trim();
        if (!trimmed) continue;
        if (
          key === "insurance_expiry" &&
          !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        )
          throw new Error("Insurance expiry must be a valid date.");
        updates[key] = trimmed.slice(0, 2000);
      }
      return {
        token,
        updates,
        message: (input.message ?? "").trim().slice(0, 1000),
      };
    },
  )
  .handler(async ({ data }) => {
    await limitByIp("appresubmit:ip", 10, 900);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc(
      "pro_application_resubmit",
      {
        p_token: data.token,
        p_updates: data.updates,
        p_message: data.message || null,
      },
    );
    if (error) {
      const message = error.message ?? "";
      if (message.includes("not_found"))
        throw new Error("We couldn't find an application for that link.");
      if (message.includes("not_editable"))
        throw new Error("This application isn't open for changes right now.");
      console.error("[applications] resubmit failed", error);
      throw new Error("Something went wrong. Please try again.");
    }
    return result as { ok: boolean; reference: string };
  });

/* ------------------------------------------------------------------ */
/* Admin: documents, verification, change requests, SLA                */
/* ------------------------------------------------------------------ */

export type AdminApplicationDocument = ApplicationDocument & {
  application_id: string;
  file_path: string;
  mime_type: string;
  reviewed_at: string | null;
};

/** Documents for one application, with short-lived signed download links. */
export const listApplicationDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { applicationId: string }) => {
    if (!input.applicationId) throw new Error("Missing application.");
    return { applicationId: input.applicationId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: rows, error } = await context.supabase
      .from("pro_application_documents")
      .select("*")
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const withUrls = await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(DOCS_BUCKET)
          .createSignedUrl(row.file_path as string, 300);
        return { ...row, url: signed?.signedUrl ?? null };
      }),
    );
    return withUrls as Array<AdminApplicationDocument & { url: string | null }>;
  });

/** Mark one uploaded document verified or rejected. */
export const reviewApplicationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; note?: string }) => {
    if (!input.id) throw new Error("Missing document.");
    if (!["uploaded", "verified", "rejected"].includes(input.status))
      throw new Error("Unknown document status.");
    return {
      id: input.id,
      status: input.status,
      note: (input.note ?? "").trim().slice(0, 400),
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("pro_application_documents")
      .update({
        status: data.status,
        reviewer_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Automated checks: Companies House registration (live lookup when an API key
 * is configured, format check otherwise) and insurance validity/expiry.
 */
export const runApplicationVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("Missing application.");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: row, error } = await context.supabase
      .from("pro_applications")
      .select("id, company, companies_house, insurance_provider, insurance_expiry")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Application not found.");

    const checks: VerificationCheck[] = [];

    const chNumber = (row.companies_house as string | null) ?? "";
    if (!chNumber) {
      checks.push({
        key: "companies_house",
        label: "Companies House",
        outcome: "fail",
        detail: "No company registration number supplied.",
      });
    } else if (!isValidCompanyNumberFormat(chNumber)) {
      checks.push({
        key: "companies_house",
        label: "Companies House",
        outcome: "fail",
        detail: `"${chNumber}" isn't a valid registration number (8 digits, or 2 letters and 6 digits).`,
      });
    } else {
      const normalised = normaliseCompanyNumber(chNumber);
      const apiKey = process.env["COMPANIES_HOUSE_API_KEY"];
      if (!apiKey) {
        checks.push({
          key: "companies_house",
          label: "Companies House",
          outcome: "warn",
          detail: `${normalised} is a valid number format. Live register lookup is not configured, so confirm the company by hand.`,
        });
      } else {
        try {
          const response = await fetch(
            `https://api.company-information.service.gov.uk/company/${normalised}`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
              },
            },
          );
          if (response.status === 404) {
            checks.push({
              key: "companies_house",
              label: "Companies House",
              outcome: "fail",
              detail: `No company found on the register for ${normalised}.`,
            });
          } else if (!response.ok) {
            checks.push({
              key: "companies_house",
              label: "Companies House",
              outcome: "warn",
              detail: `Register lookup failed (HTTP ${response.status}). Check by hand.`,
            });
          } else {
            const company = (await response.json()) as {
              company_name?: string;
              company_status?: string;
            };
            const status = company.company_status ?? "unknown";
            const nameMatch =
              (company.company_name ?? "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "") ===
              String(row.company).toLowerCase().replace(/[^a-z0-9]/g, "");
            if (status !== "active") {
              checks.push({
                key: "companies_house",
                label: "Companies House",
                outcome: "fail",
                detail: `${company.company_name ?? normalised} is "${status}" on the register.`,
              });
            } else {
              checks.push({
                key: "companies_house",
                label: "Companies House",
                outcome: nameMatch ? "pass" : "warn",
                detail: nameMatch
                  ? `${company.company_name} is active on the register.`
                  : `${normalised} is active as "${company.company_name}", which doesn't match the applied name "${row.company}".`,
              });
            }
          }
        } catch (lookupError) {
          console.error("[applications] CH lookup failed", lookupError);
          checks.push({
            key: "companies_house",
            label: "Companies House",
            outcome: "warn",
            detail: "Register lookup couldn't be reached. Check by hand.",
          });
        }
      }
    }

    checks.push(
      checkInsurance(
        (row.insurance_provider as string | null) ?? null,
        (row.insurance_expiry as string | null) ?? null,
      ),
    );

    const { count: docCount } = await context.supabase
      .from("pro_application_documents")
      .select("id", { count: "exact", head: true })
      .eq("application_id", data.id)
      .neq("status", "rejected");
    checks.push({
      key: "documents",
      label: "Paperwork",
      outcome: (docCount ?? 0) >= 2 ? "pass" : (docCount ?? 0) > 0 ? "warn" : "fail",
      detail: `${docCount ?? 0} document${docCount === 1 ? "" : "s"} on file.`,
    });

    const result: VerificationResult = {
      checked_at: new Date().toISOString(),
      overall: overallOutcome(checks),
      checks,
    };

    const { error: saveError } = await context.supabase
      .from("pro_applications")
      .update({ verification: result, verified_at: result.checked_at })
      .eq("id", data.id);
    if (saveError) throw new Error(saveError.message);

    return result;
  });

/** Ask the firm for specific missing fields and pause the clock. */
export const requestApplicationChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      fields: string[];
      note?: string;
      notify?: boolean;
    }) => {
      if (!input.id) throw new Error("Missing application.");
      const fields = (input.fields ?? [])
        .map((f) => String(f).trim())
        .filter((f) => f in REQUESTABLE_FIELD_LABEL);
      if (fields.length === 0)
        throw new Error("Pick at least one thing to ask the firm for.");
      return {
        id: input.id,
        fields,
        note: (input.note ?? "").trim().slice(0, 500),
        notify: input.notify !== false,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("pro_applications")
      .update({
        status: "changes_requested",
        requested_fields: data.fields,
        changes_requested_at: new Date().toISOString(),
        reviewer_note: data.note || null,
        reviewed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: row } = await context.supabase
      .from("pro_applications")
      .select("company, contact_name, email, reference, tracking_token")
      .eq("id", data.id)
      .maybeSingle();

    let notified = false;
    if (data.notify && row?.email) {
      try {
        const { sendTemplateEmail } = await import(
          "@/lib/email-templates/send-email"
        );
        const asked = data.fields
          .map((f) => REQUESTABLE_FIELD_LABEL[f])
          .join(", ");
        const result = await sendTemplateEmail(
          "pro-application-status",
          row.email as string,
          {
            templateData: {
              company: row.company,
              contactName: row.contact_name,
              reference: row.reference,
              status: "changes_requested",
              reviewerNote: `We need: ${asked}.${data.note ? ` ${data.note}` : ""}`,
              statusUrl: row.tracking_token
                ? `${SITE}/application-status?token=${row.tracking_token}`
                : `${SITE}/application-status`,
            },
            idempotencyKey: `application-changes-${data.id}-${Date.now()}`,
          },
        );
        notified = result.sent;
      } catch (emailError) {
        console.error("[applications] change request email failed", emailError);
      }
    }

    return { ok: true, notified };
  });

/** Escalate a stuck application: raise priority, reset the SLA clock, log it. */
export const escalateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      note?: string;
      priority?: string;
      dueInHours?: number;
    }) => {
      if (!input.id) throw new Error("Missing application.");
      const priority = ["normal", "high", "urgent"].includes(
        input.priority ?? "",
      )
        ? (input.priority as string)
        : "high";
      const dueInHours = Math.min(
        Math.max(Number(input.dueInHours ?? 24) || 24, 1),
        720,
      );
      return {
        id: input.id,
        note: (input.note ?? "").trim().slice(0, 500),
        priority,
        dueInHours,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const dueAt = new Date(Date.now() + data.dueInHours * 3_600_000).toISOString();
    const { error } = await context.supabase
      .from("pro_applications")
      .update({
        escalated_at: new Date().toISOString(),
        escalation_note: data.note || null,
        priority: data.priority,
        due_at: dueAt,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: row } = await context.supabase
      .from("pro_applications")
      .select("company, reference, status")
      .eq("id", data.id)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("pro_application_audit").insert({
      application_id: data.id,
      reference: row?.reference ?? null,
      company: row?.company ?? "",
      action: "escalated",
      from_status: row?.status ?? null,
      to_status: row?.status ?? "escalated",
      reviewer_note: `${data.priority} priority, due ${new Date(dueAt).toLocaleString("en-GB")}${data.note ? ` — ${data.note}` : ""}`,
      changed_by: context.userId,
    });

    return { ok: true, dueAt };
  });

export type ApplicationSla = {
  open_total: number;
  overdue: number;
  due_soon: number;
  escalated: number;
  awaiting_firm: number;
  approved_30d: number;
  rejected_30d: number;
  avg_first_response_hours: number | null;
  avg_decision_hours: number | null;
  insurance_expired: number;
  insurance_expiring_60d: number;
};

/** Aggregate SLA and throughput numbers for the admin dashboard. */
export const getApplicationSla = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase.rpc("pro_application_sla");
    if (error) throw new Error(error.message);
    return data as ApplicationSla;
  });
