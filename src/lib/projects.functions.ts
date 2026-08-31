import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Homeowner project postings: create, sign photo URLs for the public board,
 * firm applications, and admin review. Everything that emails someone or
 * touches another account's data runs here rather than in the browser.
 */

function siteOrigin() {
  try {
    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host");
    return host ? `${proto}://${host}` : "https://tradesmanfinder.org";
  } catch {
    return "https://tradesmanfinder.org";
  }
}

export type CreateProjectInput = {
  title: string;
  description: string;
  tradeSlug?: string;
  postcode: string;
  budgetMin?: number;
  budgetMax?: number;
  startDate?: string;
  endDate?: string;
  photos: string[];
  contactName: string;
  contactEmail: string;
  notifyApplications: boolean;
};

const clean = (v: string | undefined, max: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : undefined;
};

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateProjectInput) => {
    const title = (input.title ?? "").trim();
    const description = (input.description ?? "").trim();
    const postcode = (input.postcode ?? "").trim().toUpperCase();
    const contactName = (input.contactName ?? "").trim();
    const contactEmail = (input.contactEmail ?? "").trim().toLowerCase();
    if (title.length < 6) throw new Error("Give your project a clear title.");
    if (description.length < 40)
      throw new Error(
        "Describe the work in a bit more detail so firms can price it (40 characters or more).",
      );
    if (postcode.length < 2) throw new Error("Add the job's postcode.");
    if (contactName.length < 2) throw new Error("Add a contact name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail))
      throw new Error("Add a valid contact email address.");
    const photos = (input.photos ?? []).slice(0, 8).filter(Boolean);
    return {
      title: title.slice(0, 120),
      description: description.slice(0, 4000),
      tradeSlug: clean(input.tradeSlug, 80),
      postcode,
      budgetMin:
        Number.isFinite(input.budgetMin) && (input.budgetMin ?? 0) > 0
          ? Math.round(input.budgetMin as number)
          : undefined,
      budgetMax:
        Number.isFinite(input.budgetMax) && (input.budgetMax ?? 0) > 0
          ? Math.round(input.budgetMax as number)
          : undefined,
      startDate: clean(input.startDate, 10),
      endDate: clean(input.endDate, 10),
      photos,
      contactName: contactName.slice(0, 80),
      contactEmail,
      notifyApplications: input.notifyApplications !== false,
    };
  })
  .handler(async ({ data, context }) => {
    // Photos live under <user-id>/… — reject anything pointing elsewhere.
    const photos = data.photos.filter((p) =>
      p.startsWith(`${context.userId}/`),
    );

    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description,
        trade_slug: data.tradeSlug ?? null,
        postcode: data.postcode,
        budget_min: data.budgetMin ?? null,
        budget_max: data.budgetMax ?? null,
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        photos,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        notify_applications: data.notifyApplications,
      })
      .select("id, reference")
      .single();

    if (error) {
      console.error("[projects] create failed", error);
      throw new Error("We couldn't save that posting. Please try again.");
    }
    return row;
  });

/**
 * Photos sit in a private bucket, so the board and the detail page ask the
 * server for short-lived signed URLs. Only published postings are signed for
 * anonymous callers.
 */
export const signProjectPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: { projectId: string }) => ({
    projectId: (input.projectId ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.projectId) return { urls: [] as string[] };
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("photos, status")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project || project.status !== "published") return { urls: [] };

    const urls: string[] = [];
    for (const path of project.photos ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("project-photos")
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    return { urls };
  });

