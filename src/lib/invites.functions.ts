import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * "Invite a firm": an admin sends a listed firm a personal, one-time link.
 * The firm creates an account with the invited email address and takes over
 * the listing without the reviewed-claim wait, because we chose who to invite.
 *
 * Only a hash of the token is stored. A link works once, for 30 days, and only
 * for an account whose confirmed email is the address we invited.
 */

const SITE = "https://tradesmanfinder.org";
const INVITE_DAYS = 30;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GONE = "This invitation has expired or has already been used.";

type InviteRow = {
  id: string;
  company: string;
  trade_slug: string | null;
  area: string | null;
  contact_email: string | null;
  user_id: string | null;
  is_demo: boolean | null;
  invited_email: string | null;
  invite_expires_at: string | null;
};

const INVITE_COLUMNS =
  "id, company, trade_slug, area, contact_email, user_id, is_demo, invited_email, invite_expires_at";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The invite columns are newer than the generated database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function limitByIp(scope: string, limit: number, windowSeconds: number) {
  const db = await adminDb();
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
  const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const { data: allowed, error } = await db.rpc("hit_rate_limit", {
    p_bucket: `${scope}:${ipKey}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (!error && allowed === false)
    throw new Error("That's a lot of attempts in a short time. Please try again shortly.");
}

function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}${"•".repeat(Math.max(name.length - 1, 2))}@${domain}`;
}

async function findInvite(token: string): Promise<InviteRow | null> {
  const clean = (token ?? "").trim();
  if (clean.length < 20 || clean.length > 200) return null;
  const { hashInviteToken } = await import("@/lib/signed-links.server");
  const db = await adminDb();
  const { data, error } = await db
    .from("pros")
    .select(INVITE_COLUMNS)
    .eq("invite_token_hash", hashInviteToken(clean))
    .is("user_id", null)
    .gt("invite_expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("[invites] lookup failed", error);
    throw new Error("We couldn't check that invitation. Please try again.");
  }
  return (data as InviteRow | null) ?? null;
}

/** Admin: email a listed firm its personal link. Sending again replaces the old link. */
export const adminInviteFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proId: string; email?: string }) => {
    const proId = (input.proId ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    if (!proId || proId.length > 120) throw new Error("Choose a firm to invite.");
    if (email && !EMAIL.test(email)) throw new Error("Enter a valid email address.");
    return { proId, email: email.slice(0, 254) };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const db = await adminDb();
    const { data: firm, error } = await db
      .from("pros")
      .select(INVITE_COLUMNS)
      .eq("id", data.proId)
      .maybeSingle();
    if (error) throw new Error("Could not load that firm.");
    const row = firm as InviteRow | null;
    if (!row) throw new Error("We couldn't find that firm.");
    if (row.user_id) throw new Error("This firm already has an account.");
    if (row.is_demo) throw new Error("Example listings can't be invited.");

    const email = data.email || (row.contact_email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email))
      throw new Error("There is no email address for this firm. Type one in to invite it.");

    const { newInviteToken } = await import("@/lib/signed-links.server");
    const { token, hash } = newInviteToken();
    const invitedAt = new Date();
    const expiresAt = new Date(invitedAt.getTime() + INVITE_DAYS * 86_400_000);
    const { error: saveError } = await db
      .from("pros")
      .update({
        invited_email: email,
        invited_at: invitedAt.toISOString(),
        invite_token_hash: hash,
        invite_expires_at: expiresAt.toISOString(),
      })
      .eq("id", row.id)
      .is("user_id", null);
    if (saveError) {
      console.error("[invites] save failed", saveError);
      throw new Error("Could not create the invitation. Please try again.");
    }

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const result = await sendTemplateEmail("firm-invite", email, {
        templateData: {
          company: row.company,
          inviteUrl: `${SITE}/invite/${encodeURIComponent(token)}`,
          profileUrl: `${SITE}/pro/${encodeURIComponent(row.id)}`,
          email,
          expiresOn: expiresAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/London",
          }),
        },
        replyTo: "hello@tradesmanfinder.org",
      });
      if (!result.sent)
        throw new Error("That address has asked not to receive email from TradesmanFinder.");
    } catch (sendError) {
      console.error("[invites] email failed", {
        proId: row.id,
        message: sendError instanceof Error ? sendError.message : String(sendError),
      });
      throw new Error(
        sendError instanceof Error && sendError.message.includes("asked not to receive")
          ? sendError.message
          : "The invitation email could not be sent. Please try again.",
      );
    }
    return {
      proId: row.id,
      email,
      invitedAt: invitedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  });

