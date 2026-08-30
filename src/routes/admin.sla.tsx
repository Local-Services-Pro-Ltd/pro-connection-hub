import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlarmClock, Lock } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { isAdminQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  escalateApplication,
  getApplicationSla,
  listProApplications,
} from "@/lib/applications.functions";
import {
  APPLICATION_STATUS_LABEL,
  OPEN_STATUSES,
} from "@/lib/application-verification";

export const Route = createFileRoute("/admin/sla")({
  head: () => ({
    meta: [
      { title: "Certification SLA dashboard — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Overdue certifications, average review times and escalation actions for stuck TradesmanFinder applications.",
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
  component: AdminSla,
});

function hours(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value < 48) return `${value}h`;
  return `${(value / 24).toFixed(1)} days`;
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "alert" | "good";
}) {
  return (
    <div className="bg-card p-6">
      <p className="eyebrow">{label}</p>
      <p
        className={`font-display text-3xl font-semibold ${
          tone === "alert"
            ? "text-destructive"
            : tone === "good"
              ? "text-success"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AdminSla() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending: checkingRole } = useQuery({
    ...isAdminQuery(user?.id),
    enabled: !loading,
  });
  const loadSla = useServerFn(getApplicationSla);
  const loadApps = useServerFn(listProApplications);
  const escalate = useServerFn(escalateApplication);

  const sla = useQuery({
    queryKey: ["admin-sla"],
    queryFn: () => loadSla(),
    enabled: isAdmin === true,
  });
  const apps = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => loadApps(),
    enabled: isAdmin === true,
  });

  const escalation = useMutation({
    mutationFn: (id: string) =>
      escalate({ data: { id, priority: "urgent", dueInHours: 24 } }),
    onSuccess: () => {
      toast.success("Escalated — due within 24 hours.");
      void sla.refetch();
      void apps.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || (user && checkingRole))
    return <Section>Checking access…</Section>;

  if (!isAdmin)
    return (
      <Section>
        <p className="inline-flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" /> Admins only.
        </p>
      </Section>
    );

  const now = Date.now();
  const open = (apps.data ?? []).filter((a) => OPEN_STATUSES.includes(a.status));
  const overdue = open
    .filter((a) => a.due_at && new Date(a.due_at).getTime() < now)
    .sort(
      (a, b) =>
        new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime(),
    );
  const s = sla.data;

  return (
    <Section>
      <SectionHead
        eyebrow="Vetting performance"
        title="Certification SLA"
        sub="Our promise is a first response within two working days and a decision within five. This is where we hold ourselves to it."
      />

      <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open applications" value={s?.open_total ?? "—"} />
        <Stat
          label="Overdue"
          value={s?.overdue ?? "—"}
          tone={(s?.overdue ?? 0) > 0 ? "alert" : "good"}
        />
        <Stat label="Due in 24 hours" value={s?.due_soon ?? "—"} />
        <Stat
          label="Escalated"
          value={s?.escalated ?? "—"}
          tone={(s?.escalated ?? 0) > 0 ? "alert" : "default"}
        />
        <Stat
          label="Avg first response"
          value={hours(s?.avg_first_response_hours)}
        />
        <Stat label="Avg decision" value={hours(s?.avg_decision_hours)} />
        <Stat label="Waiting on the firm" value={s?.awaiting_firm ?? "—"} />
        <Stat
          label="Decided (30 days)"
          value={`${s?.approved_30d ?? 0} / ${(s?.approved_30d ?? 0) + (s?.rejected_30d ?? 0)}`}
        />
        <Stat
          label="Insurance expired"
          value={s?.insurance_expired ?? "—"}
          tone={(s?.insurance_expired ?? 0) > 0 ? "alert" : "good"}
        />
        <Stat
          label="Insurance expiring (60 days)"
          value={s?.insurance_expiring_60d ?? "—"}
        />
      </div>

      <h2 className="mt-12 text-2xl">Overdue and stuck</h2>
      <ul className="mt-5 grid gap-3">
        {overdue.map((a) => {
          const late = Math.floor(
            (now - new Date(a.due_at as string).getTime()) / 86_400_000,
          );
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold">
                  {a.company}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {a.reference ?? ""} ·{" "}
                    {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </p>
                <p className="text-sm text-destructive">
                  {late === 0 ? "Due today" : `${late} day${late === 1 ? "" : "s"} overdue`}
                  {a.escalated_at ? " · already escalated" : ""}
                </p>
              </div>
              <button
                disabled={escalation.isPending}
                onClick={() => escalation.mutate(a.id)}
                className="rounded-sm border border-border-strong px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <AlarmClock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Escalate
              </button>
              <Link
                to="/admin/applications"
                className="rounded-sm border border-border px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
              >
                Open queue
              </Link>
            </li>
          );
        })}
        {overdue.length === 0 && (
          <li className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
            {apps.isPending
              ? "Loading applications…"
              : "Nothing overdue — the queue is inside SLA."}
          </li>
        )}
      </ul>
    </Section>
  );
}
