import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, RefreshCw, Users } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { downloadText } from "@/lib/track-export";
import { useAuth } from "@/hooks/use-auth";
import {
  isAdminQuery,
  waitingListAdminSummaryQuery,
  waitingListRecentQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/waiting-list")({
  head: () => ({
    meta: [
      { title: "Waiting-list demand — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Admin view of waiting-list demand by postcode area and trade, with CSV export for launch planning.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Waiting-list demand — admin" },
      {
        property: "og:description",
        content: "Demand by postcode area and trade for launch planning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  component: AdminWaitingList,
});

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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

function AdminWaitingList() {
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
        title="Admins only"
        body="Sign in with an administrator account to see waiting-list demand."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="You don't have access"
        body="This page is restricted to administrators."
      />
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const summary = useQuery(waitingListAdminSummaryQuery);
  const recent = useQuery(waitingListRecentQuery);
  const [role, setRole] = useState<"all" | "homeowner" | "trader">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return (summary.data ?? []).filter((r) => {
      if (needle && !r.postcode_area.includes(needle)) return false;
      if (role === "homeowner" && r.homeowners === 0) return false;
      if (role === "trader" && r.traders === 0) return false;
      return true;
    });
  }, [summary.data, q, role]);

  const totals = useMemo(
    () =>
      (summary.data ?? []).reduce(
        (acc, r) => ({
          total: acc.total + Number(r.total),
          confirmed: acc.confirmed + Number(r.confirmed),
          traders: acc.traders + Number(r.traders),
        }),
        { total: 0, confirmed: 0, traders: 0 },
      ),
    [summary.data],
  );

  const exportSummary = () => {
    const header = [
      "postcode_area",
      "total",
      "confirmed",
      "homeowners",
      "traders",
      "trades",
      "last_signup",
    ];
    const body = rows.map((r) =>
      [
        r.postcode_area,
        r.total,
        r.confirmed,
        r.homeowners,
        r.traders,
        r.trades ?? "",
        r.last_signup ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    downloadText(
      `waiting-list-demand-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      [header.join(","), ...body].join("\n"),
    );
  };

  const exportSignups = () => {
    const header = [
      "created_at",
      "email",
      "postcode",
      "role",
      "trade",
      "source",
      "confirmed_at",
    ];
    const body = (recent.data ?? []).map((r) =>
      [
        r.created_at,
        r.email,
        r.postcode,
        r.role,
        r.trade ?? "",
        r.source,
        r.confirmed_at ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    downloadText(
      `waiting-list-signups-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      [header.join(","), ...body].join("\n"),
    );
  };

  const field =
    "rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Waiting-list demand"
        sub="Where people are asking for TradesmanFinder, so you can pick the next area on evidence rather than instinct."
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {[
          { label: "Sign-ups", value: totals.total },
          { label: "Confirmed", value: totals.confirmed },
          { label: "Trades waiting", value: totals.traders },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-border bg-card p-6"
          >
            <p className="eyebrow">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by postcode area (e.g. M)"
          aria-label="Filter by postcode area"
          className={field}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          aria-label="Filter by role"
          className={field}
        >
          <option value="all">Everyone</option>
          <option value="homeowner">Has homeowners</option>
          <option value="trader">Has trades</option>
        </select>
        <button
          onClick={() => {
            void summary.refetch();
            void recent.refetch();
          }}
          className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
        </button>
        <button
          onClick={exportSummary}
          className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Demand CSV
        </button>
        <button
          onClick={exportSignups}
          className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Sign-ups CSV
        </button>
      </div>

      {summary.isError && (
        <p role="alert" className="mt-6 text-sm text-muted-foreground">
          Couldn't load demand: {(summary.error as Error).message}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-surface font-display text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Confirmed</th>
              <th className="px-4 py-3">Homeowners</th>
              <th className="px-4 py-3">Trades</th>
              <th className="px-4 py-3">Trades asked for</th>
              <th className="px-4 py-3">Last sign-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {summary.isPending ? "Loading…" : "No sign-ups yet."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.postcode_area} className="border-t border-border">
                  <td className="px-4 py-3 font-display font-semibold">
                    <Users
                      className="mr-2 inline h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {r.postcode_area}
                  </td>
                  <td className="px-4 py-3">{r.total}</td>
                  <td className="px-4 py-3">{r.confirmed}</td>
                  <td className="px-4 py-3">{r.homeowners}</td>
                  <td className="px-4 py-3">{r.traders}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.trades ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.last_signup
                      ? new Date(r.last_signup).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
