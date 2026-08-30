import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, RefreshCw, ScrollText } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { downloadText } from "@/lib/track-export";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchProFeatureAuditAll,
  isAdminQuery,
  type ProFeatureAudit,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Vetting audit log — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Admin audit trail of every featuring, unfeaturing, approval and rejection applied to a tradesman listing.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Vetting audit log — admin" },
      {
        property: "og:description",
        content:
          "Filterable admin record of featured, unfeatured, approved and rejected listing actions.",
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
  component: AdminAudit,
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

function AdminAudit() {
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
        body="Sign in with your admin account to read the vetting audit log."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="The vetting audit trail is restricted to site admins."
      />
    );
  }
  return <AuditBoard />;
}

const ACTIONS = ["featured", "unfeatured", "approved", "rejected"] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_STYLES: Record<string, string> = {
  featured: "bg-primary/15 text-primary",
  unfeatured: "bg-muted text-muted-foreground",
  approved: "bg-accent/20 text-accent-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

function AuditBoard() {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "pro-feature-audit", "all"],
    queryFn: fetchProFeatureAuditAll,
    staleTime: 0,
  });

  const [active, setActive] = useState<Action[]>([...ACTIONS]);
  const [term, setTerm] = useState("");
  const [days, setDays] = useState(30);

  const rows = useMemo(() => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const q = term.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (!active.includes(r.action as Action)) return false;
      if (new Date(r.created_at).getTime() < since) return false;
      if (!q) return true;
      return (
        r.pro_name.toLowerCase().includes(q) ||
        r.pro_id.toLowerCase().includes(q) ||
        (r.changed_by_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, active, term, days]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<
      Action,
      number
    >;
    for (const r of rows) {
      if (r.action in map) map[r.action as Action] += 1;
    }
    return map;
  }, [rows]);

  function toggle(a: Action) {
    setActive((cur) =>
      cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a],
    );
  }

  function exportCsv() {
    const header = [
      "created_at",
      "action",
      "pro_id",
      "pro_name",
      "was_featured",
      "is_featured",
      "published",
      "verified_credentials",
      "changed_by_email",
    ];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((r: ProFeatureAudit) =>
      [
        r.created_at,
        r.action,
        r.pro_id,
        r.pro_name,
        r.was_featured,
        r.is_featured,
        r.published,
        r.verified_credentials,
        r.changed_by_email,
      ]
        .map(cell)
        .join(","),
    );
    downloadText(
      `vetting-audit_${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      [header.join(","), ...body].join("\n"),
    );
  }

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Vetting audit log"
        sub="Every featuring, unfeaturing, approval and rejection written by the database triggers — filter by action, firm or admin, then export for compliance."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-4" data-testid="audit-stats">
        {ACTIONS.map((a) => (
          <div key={a} className="rounded-md border border-border bg-card p-4">
            <p className="text-sm capitalize text-muted-foreground">{a}</p>
            <p className="mt-1 font-display text-2xl">{counts[a]}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => toggle(a)}
            aria-pressed={active.includes(a)}
            className={`rounded-sm border px-3 py-1.5 text-sm capitalize ${
              active.includes(a)
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {a}
          </button>
        ))}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search firm or admin email"
          aria-label="Search the audit log"
          className="min-w-56 flex-1 rounded-sm border border-border bg-card px-3 py-2 text-sm"
        />
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Time range"
          className="rounded-sm border border-border bg-card px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={3650}>All time</option>
        </select>
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
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      <div
        className="mt-6 overflow-x-auto rounded-md border border-border"
        data-testid="audit-table"
      >
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Firm</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Verified credentials</th>
              <th className="px-4 py-3">Admin</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Loading audit trail…
                </td>
              </tr>
            )}
            {!isPending && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" />
                    No matching actions in this range.
                  </span>
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-semibold capitalize ${
                      ACTION_STYLES[r.action] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.pro_name}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {r.pro_id}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.published ? "Published" : "Unpublished"} ·{" "}
                  {r.is_featured ? "Featured" : "Not featured"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.verified_credentials}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.changed_by_email ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
