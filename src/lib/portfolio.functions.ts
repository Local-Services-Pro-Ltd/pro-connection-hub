import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  PortfolioDatabase,
  PortfolioProjectRow,
  PortfolioStatus,
} from "@/lib/portfolio.types";
import {
  myPortfolioItem,
  projectPhotoPaths,
  publicPortfolioItem,
  requirePortfolioPath,
  type AdminPortfolioItem,
  type MyPortfolioItem,
  type PublicPortfolioItem,
} from "@/lib/portfolio.shared";

type PortfolioClient = SupabaseClient<PortfolioDatabase>;
const BUCKET = "pro-projects";
const PUBLIC_TTL = 60 * 60 * 24;
const PRIVATE_TTL = 60 * 60;
const MAX_JOBS = 24;

function id(value: string, label = "Job"): string {
  const cleaned = value?.trim();
  if (!cleaned || cleaned.length > 100) throw new Error(`${label} is required.`);
  return cleaned;
}

function content(input: {
  title: string;
  summary?: string;
  tradeSlug: string;
  completedOn?: string | null;
  beforePath?: string | null;
  afterPath: string;
  extraPaths?: string[];
}) {
  const title = input.title?.trim();
  const summary = input.summary?.trim() ?? "";
  const tradeSlug = input.tradeSlug?.trim();
  if (!title || title.length > 80) throw new Error("Enter a title of 80 characters or fewer.");
  if (summary.length > 400) throw new Error("Keep the description to 400 characters or fewer.");
  if (!tradeSlug || tradeSlug.length > 80) throw new Error("Choose a trade.");
  const completedOn = input.completedOn?.trim() || null;
  if (completedOn && !/^\d{4}-\d{2}-01$/.test(completedOn)) {
    throw new Error("Choose a valid completion month.");
  }
  const extraPaths = input.extraPaths ?? [];
  if (extraPaths.length > 6) throw new Error("You can add up to six extra photos.");
  return { title, summary, tradeSlug, completedOn, extraPaths };
}

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const client = context.supabase as PortfolioClient;
  const { data } = await client.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

/**
 * The caller's firm. Looked up with the service role because signed-in users
 * cannot read pros.user_id or contact_email; writes still go through the
 * caller's own client so the approval trigger and row-level rules apply.
 */
async function myFirm(_client: PortfolioClient, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as unknown as PortfolioClient)
    .from("pros")
    .select("id, name, company, trade_slug, contact_email")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not load your firm profile.");
  return data;
}

async function signPaths(
  client: PortfolioClient,
  paths: string[],
  expiresIn: number,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];
  if (!unique.length) return {};
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  if (error) throw new Error("Could not load portfolio photos.");
  return Object.fromEntries(
    (data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [],
    ),
  );
}

function allValidPaths(rows: PortfolioProjectRow[]): string[] {
  return rows.flatMap((row) => projectPhotoPaths(row));
}

function publicItems(rows: PortfolioProjectRow[], urls: Record<string, string>) {
  return rows.flatMap((row) => {
    const item = publicPortfolioItem(row, urls);
    return item ? [item] : [];
  });
}

async function publishedFirm(client: PortfolioClient, proId: string): Promise<boolean> {
  const { data, error } = await client
    .from("pros")
    .select("id")
    .eq("id", proId)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error("Could not load this firm's work gallery.");
  return Boolean(data);
}

