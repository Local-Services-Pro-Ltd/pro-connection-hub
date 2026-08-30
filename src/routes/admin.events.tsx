import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { downloadText } from "@/lib/track-export";
import { useAuth } from "@/hooks/use-auth";
import {
  apiAccessEventsQuery,
  isAdminQuery,
  type ApiAccessEvent,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Denied access events — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Admin view of rate-limit hits and rejected requests against the public reviews, vetting-status and featured-firms endpoints.",
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
      <p className="text-muted-foreground">Page not found.</p>
    </Section>
  ),
  component: AdminEvents,
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

function AdminEvents() {
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
        body="Sign in with your admin account to review denied access events."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="Denied access telemetry is restricted to site admins."
      />
    );
  }
  return <EventsBoard />;
}

const ENDPOINT_LABELS: Record<string, string> = {
  "/api/public/reviews": "Reviews",
  "/api/public/vetting-status": "Vetting status",
  "/api/public/featured": "Featured firms",
  "/api/public/security-scan": "Security scan",
  "/api/public/security-alert": "Security alert",
};

const OUTCOME_STYLES: Record<string, string> = {
  rate_limited: "bg-accent/20 text-accent-foreground",
  method_not_allowed: "bg-muted text-muted-foreground",
  unauthorized: "bg-destructive/15 text-destructive",
  bad_request: "bg-muted text-muted-foreground",
};

function EventsBoard() {
  const { data, isPending, error, refetch, isFetching } =
    useQuery(apiAccessEventsQuery);
  const [endpoint, setEndpoint] = useState("all");
  const [outcome, setOutcome] = useState("all");

  const events = useMemo(() => {
    return (data ?? []).filter(
      (e) =>
        (endpoint === "all" || e.endpoint === endpoint) &&
        (outcome === "all" || e.outcome === outcome),
    );
  }, [data, endpoint, outcome]);

  const stats = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (data ?? []).filter(
      (e) => new Date(e.created_at).getTime() >= since,
    );
    return {
      last24h: recent.length,
      rateLimited: recent.filter((e) => e.outcome === "rate_limited").length,
      unauthorized: recent.filter((e) => e.outcome === "unauthorized").length,
      visitors: new Set(recent.map((e) => e.ip_hash ?? "?")).size,
    };
  }, [data]);

  function exportCsv() {
    const header = [
      "created_at",
      "endpoint",
      "method",
      "outcome",
      "status",
      "ip_hash",
      "detail",
      "user_agent",
    ];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = events.map((e: ApiAccessEvent) =>
      [
        e.created_at,
        e.endpoint,
        e.method,
        e.outcome,
        e.status,
        e.ip_hash,
        e.detail,
        e.user_agent,
      ]
        .map(cell)
        .join(","),
    );
    downloadText(
      `denied-access_${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      [header.join(","), ...body].join("\n"),
    );
  }

  const endpoints = [...new Set((data ?? []).map((e) => e.endpoint))].sort();

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Denied access events"
        sub="Every request the public endpoints turned away — rate-limit hits, wrong methods and bad secrets. Callers are identified by a truncated hash, never a raw IP address."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-4" data-testid="denied-stats">
        {[
          { label: "Denials (24h)", value: stats.last24h },
          { label: "Rate-limited", value: stats.rateLimited },
          { label: "Unauthorized", value: stats.unauthorized },
          { label: "Distinct callers", value: stats.visitors },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={events.length === 0}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <select
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          aria-label="Filter by endpoint"
          className="rounded-sm border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All endpoints</option>
          {endpoints.map((ep) => (
            <option key={ep} value={ep}>
              {ENDPOINT_LABELS[ep] ?? ep}
            </option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          aria-label="Filter by outcome"
          className="rounded-sm border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All outcomes</option>
          <option value="rate_limited">Rate limited</option>
          <option value="method_not_allowed">Method not allowed</option>
          <option value="unauthorized">Unauthorized</option>
          <option value="bad_request">Bad request</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      <OverTime events={events} />



      <div
        className="mt-6 overflow-x-auto rounded-md border border-border"
        data-testid="denied-events-table"
      >
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Caller</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Loading events…
                </td>
              </tr>
            )}
            {!isPending && events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    No denied requests recorded in the retention window. That is
                    the healthy state.
                  </span>
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-3">
                  {ENDPOINT_LABELS[e.endpoint] ?? e.endpoint}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.method}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-semibold ${
                      OUTCOME_STYLES[e.outcome] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {e.outcome.replace(/_/g, " ")} · {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {(e.ip_hash ?? "—").slice(0, 12)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
