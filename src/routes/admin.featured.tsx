import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, History, Lock, Star, StarOff, X } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  adminProsQuery,
  isAdminQuery,
  proFeatureAuditQuery,
  type AdminProRow,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/featured")({
  head: () => ({
    meta: [
      { title: "Featured firms — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Feature a tradesman on the homepage only after insurance, trade-body and approval checks pass.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  component: AdminFeatured,
});

function Locked({ title, body }: { title: string; body: string }) {
  return (
    <Section>
      <div className="mx-auto max-w-lg rounded-md border border-border bg-card p-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-primary/15">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <Link
          to="/signin"
          search={{}}
          className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
        >
          Sign in
        </Link>
      </div>
    </Section>
  );
}

function AdminFeatured() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending: checkingRole } = useQuery({
    ...isAdminQuery(user?.id),
    enabled: !loading,
  });

  if (loading || (user && checkingRole)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user) {
    return (
      <Locked
        title="Admin sign-in required"
        body="Sign in with your admin account to feature a firm on the homepage."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="This account doesn't have admin access. Featuring a firm is restricted to site admins."
      />
    );
  }
  return <FeaturedBoard />;
}

/** The checks a firm must pass before it can go on the homepage. */
function checksFor(p: AdminProRow) {
  return [
    { label: "Listing approved and published", ok: p.published },
    { label: "At least one verified credential", ok: p.verified_credentials > 0 },
    { label: "Claimed by the firm's own account", ok: Boolean(p.user_id) },
    { label: "Has at least one published review", ok: p.review_count > 0 },
  ];
}

function FeaturedBoard() {
  const queryClient = useQueryClient();
  const { data: pros, isPending, error } = useQuery(adminProsQuery);
  const { data: audit } = useQuery(proFeatureAuditQuery);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      setPendingId(id);
      const { error: e } = await supabase
        .from("pros")
        .update({ featured: next })
        .eq("id", id);
      if (e) throw e;
      return next;
    },
    onSuccess: async (next) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "pros"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "pro-feature-audit"],
      });
      await queryClient.invalidateQueries({ queryKey: ["featured-pros"] });
      toast.success(
        next ? "Firm is now featured on the homepage" : "Firm removed from the homepage",
      );
    },
    onError: (e: Error) =>
      toast.error(e.message || "Couldn't change the featured state."),
    onSettled: () => setPendingId(null),
  });

  if (isPending) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading listings…</p>
      </Section>
    );
  }
  if (error) {
    return (
      <Section>
        <p role="alert" className="text-muted-foreground">
          {(error as Error).message}
        </p>
      </Section>
    );
  }

  const featuredCount = pros.filter((p) => p.featured).length;

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Featured firms"
        sub="A firm reaches the homepage only when you put it there. The database refuses to feature anything that isn't published with at least one verified credential, and every change is written to the audit log below."
      />

      <p className="mt-6 text-sm text-muted-foreground">
        {featuredCount === 0
          ? "Nothing is featured, so the homepage is showing the vetting-status panel."
          : `${featuredCount} firm${featuredCount === 1 ? "" : "s"} currently featured on the homepage.`}
      </p>

      <div className="mt-6 grid gap-4">
        {pros.map((p) => {
          const checks = checksFor(p);
          const blockers = checks.filter((c) => !c.ok);
          const canFeature = p.published && p.verified_credentials > 0;
          return (
            <div
              key={p.id}
              className="rounded-md border border-border bg-card p-6 md:flex md:items-start md:justify-between md:gap-6"
            >
              <div>
                <h3 className="text-lg">{p.company}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.name} · {p.trade_slug} · {p.area}
                </p>
                <ul className="mt-4 grid gap-1.5">
                  {checks.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      {c.ok ? (
                        <Check
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                      )}
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  {p.verified_credentials} of {p.total_credentials} credentials
                  verified
                </p>
              </div>

              <div className="mt-5 shrink-0 md:mt-0 md:text-right">
                <button
                  type="button"
                  disabled={pendingId === p.id || (!p.featured && !canFeature)}
                  onClick={() => toggle.mutate({ id: p.id, next: !p.featured })}
                  className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 font-display text-sm font-semibold hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {p.featured ? (
                    <>
                      <StarOff className="h-4 w-4" /> Remove from homepage
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4" /> Feature this firm
                    </>
                  )}
                </button>
                {!p.featured && !canFeature ? (
                  <p className="mt-2 max-w-56 text-xs text-muted-foreground">
                    Blocked: {blockers.map((b) => b.label.toLowerCase()).join("; ")}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-14">
        <h2 className="flex items-center gap-2 text-2xl">
          <History className="h-5 w-5 text-primary" aria-hidden="true" />
          Featuring audit log
        </h2>
        {audit && audit.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  <th className="p-3 font-normal">When</th>
                  <th className="p-3 font-normal">Firm</th>
                  <th className="p-3 font-normal">Action</th>
                  <th className="p-3 font-normal">Verified credentials</th>
                  <th className="p-3 font-normal">By</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("en-GB")}
                    </td>
                    <td className="p-3">{row.pro_name || row.pro_id}</td>
                    <td className="p-3">{row.action}</td>
                    <td className="p-3">{row.verified_credentials}</td>
                    <td className="p-3 text-muted-foreground">
                      {row.changed_by_email ?? "system"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No featuring actions recorded yet.
          </p>
        )}
      </div>
    </Section>
  );
}