/** Signed URLs for the poster's own (possibly unpublished) photos. */
export const signMyProjectPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => ({
    projectId: (input.projectId ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects")
      .select("photos, user_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) return { urls: [] as string[] };

    const urls: string[] = [];
    for (const path of project.photos ?? []) {
      const { data: signed } = await context.supabase.storage
        .from("project-photos")
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    return { urls };
  });

export type ApplyInput = {
  projectId: string;
  proId: string;
  message: string;
  quoteLow?: number;
  quoteHigh?: number;
  availableFrom?: string;
};

export const applyToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ApplyInput) => {
    const message = (input.message ?? "").trim();
    if (!input.projectId || !input.proId)
      throw new Error("We couldn't tell which posting you're applying to.");
    if (message.length < 20)
      throw new Error(
        "Tell the homeowner how you'd approach the job (20 characters or more).",
      );
    return {
      projectId: input.projectId,
      proId: input.proId,
      message: message.slice(0, 2000),
      quoteLow:
        Number.isFinite(input.quoteLow) && (input.quoteLow ?? 0) > 0
          ? Math.round(input.quoteLow as number)
          : undefined,
      quoteHigh:
        Number.isFinite(input.quoteHigh) && (input.quoteHigh ?? 0) > 0
          ? Math.round(input.quoteHigh as number)
          : undefined,
      availableFrom: clean(input.availableFrom, 10),
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("apply_to_project", {
      p_project_id: data.projectId,
      p_pro_id: data.proId,
      p_message: data.message,
      p_quote_low: data.quoteLow,
      p_quote_high: data.quoteHigh,
      p_available_from: data.availableFrom,
    });
    if (error) throw new Error(error.message);

    // Notify the homeowner (service role: the applying firm can't read the
    // poster's contact details itself).
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ data: project }, { data: pro }] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, title, contact_name, contact_email, notify_applications")
        .eq("id", data.projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("pros")
        .select("company")
        .eq("id", data.proId)
        .maybeSingle(),
    ]);

    if (project?.notify_applications && project.contact_email) {
      const quote =
        data.quoteLow && data.quoteHigh
          ? `£${data.quoteLow.toLocaleString("en-GB")} – £${data.quoteHigh.toLocaleString("en-GB")}`
          : data.quoteLow
            ? `From £${data.quoteLow.toLocaleString("en-GB")}`
            : undefined;
      try {
        const { sendTemplateEmail } = await import(
          "@/lib/email-templates/send-email"
        );
        await sendTemplateEmail("project-application", project.contact_email, {
          idempotencyKey: `project-apply-${data.projectId}-${data.proId}`,
          templateData: {
            name: project.contact_name,
            projectTitle: project.title,
            company: pro?.company,
            quote,
            availableFrom: data.availableFrom,
            message: data.message,
            projectUrl: `${siteOrigin()}/projects/${project.id}`,
          },
        });
      } catch (error) {
        console.error("[projects] application email failed", error);
      }
    }

    return { ok: true };
  });

export type ReviewProjectInput = {
  projectId: string;
  status: "published" | "rejected";
  reviewerNote?: string;
};

export const reviewProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReviewProjectInput) => {
    if (input.status !== "published" && input.status !== "rejected")
      throw new Error("Unsupported review decision.");
    return {
      projectId: input.projectId,
      status: input.status,
      reviewerNote: clean(input.reviewerNote, 1000),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: row, error } = await context.supabase
      .from("projects")
      .update({
        status: data.status,
        reviewer_note: data.reviewerNote ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.projectId)
      .select("id, title, reference, contact_name, contact_email")
      .single();
    if (error) throw new Error(error.message);

    try {
      const { sendTemplateEmail } = await import(
        "@/lib/email-templates/send-email"
      );
      await sendTemplateEmail("project-status", row.contact_email, {
        idempotencyKey: `project-review-${row.id}-${data.status}`,
        templateData: {
          name: row.contact_name,
          projectTitle: row.title,
          status: data.status,
          reviewerNote: data.reviewerNote,
          reference: row.reference,
          projectUrl:
            data.status === "published"
              ? `${siteOrigin()}/projects/${row.id}`
              : `${siteOrigin()}/account`,
        },
      });
    } catch (error) {
      console.error("[projects] decision email failed", error);
    }

    return { ok: true };
  });
