import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Mail } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { isAdminQuery } from "@/lib/queries";
import { adminInviteFirm, adminListFirmAccounts, type AdminFirmRow } from "@/lib/invites.functions";

export const Route = createFileRoute("/admin/firms")({
  head: () => ({
    meta: [
      { title: "Firms and invitations — admin | TradesmanFinder" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminFirms,
});

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function AdminFirms() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending } = useQuery({ ...isAdminQuery(user?.id), enabled: !loading });

  if (loading || (user && isPending)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user || !isAdmin) {
    return (
      <Section>
        <div className="max-w-xl rounded-md border border-border bg-card p-8">
          <h1 className="text-2xl">{user ? "Admins only" : "Sign in required"}</h1>
          <p className="mt-3 text-muted-foreground">
            {user
              ? "Your account does not hold the admin role."
              : "The admin area is only open to signed-in admins."}
          </p>
          {!user && (
            <Link
              to="/signin"
              search={{ redirect: "/admin/firms" }}
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </Section>
    );
  }
  return <FirmList />;
}

function FirmList() {
  const {
    data: firms,
    isPending,
    error,
  } = useQuery({
    queryKey: ["admin", "firm-accounts"],
    queryFn: () => adminListFirmAccounts(),
  });
  const real = (firms ?? []).filter((firm) => !firm.is_demo);
  const waiting = real.filter((firm) => !firm.has_account);

  return (
    <Section>
      <Link to="/admin" className="text-sm text-primary hover:underline">
        ← Admin home
      </Link>
      <div className="mt-4">
        <SectionHead
          eyebrow="Admin"
          title="Firms and invitations"
          sub="Listings without an account can't edit their profile, see jobs or add photos. Send an invitation and the firm can take over its listing with a personal link."
        />
      </div>
      {isPending ? (
        <p className="mt-8 text-muted-foreground">Loading firms…</p>
      ) : error ? (
        <p role="alert" className="mt-8 text-muted-foreground">
          {error.message}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {real.length} {real.length === 1 ? "listing" : "listings"} · {waiting.length} without an
            account
          </p>
          <ul className="mt-4 grid gap-4">
            {real.map((firm) => (
              <FirmRow key={firm.id} firm={firm} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function FirmRow({ firm }: { firm: AdminFirmRow }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(firm.invited_email ?? firm.contact_email ?? "");
  const invite = useMutation({
    mutationFn: () => adminInviteFirm({ data: { proId: firm.id, email: email.trim() } }),
    onSuccess: async (result) => {
      toast.success(`Invitation sent to ${result.email}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "firm-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="rounded-md border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg">{firm.company}</h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {(firm.trade_slug ?? "").replaceAll("-", " ")}
            {firm.area ? ` · ${firm.area}` : ""} · {firm.published ? "published" : "draft"}
          </p>
        </div>
        {firm.has_account ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Has an account
          </span>
        ) : (
          <span className="rounded-sm border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {firm.invite_open ? "Invited, not yet accepted" : "No account"}
          </span>
        )}
      </div>

      {!firm.has_account && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <label className="min-w-0 flex-1 basis-64">
            <span className="eyebrow">Send the invitation to</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="office@firm.co.uk"
              className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={invite.isPending}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {invite.isPending
              ? "Sending…"
              : firm.invited_at
                ? "Send a new invitation"
                : "Invite this firm"}
          </button>
        </form>
      )}
      {!firm.has_account && firm.invited_at && (
        <p className="mt-3 text-sm text-muted-foreground">
          Last invited {day(firm.invited_at)} at {firm.invited_email}.
          {firm.invite_open
            ? " Sending a new invitation cancels the old link."
            : " That link has expired."}
        </p>
      )}
    </li>
  );
}
