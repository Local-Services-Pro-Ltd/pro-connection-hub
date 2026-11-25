import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Review moderation. Reviews are read and decided here with the service role
 * after an admin check, so reviewer account details never reach a browser
 * that isn't an admin's.
 */

export type AdminReview = {
  id: string;
  pro_id: string;
  company: string;
  author_name: string;
  author_place: string | null;
  rating: number;
  title: string | null;
  body: string;
  job_type: string | null;
  status: "pending" | "published" | "rejected";
  created_at: string;
};

async function requireAdmin(context: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const adminListReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminReview[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reviews")
      .select(
        "id, pro_id, author_name, author_place, rating, title, body, job_type, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load reviews.");
    const proIds = [...new Set((rows ?? []).map((row) => row.pro_id))];
    const names = new Map<string, string>();
    if (proIds.length) {
      const { data: pros } = await supabaseAdmin
        .from("pros")
        .select("id, company")
        .in("id", proIds);
      for (const pro of pros ?? []) names.set(pro.id, pro.company);
    }
    return (rows ?? []).map((row) => ({
      ...row,
      company: names.get(row.pro_id) ?? row.pro_id,
    })) as AdminReview[];
  });

export const adminModerateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => {
    const id = (input.id ?? "").trim();
    if (!id) throw new Error("Choose a review.");
    if (!["published", "rejected", "pending"].includes(input.status))
      throw new Error("Unknown decision.");
    return { id, status: input.status as "published" | "rejected" | "pending" };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("reviews")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id, status")
      .maybeSingle();
    if (error || !row) throw new Error("Could not save that decision.");
    return row;
  });
