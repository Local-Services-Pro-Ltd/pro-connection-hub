import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VettingOutcome = "featured" | "unfeatured" | "rejected" | "approved";

interface Input {
  proId: string;
  outcome: VettingOutcome;
  reason?: string;
}

/**
 * Emails a firm when its vetting status changes (featured, unfeatured,
 * rejected, or approved). Admin-only: the caller's role is verified against
 * user_roles before any privileged lookup happens.
 */
export const notifyProVettingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.proId) throw new Error("proId is required");
    const allowed = ["featured", "unfeatured", "rejected", "approved"];
    if (!allowed.includes(input.outcome)) throw new Error("Unknown outcome");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: pro, error } = await supabaseAdmin
      .from("pros")
      .select("id, company, name, user_id")
      .eq("id", data.proId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pro) throw new Error("Listing not found");

    let email: string | null = null;
    if (pro.user_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", pro.user_id)
        .maybeSingle();
      email = profile?.email ?? null;
    }
    if (!email) return { sent: false, reason: "no_contact_email" as const };

    const origin =
      process.env["PUBLIC_SITE_URL"] ?? "https://www.tradesmanfinder.org";

    try {
      const { sendTemplateEmail } = await import(
        "@/lib/email-templates/send-email"
      );
      const result = await sendTemplateEmail("pro-vetting-status", email, {
        templateData: {
          company: pro.company,
          contactName: pro.name,
          outcome: data.outcome,
          ...(data.reason ? { reason: data.reason } : {}),
          profileUrl: `${origin}/pro/${pro.id}`,
        },
        idempotencyKey: `pro-vetting-${pro.id}-${data.outcome}-${Date.now()}`,
      });
      return { sent: result.sent, reason: "sent" as const };
    } catch (err) {
      console.error("[pro-vetting] notification email failed", err);
      return { sent: false, reason: "send_failed" as const };
    }
  });
