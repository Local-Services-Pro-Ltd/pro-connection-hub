import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { isAdminQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  listProApplications,
  reviewProApplication,
} from "@/lib/applications.functions";

const STATUSES = ["pending", "in_review", "approved", "rejected"] as const;

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
  const [filter, setFilter] = useState<string>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, refetch } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => load(),
    enabled: isAdmin === true,
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: string; note?: string }) =>
      review({ data: vars }),
    onSuccess: () => {
      toast.success("Application updated.");
      void refetch();
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

  const rows = (data ?? []).filter(
    (a) => filter === "all" || a.status === filter,
  );

  const exportCsv = () => {
    const head = [
      "created_at",
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
          </button>
        ))}
        <button
          onClick={exportCsv}
          className="ml-auto rounded-sm border border-border-strong px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
        >
          Export CSV
        </button>
      </div>

      <ul className="mt-6 grid gap-4">
        {rows.map((a) => (
          <li key={a.id} className="rounded-md border border-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl">{a.company}</h2>
              <span className="eyebrow !mb-0">
                {a.status.replace("_", " ")} ·{" "}
                {new Date(a.created_at).toLocaleDateString("en-GB")}
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
                  onClick={() =>
                    mutation.mutate({
                      id: a.id,
                      status: s,
                      ...(notes[a.id] ? { note: notes[a.id] } : {}),
                    })
                  }
                  className="rounded-sm border border-border-strong px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
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
