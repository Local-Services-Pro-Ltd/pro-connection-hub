import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Eye, EyeOff, History, Lock, ShieldAlert } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { downloadText } from "@/lib/track-export";
import {
  adminPlansQuery,
  fetchAuditRange,
  formBlockDailyQuery,
  isAdminQuery,
  planVisibilityAuditQuery,
} from "@/lib/queries";


export const Route = createFileRoute("/admin/plans")({
  head: () => ({
    meta: [
      { title: "Plan visibility — admin | TradesmanFinder" },
      {
        name: "description",
        content: "Show or hide membership tiers on the pricing page.",
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
  notFoundComponent: () => (
    <Section>
      <p className="text-muted-foreground">Not found.</p>
    </Section>
  ),
  component: AdminPlans,
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

function AdminPlans() {
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
        body="Sign in with your admin account to manage which membership tiers appear on the pricing page."
      />
    );
  }

  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="This account doesn't have admin access. Sign in with the account that owns the site to change plan visibility."
      />
    );
  }

  return <AdminPlansBoard />;
}

function AdminPlansBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(adminPlansQuery);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: async ({
      slug,
      next,
      displayName,
      order,
    }: {
      slug: string;
      next: boolean;
      displayName: string;
      order: number;
    }) => {
      setPendingSlug(slug);
      const { error: upsertError } = await supabase
        .from("plan_visibility")
        .upsert(
          {
            plan_slug: slug,
            display_name: displayName,
            is_public: next,
            display_order: order,
            updated_by: user?.id ?? null,
          },
          { onConflict: "plan_slug" },
        );
      if (upsertError) throw upsertError;
      return next;
    },
    onSuccess: async (next) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      await queryClient.invalidateQueries({ queryKey: ["plan-visibility"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "plan-visibility-audit"],
      });
      toast.success(
        next ? "Tier is now visible on the pricing page" : "Tier is now hidden",
      );
    },
    onError: (e: Error) =>
      toast.error(e.message || "Couldn't save that change."),
    onSettled: () => setPendingSlug(null),
  });

  if (isPending) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading tiers…</p>
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

  const visibilityBySlug = new Map(
    data.visibility.map((v) => [v.plan_slug, v]),
  );

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Plan visibility"
        sub="Show or hide a membership tier on the public pricing page. Hidden tiers stay fully functional — billing, entitlements and direct sign-up links keep working, they're just not listed."
      />

      <div className="mt-10 space-y-4">
        {data.plans.map((plan) => {
          const row = visibilityBySlug.get(plan.slug);
          const isPublic = row?.is_public ?? true;
          const busy = pendingSlug === plan.slug;
          return (
            <div
              key={plan.slug}
              className="flex flex-wrap items-center justify-between gap-6 rounded-md border border-border bg-card p-6"
            >
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl">{row?.display_name ?? plan.name}</h2>
                  <span
                    className={`rounded-sm px-2 py-0.5 font-display text-[11px] uppercase tracking-widest ${
                      isPublic
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPublic ? "Visible" : "Hidden"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.price}
                  {plan.per} · {plan.line || plan.slug}
                </p>
                {!isPublic && row?.hidden_reason ? (
                  <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                    {row.hidden_reason}
                  </p>
                ) : null}
                {row?.updated_at ? (
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    Last changed{" "}
                    {new Date(row.updated_at).toLocaleString("en-GB")}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={busy || toggle.isPending}
                aria-pressed={isPublic}
                aria-label={`${isPublic ? "Hide" : "Show"} the ${plan.name} tier on the pricing page`}
                onClick={() =>
                  toggle.mutate({
                    slug: plan.slug,
                    next: !isPublic,
                    displayName: row?.display_name ?? plan.name,
                    order: row?.display_order ?? plan.sort_order,
                  })
                }
                className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {isPublic ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {busy ? "Saving…" : isPublic ? "Hide tier" : "Show tier"}
              </button>
            </div>
          );
        })}
      </div>

      <BlockedSubmissions />

      <AuditLog />


      <p className="mt-8 text-sm text-muted-foreground">
        Changes go live on the{" "}
        <Link to="/for-tradesmen" className="text-primary hover:underline">
          pricing page
        </Link>{" "}
        on the next page load — no redeploy needed.
      </p>
    </Section>
  );
}

/**
 * Append-only record of who changed what and when. Written by a database
 * trigger, so it captures every change to tier visibility — including any made
 * outside this screen.
 */
function AuditLog() {
  const { data, isPending, error } = useQuery(planVisibilityAuditQuery);

  return (
    <section className="mt-16" aria-labelledby="audit-heading">
      <div className="flex items-center gap-3">
        <History className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="audit-heading" className="text-2xl">
          Change history
        </h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every visibility change is recorded automatically with the admin who
        made it. Entries can't be edited or deleted by anyone.
      </p>

      <ExportAudit />



      {isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading history…</p>
      ) : error ? (
        <p role="alert" className="mt-6 text-sm text-muted-foreground">
          Couldn't load the change history.
        </p>
      ) : data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No changes recorded yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              Plan visibility change history, newest first
            </caption>
            <thead className="bg-surface">
              <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Tier
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Change
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Admin
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("en-GB")}
                  </td>
                  <td className="px-5 py-3">
                    {row.display_name || row.plan_slug}
                  </td>
                  <td className="px-5 py-3">
                    {row.action === "shown"
                      ? "Made visible"
                      : row.action === "hidden"
                        ? "Hidden from pricing"
                        : row.action === "created"
                          ? `Added (${row.is_public ? "visible" : "hidden"})`
                          : "Details edited"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {row.changed_by_email ?? "System"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/** Downloads the visibility audit trail for a chosen date range as CSV. */
function ExportAudit() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);

  const input =
    "rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  async function exportCsv() {
    setBusy(true);
    try {
      const rows = await fetchAuditRange(
        new Date(`${from}T00:00:00.000Z`).toISOString(),
        new Date(`${to}T23:59:59.999Z`).toISOString(),
      );
      if (rows.length === 0) {
        toast.info("No changes recorded in that date range.");
        return;
      }
      const header = [
        "changed_at_utc",
        "plan_slug",
        "display_name",
        "action",
        "was_public",
        "is_public",
        "hidden_reason",
        "admin_email",
      ];
      const body = rows.map((r) =>
        [
          r.created_at,
          r.plan_slug,
          r.display_name,
          r.action,
          r.was_public ?? "",
          r.is_public,
          r.hidden_reason ?? "",
          r.changed_by_email ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
      downloadText(
        `plan-visibility-audit_${from}_to_${to}.csv`,
        "text/csv;charset=utf-8",
        [header.join(","), ...body].join("\n"),
      );
      toast.success(`Exported ${rows.length} change${rows.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't export the history.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-4 rounded-md border border-border bg-card p-5">
      <div>
        <label htmlFor="audit-from" className="text-xs font-medium">
          From
        </label>
        <input
          id="audit-from"
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className={`mt-1 block ${input}`}
        />
      </div>
      <div>
        <label htmlFor="audit-to" className="text-xs font-medium">
          To
        </label>
        <input
          id="audit-to"
          type="date"
          value={to}
          min={from}
          max={today()}
          onChange={(e) => setTo(e.target.value)}
          className={`mt-1 block ${input}`}
        />
      </div>
      <button
        type="button"
        onClick={exportCsv}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy ? "Preparing…" : "Export CSV"}
      </button>
    </div>
  );
}

const BLOCK_REASONS: Record<string, string> = {
  rate_limit: "Rate limited",
  human_check: "Human check failed",
  honeypot: "Spam trap",
};

const BLOCK_FORMS: Record<string, string> = {
  waiting_list: "Waiting list",
  post_job_out_of_area: "Post a job (out of area)",
};

/** Daily totals of submissions stopped by the spam gate. */
function BlockedSubmissions() {
  const [days, setDays] = useState(14);
  const { data, isPending, error } = useQuery(formBlockDailyQuery(days));

  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + Number(r.hits), 0);

  const byDay = new Map<string, { form: string; reason: string; hits: number }[]>();
  for (const row of rows) {
    const list = byDay.get(row.day) ?? [];
    list.push({ form: row.form, reason: row.reason, hits: Number(row.hits) });
    byDay.set(row.day, list);
  }

  return (
    <section className="mt-16" aria-labelledby="blocked-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 id="blocked-heading" className="text-2xl">
            Blocked submissions
          </h2>
        </div>
        <div>
          <label htmlFor="blocked-range" className="sr-only">
            Date range
          </label>
          <select
            id="blocked-range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Waiting-list and out-of-area post-job attempts stopped by rate limiting,
        the human check or the hidden spam trap.
      </p>

      {isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading totals…</p>
      ) : error ? (
        <p role="alert" className="mt-6 text-sm text-muted-foreground">
          Couldn't load blocked-submission totals.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing blocked in this period — the forms are clean.
        </p>
      ) : (
        <>
          <p className="mt-6 font-display text-3xl text-primary">
            {total}
            <span className="ml-2 align-middle font-sans text-sm text-muted-foreground">
              blocked in the last {days} days
            </span>
          </p>
          <div className="mt-6 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">
                Daily totals of blocked form submissions
              </caption>
              <thead className="bg-surface">
                <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Day
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Form
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Reason
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Blocked
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...byDay.entries()].map(([day, entries]) =>
                  entries.map((entry, i) => (
                    <tr
                      key={`${day}-${entry.form}-${entry.reason}`}
                      className="border-t border-border"
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {i === 0 ? new Date(day).toLocaleDateString("en-GB") : ""}
                      </td>
                      <td className="px-5 py-3">
                        {BLOCK_FORMS[entry.form] ?? entry.form}
                      </td>
                      <td className="px-5 py-3">
                        {BLOCK_REASONS[entry.reason] ?? entry.reason}
                      </td>
                      <td className="px-5 py-3 font-medium">{entry.hits}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