export const listPublicPortfolio = createServerFn({ method: "POST" })
  .inputValidator((input: { proId: string }) => ({ proId: id(input.proId, "Firm") }))
  .handler(async ({ data }): Promise<{ projects: PublicPortfolioItem[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    if (!(await publishedFirm(client, data.proId))) return { projects: [] };
    const { data: rows, error } = await client
      .from("pro_projects")
      .select("*")
      .eq("pro_id", data.proId)
      .eq("status", "approved")
      .eq("published", true)
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load this firm's work gallery.");
    const projects = rows ?? [];
    const urls = await signPaths(client, allValidPaths(projects), PUBLIC_TTL);
    return { projects: publicItems(projects, urls) };
  });

export const listPublicTradePortfolio = createServerFn({ method: "POST" })
  .inputValidator((input: { trade: string }) => ({ trade: id(input.trade, "Trade") }))
  .handler(async ({ data }): Promise<{ projects: PublicPortfolioItem[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const { data: firms, error: firmError } = await client
      .from("pros")
      .select("id")
      .eq("trade_slug", data.trade)
      .eq("published", true);
    if (firmError) throw new Error("Could not load recent work.");
    const firmIds = (firms ?? []).map((firm) => firm.id);
    if (!firmIds.length) return { projects: [] };
    const { data: rows, error } = await client
      .from("pro_projects")
      .select("*")
      .eq("trade_slug", data.trade)
      .eq("status", "approved")
      .eq("published", true)
      .in("pro_id", firmIds)
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw new Error("Could not load recent work.");
    const projects = rows ?? [];
    const urls = await signPaths(client, allValidPaths(projects), PUBLIC_TTL);
    return { projects: publicItems(projects, urls) };
  });

export const listMyPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ projects: MyPortfolioItem[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const firm = await myFirm(client, context.userId);
    if (!firm) return { projects: [] };
    const { data: rows, error } = await client
      .from("pro_projects")
      .select("*")
      .eq("pro_id", firm.id)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(MAX_JOBS);
    if (error) throw new Error("Could not load your work gallery.");
    const projects = rows ?? [];
    const urls = await signPaths(client, allValidPaths(projects), PRIVATE_TTL);
    return {
      projects: projects.flatMap((row) => {
        const item = myPortfolioItem(row, urls);
        return item ? [item] : [];
      }),
    };
  });

type SavePortfolioInput = {
  id?: string;
  title: string;
  summary?: string;
  tradeSlug: string;
  completedOn?: string | null;
  beforePath?: string | null;
  afterPath: string;
  extraPaths?: string[];
};

/** Tell the admins a gallery job is waiting. Edits alert at most once a day. */
async function alertGalleryReview(proId: string, jobId: string, title: string, edited: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: firm } = await supabaseAdmin
    .from("pros")
    .select("company")
    .eq("id", proId)
    .maybeSingle();
  const { notifyAdmins } = await import("@/lib/admin-alerts.server");
  await notifyAdmins({
    subject: `Work gallery job to approve: ${firm?.company ?? proId}`,
    intro: edited
      ? "A firm has changed a job in its work gallery. It is hidden again until you approve it."
      : "A firm has added a job to its work gallery. It stays hidden until you approve it.",
    lines: [`Job: ${title}`],
    path: "/admin/galleries",
    actionLabel: "Review work galleries",
    dedupeKey: `gallery:${jobId}:${edited ? new Date().toISOString().slice(0, 10) : "new"}`,
  });
}

export const saveMyPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SavePortfolioInput) => ({
    ...content(input),
    id: input.id?.trim() || null,
    beforePath: input.beforePath?.trim() || null,
    afterPath: input.afterPath?.trim(),
  }))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as PortfolioClient;
    const firm = await myFirm(client, context.userId);
    if (!firm) throw new Error("No firm is linked to this account.");
    const beforePath = data.beforePath ? requirePortfolioPath(firm.id, data.beforePath) : null;
    const afterPath = requirePortfolioPath(firm.id, data.afterPath);
    const extraPaths = data.extraPaths.map((path) => requirePortfolioPath(firm.id, path));
    const values = {
      pro_id: firm.id,
      trade_slug: data.tradeSlug,
      title: data.title,
      summary: data.summary,
      completed_on: data.completedOn,
      before_url: beforePath,
      after_url: afterPath,
      extra_photos: extraPaths,
    };
    if (data.id) {
      const { data: row, error } = await client
        .from("pro_projects")
        .update(values)
        .eq("id", data.id)
        .eq("pro_id", firm.id)
        .select("id, status")
        .single();
      if (error || !row) throw new Error("Could not save this job. Please try again.");
      if (row.status === "pending") await alertGalleryReview(firm.id, row.id, data.title, true);
      return { id: row.id };
    }
    const { count, error: countError } = await client
      .from("pro_projects")
      .select("id", { count: "exact", head: true })
      .eq("pro_id", firm.id);
    if (countError) throw new Error("Could not check your work gallery limit.");
    if ((count ?? 0) >= MAX_JOBS)
      throw new Error("You can add up to 24 jobs to your work gallery.");
    const { data: row, error } = await client
      .from("pro_projects")
      .insert({ ...values, published: true, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save this job. Please try again.");
    await alertGalleryReview(firm.id, row.id, data.title, false);
    return { id: row.id };
  });