export type InviteSummary = {
  proId: string;
  company: string;
  trade: string;
  area: string;
  emailHint: string;
};

/** Public: what the invitation is for. Never returns the full invited address. */
export const getInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data }): Promise<InviteSummary> => {
    await limitByIp("invite-view", 30, 600);
    const row = await findInvite(data.token);
    if (!row) throw new Error(GONE);
    return {
      proId: row.id,
      company: row.company,
      trade: row.trade_slug ?? "",
      area: row.area ?? "",
      emailHint: maskEmail(row.invited_email ?? ""),
    };
  });

/** Signed in with the invited, confirmed address: link the account to the listing. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data, context }) => {
    await limitByIp("invite-accept", 10, 3600);
    const row = await findInvite(data.token);
    if (!row) throw new Error(GONE);

    const db = await adminDb();
    const { data: account, error: accountError } = await db.auth.admin.getUserById(context.userId);
    const user = account?.user;
    if (accountError || !user?.email) throw new Error("We couldn't check your account.");
    if (user.email.trim().toLowerCase() !== (row.invited_email ?? "").trim().toLowerCase())
      throw new Error(
        `This invitation was sent to ${maskEmail(row.invited_email ?? "")}. Sign in with that email address to accept it.`,
      );
    if (!user.email_confirmed_at)
      throw new Error("Please confirm your email address first, then open the invitation again.");

    const { data: owned } = await db
      .from("pros")
      .select("id")
      .eq("user_id", context.userId)
      .limit(1);
    if ((owned ?? []).length)
      throw new Error("Your account already manages a listing. Contact us to manage another.");

    const { hashInviteToken } = await import("@/lib/signed-links.server");
    const { data: linked, error } = await db
      .from("pros")
      .update({
        user_id: context.userId,
        invite_token_hash: null,
        invite_expires_at: null,
        ...(row.contact_email ? {} : { contact_email: row.invited_email }),
      })
      .eq("id", row.id)
      .is("user_id", null)
      .eq("invite_token_hash", hashInviteToken(data.token))
      .select("id");
    if (error) {
      console.error("[invites] accept failed", error);
      throw new Error("We couldn't link your account. Please try again.");
    }
    if (!(linked ?? []).length) throw new Error(GONE);

    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: `${row.company} has taken over its listing`,
      intro: "A firm you invited has created its account and now manages its own listing.",
      lines: [`Firm: ${row.company}`, `Listing: ${row.id}`],
      path: "/admin/firms",
      actionLabel: "See firms",
      dedupeKey: `invite-accepted:${row.id}`,
    });
    return { proId: row.id, company: row.company };
  });

export type AdminFirmRow = {
  id: string;
  company: string;
  name: string | null;
  trade_slug: string | null;
  area: string | null;
  published: boolean;
  is_demo: boolean;
  has_account: boolean;
  contact_email: string | null;
  invited_email: string | null;
  invited_at: string | null;
  invite_open: boolean;
};

/** Admin: every listing with whether it has an account or an open invitation. */
export const adminListFirmAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminFirmRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const db = await adminDb();
    const { data, error } = await db
      .from("pros")
      .select(
        "id, company, name, trade_slug, area, published, is_demo, user_id, contact_email, invited_email, invited_at, invite_expires_at, invite_token_hash",
      )
      .order("company");
    if (error) throw new Error("Could not load firms.");
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      id: row.id,
      company: row.company,
      name: row.name ?? null,
      trade_slug: row.trade_slug ?? null,
      area: row.area ?? null,
      published: Boolean(row.published),
      is_demo: Boolean(row.is_demo),
      has_account: Boolean(row.user_id),
      contact_email: row.contact_email ?? null,
      invited_email: row.invited_email ?? null,
      invited_at: row.invited_at ?? null,
      invite_open:
        !row.user_id &&
        Boolean(row.invite_token_hash) &&
        Boolean(row.invite_expires_at) &&
        new Date(row.invite_expires_at).getTime() > now,
    }));
  });
