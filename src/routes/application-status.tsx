import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Clock, Search, XCircle } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { getApplicationStatus } from "@/lib/applications.functions";

const SITE = "https://tradesmanfinder.org";

const STAGES = [
  {
    key: "pending",
    title: "Received",
    body: "Your application is in the queue. A human reads every one.",
  },
  {
    key: "in_review",
    title: "Checks under way",
    body: "We're verifying your insurance, registration and accreditations with the bodies that issued them.",
  },
  {
    key: "approved",
    title: "Decision",
    body: "Approved firms get a checked profile. If something's missing, we say exactly what.",
  },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "In the queue",
  in_review: "Being checked",
  approved: "Approved",
  rejected: "Not certified yet",
};

export const Route = createFileRoute("/application-status")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search["token"] === "string" && search["token"]
      ? { token: search["token"] }
      : {},
  head: () => {
    const description =
      "Track the progress of your TradesmanFinder certification application using the tracking link from your confirmation email.";
    return {
      meta: [
        { title: "Track your certification application | TradesmanFinder" },
        { name: "description", content: description },
        { property: "og:title", content: "Track your certification application" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Track your certification application" },
        { name: "twitter:description", content: description },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/application-status` }],
    };
  },
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
  component: ApplicationStatusPage,
});

function ApplicationStatusPage() {
  const { token } = Route.useSearch();
  const navigate = Route.useNavigate();
  const load = useServerFn(getApplicationStatus);
  const [entered, setEntered] = useState(token ?? "");

  const status = useQuery({
    queryKey: ["application-status", token ?? ""],
    enabled: Boolean(token),
    retry: false,
    queryFn: () => load({ data: { token: token as string } }),
  });

  const data = status.data;
  const currentStage =
    data?.status === "approved" || data?.status === "rejected"
      ? 2
      : data?.status === "in_review"
        ? 1
        : 0;

  return (
    <>
      <Section>
        <SectionHead
          eyebrow="Certification"
          title="Track your application."
          sub="Paste the tracking link from your confirmation email — or the reference token in it — to see exactly where your firm is in the vetting process."
        />

        <form
          className="mt-8 flex max-w-xl flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const next = entered.trim().split("token=").pop() ?? "";
            void navigate({ search: next ? { token: next } : {} });
          }}
        >
          <label className="sr-only" htmlFor="tracking-token">
            Tracking token
          </label>
          <input
            id="tracking-token"
            value={entered}
            onChange={(e) => setEntered(e.target.value)}
            placeholder="Paste your tracking link or token"
            className="min-w-0 flex-1 rounded-sm border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground"
          >
            <Search className="h-4 w-4" aria-hidden="true" /> Check status
          </button>
        </form>
      </Section>

      <Section className="border-t border-border bg-surface">
        {!token ? (
          <p className="max-w-2xl text-muted-foreground">
            Haven't applied yet?{" "}
            <Link to="/claim" className="text-primary underline">
              Send your paperwork
            </Link>{" "}
            and we'll email you a tracking link straight away.
          </p>
        ) : status.isPending ? (
          <p className="text-muted-foreground">Looking up your application…</p>
        ) : status.isError ? (
          <p role="alert" className="text-muted-foreground">
            {(status.error as Error).message}
          </p>
        ) : data ? (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-md border border-border bg-card p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl">{data.company}</h2>
                <span className="eyebrow !mb-0">Ref {data.reference}</span>
              </div>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                {data.status === "approved" ? (
                  <BadgeCheck className="h-4 w-4 text-success" aria-hidden="true" />
                ) : data.status === "rejected" ? (
                  <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                )}
                {STATUS_LABEL[data.status] ?? data.status} · submitted{" "}
                {new Date(data.submitted_at).toLocaleDateString("en-GB")} ·{" "}
                {data.postcode}
              </p>
              {data.reviewer_note && (
                <p className="mt-4 border-l-2 border-primary bg-surface p-4 text-sm leading-relaxed">
                  {data.reviewer_note}
                </p>
              )}
              {data.verification &&
                "checks" in data.verification &&
                data.verification.checks.length > 0 && (
                  <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
                    {data.verification.checks.map((c) => (
                      <li key={c.key} className="flex flex-wrap gap-2">
                        <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {c.label}
                        </span>
                        <span
                          className={
                            c.outcome === "fail"
                              ? "text-destructive"
                              : c.outcome === "warn"
                                ? "text-primary"
                                : "text-success"
                          }
                        >
                          {CHECK_OUTCOME_LABEL[c.outcome]}
                        </span>
                        <span className="text-muted-foreground">{c.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            {token && (
              <div className="mt-6">
                <DocumentTracker
                  token={token}
                  documents={data.documents ?? []}
                  requestedKinds={(data.requested_fields ?? [])
                    .filter((f) => f.startsWith("document_"))
                    .map((f) => f.replace("document_", ""))}
                  onChange={() => void status.refetch()}
                />
              </div>
            )}

            {["changes_requested", "resubmitted", "pending"].includes(
              data.status,
            ) && (
              <ResubmitPanel
                token={token as string}
                requestedFields={data.requested_fields ?? []}
                status={data.status}
                onDone={() => void status.refetch()}
              />
            )}


            <ol className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
              {STAGES.map((stage, i) => (
                <li key={stage.key} className="bg-card p-6">
                  <span
                    className={`eyebrow ${i <= currentStage ? "text-primary" : ""}`}
                  >
                    Step {i + 1}
                  </span>
                  <h3 className="text-lg">
                    {i === 2 && data.status === "rejected"
                      ? "Decision — not yet"
                      : stage.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {stage.body}
                  </p>
                </li>
              ))}
            </ol>

            {data.timeline.length > 0 && (
              <div className="mt-6 rounded-md border border-border bg-card p-7">
                <h3 className="text-lg">History</h3>
                <ul className="mt-4 grid gap-3">
                  {data.timeline.map((event, i) => (
                    <li
                      key={`${event.created_at}-${i}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                    >
                      <span>
                        {event.action === "submitted"
                          ? "Application submitted"
                          : `Moved to ${STATUS_LABEL[event.to_status] ?? event.to_status}`}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(event.created_at).toLocaleString("en-GB")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Section>
    </>
  );
}
