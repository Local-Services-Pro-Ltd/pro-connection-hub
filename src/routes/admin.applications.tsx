import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { isAdminQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  listProApplicationAudit,
  listProApplications,
  reviewProApplication,
} from "@/lib/applications.functions";
import { AdminApplicationReview } from "@/components/admin-application-review";
import { OPEN_STATUSES } from "@/lib/application-verification";

const STATUSES = [
  "pending",
  "in_review",
  "changes_requested",
  "resubmitted",
  "approved",
  "rejected",
] as const;

export const Route = createFileRoute("/admin/applications")({
  head: () => ({
    meta: [
      { title: "Certification applications — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Review firms applying for TradesmanFinder certification and move them through the vetting pipeline.",
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
  component: AdminApplications,
});

function AdminApplications() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending: checkingRole } = useQuery({
    ...isAdminQuery(user?.id),
    enabled: !loading,
  });
  const load = useServerFn(listProApplications);
  const review = useServerFn(reviewProApplication);
  const auditLoad = useServerFn(listProApplicationAudit);
  const [filter, setFilter] = useState<string>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notify, setNotify] = useState(true);
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const [openReview, setOpenReview] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => load(),
    enabled: isAdmin === true,
  });

  const audit = useQuery({
    queryKey: ["admin-applications", "audit", openAudit ?? "all"],
    enabled: isAdmin === true,
    queryFn: () =>
      auditLoad({
        data: openAudit ? { applicationId: openAudit } : {},
      }),
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      id: string;
      status: string;
      note?: string;
      notify?: boolean;
    }) => review({ data: vars }),
    onSuccess: (result) => {
      toast.success(
        result?.notified
          ? "Application updated — the firm has been emailed."
          : "Application updated.",
      );
      void refetch();
      void audit.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || (user && checkingRole))
    return <Section>Checking access…</Section>;

  if (!isAdmin) {
    return (
      <Section>
        <p className="inline-flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" /> Admins only.
        </p>
      </Section>
    );
  }

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (tradeFilter !== "all" && (a.trade_slug ?? "") !== tradeFilter)
      return false;
    if (from && a.created_at.slice(0, 10) < from) return false;
    if (to && a.created_at.slice(0, 10) > to) return false;
    if (
      term &&
      ![a.company, a.contact_name, a.email, a.postcode, a.reference ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    )
      return false;
    return true;
  });

  const trades = Array.from(
    new Set((data ?? []).map((a) => a.trade_slug).filter(Boolean)),
  ).sort() as string[];

  const counts = (data ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const exportCsv = () => {
    const head = [
      "created_at",
      "reference",
      "company",
      "contact_name",
      "email",
      "phone",
      "trade_slug",
      "postcode",
      "years",
      "companies_house",
      "insurance_provider",
      "insurance_expiry",
      "accreditations",
      "status",
    ];
    const body = (data ?? []).map((a) =>
      head
        .map((k) => `"${String((a as never)[k] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...body].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pro-applications.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section>
      <SectionHead
        eyebrow="Vetting"
        title="Certification applications"
        sub="Firms that applied to be listed. Nothing here is public — approving an application is a note to yourself that the checks passed, not a publish action."
      />

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-sm border px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest ${
              filter === s
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {s.replace("_", " ")}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
        <Link
          to="/admin/sla"
          className="ml-auto rounded-sm border border-border-strong px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
        >
          SLA dashboard
        </Link>
        <button
          onClick={exportCsv}
          className="rounded-sm border border-border-strong px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, contact, email, postcode, ref"
          className="w-72 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="all">All trades</option>
          {trades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">
          From{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          To{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Email the firm on decisions
        </label>
        <button
          onClick={() => {
            setSearch("");
            setTradeFilter("all");
            setFrom("");
            setTo("");
          }}
          className="rounded-sm border border-border px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
        >
          Clear
        </button>
      </div>

      <ul className="mt-6 grid gap-4">
        {rows.map((a) => (
          <li key={a.id} className="rounded-md border border-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl">{a.company}</h2>
              <span className="eyebrow !mb-0">
                {a.reference ? `${a.reference} · ` : ""}
                {a.status.replace("_", " ")} ·{" "}
                {new Date(a.created_at).toLocaleDateString("en-GB")}
                {a.due_at && OPEN_STATUSES.includes(a.status) && (
                  <span
                    className={
                      new Date(a.due_at).getTime() < Date.now()
                        ? " text-destructive"
                        : " text-muted-foreground"
                    }
                  >
                    {" "}
                    · {new Date(a.due_at).getTime() < Date.now()
                      ? "overdue"
                      : `due ${new Date(a.due_at).toLocaleDateString("en-GB")}`}
                  </span>
                )}
                {a.priority !== "normal" ? ` · ${a.priority}` : ""}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {a.contact_name} · {a.email}
              {a.phone ? ` · ${a.phone}` : ""} · {a.postcode} ·{" "}
              {a.trade_slug ?? "trade not given"} · {a.years} yrs
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {a.companies_house ? `CH ${a.companies_house}` : "No CH number"} ·{" "}
              {a.insurance_provider ?? "No insurer"}
              {a.insurance_expiry ? ` (to ${a.insurance_expiry})` : ""} ·{" "}
              {a.accreditations || "No accreditations listed"}
            </p>
            {a.about && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed">{a.about}</p>
            )}
            {a.reviewer_note && (
              <p className="mt-3 text-sm text-muted-foreground">
                Note: {a.reviewer_note}
              </p>
            )}
            {(a.requested_fields ?? []).length > 0 && (
              <p className="mt-2 text-sm text-primary">
                Waiting on the firm for: {a.requested_fields.join(", ")}
              </p>
            )}
            {a.applicant_message && (
              <p className="mt-2 text-sm text-muted-foreground">
                Firm replied: "{a.applicant_message}"
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                value={notes[a.id] ?? ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [a.id]: e.target.value }))
                }
                placeholder="Reviewer note"
                className="w-64 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {STATUSES.filter((s) => s !== a.status).map((s) => (
                <button
                  key={s}
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      id: a.id,
                      status: s,
                      notify,
                      ...(notes[a.id] ? { note: notes[a.id] } : {}),
                    })
                  }
                  className="rounded-sm border border-border-strong px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {s.replace("_", " ")}
                </button>
              ))}
              <button
                onClick={() =>
                  setOpenReview((cur) => (cur === a.id ? null : a.id))
                }
                className="rounded-sm border border-border px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
              >
                {openReview === a.id ? "Hide checks" : "Checks & documents"}
              </button>
              <button
                onClick={() =>
                  setOpenAudit((cur) => (cur === a.id ? null : a.id))
                }
                className="rounded-sm border border-border px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
              >
                {openAudit === a.id ? "Hide history" : "History"}
              </button>
              <a
                href={`mailto:${a.email}?subject=${encodeURIComponent(
                  `TradesmanFinder certification (${a.reference ?? ""})`,
                )}`}
                className="rounded-sm border border-border px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
              >
                Email firm
              </a>
            </div>

            {openReview === a.id && (
              <AdminApplicationReview
                application={a}
                notify={notify}
                onChanged={() => {
                  void refetch();
                  void audit.refetch();
                }}
              />
            )}

            {openAudit === a.id && (
              <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
                {(audit.data ?? []).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-muted-foreground"
                  >
                    <span>
                      {entry.action.replace("_", " ")}
                      {entry.from_status
                        ? ` — from ${entry.from_status.replace("_", " ")}`
                        : ""}
                      {entry.changed_by_email
                        ? ` · ${entry.changed_by_email}`
                        : " · system"}
                      {entry.reviewer_note ? ` · "${entry.reviewer_note}"` : ""}
                    </span>
                    <span>
                      {new Date(entry.created_at).toLocaleString("en-GB")}
                    </span>
                  </li>
                ))}
                {(audit.data ?? []).length === 0 && (
                  <li className="text-muted-foreground">
                    {audit.isPending ? "Loading history…" : "No history yet."}
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            Nothing in this queue.
          </li>
        )}
      </ul>
    </Section>
  );
}