export const setMyPortfolioVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; published: boolean }) => ({
    id: id(input.id),
    published: input.published === true,
  }))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as PortfolioClient;
    const firm = await myFirm(client, context.userId);
    if (!firm) throw new Error("No firm is linked to this account.");
    const { error } = await client
      .from("pro_projects")
      .update({ published: data.published })
      .eq("id", data.id)
      .eq("pro_id", firm.id);
    if (error) throw new Error("Could not update this job's visibility.");
    return { ok: true as const };
  });

export const moveMyPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; direction: "up" | "down" }) => {
    if (input.direction !== "up" && input.direction !== "down")
      throw new Error("Choose a direction.");
    return { id: id(input.id), direction: input.direction };
  })
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as PortfolioClient;
    const firm = await myFirm(client, context.userId);
    if (!firm) throw new Error("No firm is linked to this account.");
    const { data: rows, error } = await client
      .from("pro_projects")
      .select("id, sort_order")
      .eq("pro_id", firm.id)
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not reorder your work gallery.");
    const index = (rows ?? []).findIndex((row) => row.id === data.id);
    const otherIndex = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || !rows?.[otherIndex]) return { ok: true as const };
    const current = rows[index]!;
    const other = rows[otherIndex]!;
    const equalOrder = current.sort_order === other.sort_order;
    const currentOrder = equalOrder ? otherIndex : other.sort_order;
    const otherOrder = equalOrder ? index : current.sort_order;
    const { error: firstError } = await client
      .from("pro_projects")
      .update({ sort_order: currentOrder })
      .eq("id", current.id)
      .eq("pro_id", firm.id);
    if (firstError) throw new Error("Could not reorder your work gallery.");
    const { error: secondError } = await client
      .from("pro_projects")
      .update({ sort_order: otherOrder })
      .eq("id", other.id)
      .eq("pro_id", firm.id);
    if (secondError) throw new Error("Could not finish reordering your work gallery.");
    return { ok: true as const };
  });

export const deleteMyPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: id(input.id) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const firm = await myFirm(client, context.userId);
    if (!firm) throw new Error("No firm is linked to this account.");
    const { data: row, error } = await client
      .from("pro_projects")
      .select("*")
      .eq("id", data.id)
      .eq("pro_id", firm.id)
      .maybeSingle();
    if (error || !row) throw new Error("That job could not be found.");
    const paths = projectPhotoPaths(row);
    const { error: deleteError } = await client
      .from("pro_projects")
      .delete()
      .eq("id", row.id)
      .eq("pro_id", firm.id);
    if (deleteError) throw new Error("Could not delete this job.");
    if (paths.length) {
      const { error: storageError } = await client.storage.from(BUCKET).remove(paths);
      if (storageError)
        console.error("[portfolio] storage cleanup failed", {
          projectId: row.id,
          message: storageError.message,
        });
    }
    return { ok: true as const };
  });

export const adminListPortfolioQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status: PortfolioStatus | "all"; proId?: string }) => {
    if (!["pending", "approved", "rejected", "all"].includes(input.status))
      throw new Error("Choose a review status.");
    return { status: input.status, proId: input.proId?.trim() || null };
  })
  .handler(async ({ data, context }): Promise<{ projects: AdminPortfolioItem[] }> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    let query = client
      .from("pro_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.proId) query = query.eq("pro_id", data.proId);
    const { data: rows, error } = await query;
    if (error) throw new Error("Could not load the review queue.");
    const projects = rows ?? [];
    const proIds = [...new Set(projects.map((row) => row.pro_id))];
    const { data: firms, error: firmError } = proIds.length
      ? await client.from("pros").select("id, name, company").in("id", proIds)
      : { data: [], error: null };
    if (firmError) throw new Error("Could not load firms in the review queue.");
    const firmMap = new Map((firms ?? []).map((firm) => [firm.id, firm]));
    const urls = await signPaths(client, allValidPaths(projects), PRIVATE_TTL);
    return {
      projects: projects.flatMap((row) => {
        const item = myPortfolioItem(row, urls);
        const firm = firmMap.get(row.pro_id);
        return item && firm ? [{ ...item, firm_name: firm.name, company: firm.company }] : [];
      }),
    };
  });

