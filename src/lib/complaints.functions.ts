import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMPLAINT_CATEGORIES } from "@/lib/after-job.shared";

/** The admin complaints queue. Homeowners create complaints from their job page. */

export type AdminComplaint = {
  id: string;
  reference: string;
  job_reference: string | null;
  pro_id: string | null;
  company: string;
  category: string;
  description: string;
  desired_outcome: string;
  contact_name: string;
  contact_email: string;
  status: "received" | "firm_asked" | "resolved" | "closed";
  firm_asked_at: string | null;
  firm_response: string | null;
  admin_notes: string | null;
  resolution: string | null;
  created_at: string;
};

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

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

export const adminListComplaints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminComplaint[]> => {
    await requireAdmin(context);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load complaints.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    const proIds = [...new Set(all.map((row) => row.pro_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (proIds.length) {
      const { data: pros } = await db.from("pros").select("id, company").in("id", proIds);
      for (const pro of (pros ?? []) as { id: string; company: string }[])
        names.set(pro.id, pro.company);
    }
    return all.map((row) => ({
      ...row,
      company: row.pro_id ? (names.get(row.pro_id) ?? row.pro_id) : "Firm no longer listed",
    })) as AdminComplaint[];
  });

export type ComplaintUpdate = {
  id: string;
  status: string;
  firmResponse?: string;
  adminNotes?: string;
  resolution?: string;
  /** Email the firm what was reported and ask it to respond. */
  askFirm?: boolean;
};

export const adminUpdateComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ComplaintUpdate) => {
    const id = (input.id ?? "").trim();
    if (!id) throw new Error("Choose a complaint.");
    if (!["received", "firm_asked", "resolved", "closed"].includes(input.status))
      throw new Error("Unknown status.");
    return {
      id,
      status: input.status as AdminComplaint["status"],
      firmResponse: (input.firmResponse ?? "").trim().slice(0, 4000),
      adminNotes: (input.adminNotes ?? "").trim().slice(0, 4000),
      resolution: (input.resolution ?? "").trim().slice(0, 2000),
      askFirm: input.askFirm === true,
    };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await adminDb();
    const { data: current } = await db
      .from("complaints")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("We couldn't find that complaint.");
    if (["resolved", "closed"].includes(data.status) && !data.resolution)
      throw new Error("Write the outcome before resolving or closing, so there is a record.");

    const now = new Date().toISOString();
    const asking = data.askFirm && current.pro_id;
    const { error } = await db
      .from("complaints")
      .update({
        status: asking ? "firm_asked" : data.status,
        firm_response: data.firmResponse || null,
        admin_notes: data.adminNotes || null,
        resolution: data.resolution || null,
        ...(asking ? { firm_asked_at: now } : {}),
        updated_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error("Could not save that.");

    let emailedFirm = false;
    if (asking) {
      const { data: firm } = await db
        .from("pros")
        .select("company, contact_email")
        .eq("id", current.pro_id)
        .maybeSingle();
      if (firm?.contact_email) {
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const result = await sendTemplateEmail("complaint-to-answer", firm.contact_email, {
            templateData: {
              company: firm.company,
              reference: current.reference,
              jobReference: current.job_reference,
              category: COMPLAINT_CATEGORIES.find((item) => item.value === current.category)?.label,
              description: current.description,
              desiredOutcome: current.desired_outcome,
            },
            idempotencyKey: `complaint-to-answer:${current.id}:${now.slice(0, 10)}`,
            replyTo: "hello@tradesmanfinder.org",
          });
          emailedFirm = result.sent;
        } catch (emailError) {
          console.error("[complaints] firm email failed", emailError);
        }
      }
    }
    return { ok: true as const, emailedFirm, asked: Boolean(asking) };
  });
