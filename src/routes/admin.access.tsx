import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lock, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import {
  accessMatrixQuery,
  isAdminQuery,
  securityRegressionQuery,
  type AccessMatrixRow,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/access")({
  head: () => ({
    meta: [
      { title: "Access control map — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Admin view of the row-level security policies and views that decide which data is public and which is admin-only.",
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
  component: AdminAccess,
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

function AdminAccess() {
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
        body="Sign in with your admin account to review the access control map."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="This account doesn't have admin access. The access map is restricted to site admins."
      />
    );
  }
  return <AccessBoard />;
}

const AUDIENCE_STYLES: Record<string, string> = {
  public: "bg-primary/15 text-primary",
  "admin only": "bg-destructive/15 text-destructive",
  "owner only": "bg-accent/20 text-accent-foreground",
  authenticated: "bg-muted text-muted-foreground",
  "no policies (locked)": "bg-destructive/10 text-destructive",
};

function Badge({ audience }: { audience: string }) {
  return (
    <span
      className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-semibold ${
        AUDIENCE_STYLES[audience] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {audience}
    </span>
  );
}

const KEY_TABLES = [
  "pros",
  "pro_credentials",
  "reviews",
  "reviews_public",
  "jobs",
  "pro_feature_audit",
  "plan_visibility",
  "plan_visibility_audit",
  "user_roles",
  "waiting_list",
  "feedback",
  "security_scan_runs",
];

function AccessBoard() {
  const { data: rows, isPending, error, refetch, isFetching } = useQuery(accessMatrixQuery);
  const {
    data: checks,
    isFetching: checking,
    refetch: rerunChecks,
  } = useQuery(securityRegressionQuery);
  const [keyOnly, setKeyOnly] = useState(true);

  const grouped = useMemo(() => {
    const source = (rows ?? []).filter((r) =>
      keyOnly ? KEY_TABLES.includes(r.object_name) : true,
    );
    const map = new Map<string, AccessMatrixRow[]>();
    for (const row of source) {
      const list = map.get(row.object_name) ?? [];
      list.push(row);
      map.set(row.object_name, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, keyOnly]);

  const failures = (checks ?? []).filter((c) => c.passed === false);

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Access control map"
        blurb="Every row-level security policy and public view, and who each one lets in. Public means anyone on the internet can read it; admin only means it is gated behind the admin role."
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh map
        </button>
        <button
          type="button"
          onClick={() => rerunChecks()}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <ShieldCheck className={`h-4 w-4 ${checking ? "animate-pulse" : ""}`} />
          Run security checks
        </button>
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={keyOnly}
            onChange={(e) => setKeyOnly(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Key tables only
        </label>
      </div>

      {checks && (
        <div
          data-testid="access-check-summary"
          className="mt-6 rounded-md border border-border bg-card p-5"
        >
          <p className="font-display text-sm font-semibold">
            {failures.length === 0
              ? `All ${checks.length} security checks passing`
              : `${failures.length} of ${checks.length} security checks failing`}
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {checks.map((c) => (
              <li
                key={`${c.suite}-${c.check_name}`}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                {c.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <span>
                  <span className="text-foreground">{c.check_name}</span>{" "}
                  <span className="opacity-70">({c.suite})</span> — {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isPending && <p className="mt-8 text-muted-foreground">Loading policies…</p>}
      {error && (
        <p role="alert" className="mt-8 text-destructive">
          {(error as Error).message}
        </p>
      )}

      <div className="mt-8 grid gap-5">
        {grouped.map(([name, entries]) => {
          const kind = entries[0]?.object_kind ?? "table";
          const rlsOff = entries.some(
            (e) => e.object_kind === "table" && e.rls_enabled === false,
          );
          return (
            <div
              key={name}
              data-testid={`access-${name}`}
              className="rounded-md border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg">{name}</h2>
                <span className="rounded-sm bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {kind}
                </span>
                {kind === "table" && (
                  <span
                    className={`text-xs font-semibold ${rlsOff ? "text-destructive" : "text-primary"}`}
                  >
                    {rlsOff ? "RLS DISABLED" : "RLS enabled"}
                  </span>
                )}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Policy / view</th>
                      <th className="pb-2 pr-4 font-medium">Command</th>
                      <th className="pb-2 pr-4 font-medium">Roles</th>
                      <th className="pb-2 pr-4 font-medium">Audience</th>
                      <th className="pb-2 font-medium">Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={`${e.policy_name ?? "view"}-${i}`} className="border-t border-border/60">
                        <td className="py-2 pr-4">{e.policy_name ?? "view definition"}</td>
                        <td className="py-2 pr-4">{e.command ?? "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{e.roles ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <Badge audience={e.audience ?? "authenticated"} />
                        </td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {e.expression ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