export const adminReviewPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected"; note?: string }) => {
    if (input.decision !== "approved" && input.decision !== "rejected")
      throw new Error("Choose a review decision.");
    const note = input.note?.trim() ?? "";
    if (input.decision === "rejected" && !note)
      throw new Error("Add a short note explaining what needs to change.");
    if (note.length > 600) throw new Error("Keep the reviewer note to 600 characters or fewer.");
    return { id: id(input.id), decision: input.decision, note: note || null };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const { data: row, error } = await client
      .from("pro_projects")
      .update({
        status: data.decision,
        reviewer_note: data.note,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !row) throw new Error("Could not save the review decision.");
    const { data: firm } = await client
      .from("pros")
      .select("id, contact_email")
      .eq("id", row.pro_id)
      .maybeSingle();
    if (firm?.contact_email) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("portfolio-status", firm.contact_email, {
          templateData: {
            title: row.title,
            decision: data.decision,
            reviewerNote: data.note,
            profileUrl: `https://tradesmanfinder.org/pro/${encodeURIComponent(firm.id)}`,
          },
          idempotencyKey: `portfolio-status:${row.id}:${data.decision}:${row.updated_at}`,
        });
      } catch (emailError) {
        console.error("[portfolio] review email failed", {
          projectId: row.id,
          message: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }
    return { ok: true as const };
  });

export const adminCreatePortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SavePortfolioInput & { proId: string; approved?: boolean }) => ({
    ...content(input),
    id: null,
    proId: id(input.proId, "Firm"),
    approved: input.approved !== false,
    beforePath: input.beforePath?.trim() || null,
    afterPath: input.afterPath?.trim(),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const paths = [data.beforePath, data.afterPath, ...data.extraPaths].filter(
      (path): path is string => Boolean(path),
    );
    for (const path of paths) requirePortfolioPath(data.proId, path);
    const { count, error: countError } = await client
      .from("pro_projects")
      .select("id", { count: "exact", head: true })
      .eq("pro_id", data.proId);
    if (countError || (count ?? 0) >= MAX_JOBS)
      throw new Error("This firm has reached its 24-job gallery limit.");
    const { data: row, error } = await client
      .from("pro_projects")
      .insert({
        pro_id: data.proId,
        trade_slug: data.tradeSlug,
        title: data.title,
        summary: data.summary,
        completed_on: data.completedOn,
        before_url: data.beforePath,
        after_url: data.afterPath,
        extra_photos: data.extraPaths,
        published: true,
        sort_order: count ?? 0,
        status: data.approved ? "approved" : "pending",
        reviewer_note: null,
        reviewed_at: data.approved ? new Date().toISOString() : null,
        reviewed_by: data.approved ? context.userId : null,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not add this job.");
    return { id: row.id };
  });

export const adminDeletePortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: id(input.id) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const { data: row, error } = await client
      .from("pro_projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That job could not be found.");
    const { error: deleteError } = await client.from("pro_projects").delete().eq("id", row.id);
    if (deleteError) throw new Error("Could not delete this job.");
    const paths = projectPhotoPaths(row);
    if (paths.length) await client.storage.from(BUCKET).remove(paths);
    return { ok: true as const };
  });

export const adminSetPortfolioVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; published: boolean }) => ({
    id: id(input.id),
    published: input.published === true,
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as PortfolioClient;
    const { error } = await client
      .from("pro_projects")
      .update({ published: data.published })
      .eq("id", data.id);
    if (error) throw new Error("Could not update this job's visibility.");
    return { ok: true as const };
  });
