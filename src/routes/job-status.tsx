import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section } from "@/components/layout-bits";
import { MatchedPros } from "@/components/matched-pros";
import { getJobByLink } from "@/lib/job-link.functions";

type Search = { t?: string };

export const Route = createFileRoute("/job-status")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["t"] === "string" ? { t: search["t"].slice(0, 200) } : {},
  head: () => ({
    meta: [
      { title: "Your job | TradesmanFinder" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: JobStatus,
});

const STATUS: Record<string, string> = {
  open: "Open — firms can register interest",
  matched: "Matched with a firm",
  closed: "Closed",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function JobStatus() {
  const { t: token = "" } = Route.useSearch();
  const {
    data: job,
    isPending,
    error,
  } = useQuery({
    queryKey: ["job-link", token],
    queryFn: () => getJobByLink({ data: { token } }),
    enabled: Boolean(token),
    retry: false,
  });

  if (!token || error) {
    return (
      <Section>
        <div className="mx-auto max-w-xl rounded-md border border-border bg-card p-8">
          <h1 className="text-2xl">We couldn't open that job</h1>
          <p role="alert" className="mt-3 text-muted-foreground">
            {error?.message ?? "This page needs the link from your confirmation email."}
          </p>
          <Link
            to="/post-job"
            search={{}}
            className="mt-6 inline-flex rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Post a job
          </Link>
        </div>
      </Section>
    );
  }
  if (isPending) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading your job…</p>
      </Section>
    );
  }

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Your job · {job.reference}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">{job.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {job.trade} · {job.postcode} · posted {day(job.created_at)}
        </p>

        <div className="mt-8 rounded-md border border-border bg-card p-6 sm:p-7">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Status</dt>
              <dd className="mt-1 text-sm">{STATUS[job.status] ?? job.status}</dd>
            </div>
            <div>
              <dt className="eyebrow">When</dt>
              <dd className="mt-1 text-sm">{job.timing}</dd>
            </div>
            <div>
              <dt className="eyebrow">Reference</dt>
              <dd className="mt-1 font-display text-sm">{job.reference}</dd>
            </div>
          </dl>
          <p className="mt-6 whitespace-pre-line text-muted-foreground">{job.description}</p>
        </div>

        <h2 className="mt-12 text-2xl">Firms interested in your job</h2>
        {job.interests.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            No firm has registered interest yet. We'll email you as soon as one does.
          </p>
        ) : (
          <ul className="mt-5 grid gap-4">
            {job.interests.map((interest) => (
              <li key={interest.pro_id} className="rounded-md border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">{interest.company}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {interest.name} · interested {day(interest.created_at)}
                    </p>
                  </div>
                  <Link
                    to="/pro/$id"
                    params={{ id: interest.pro_id }}
                    className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
                  >
                    View profile and contact
                  </Link>
                </div>
                {interest.message ? (
                  <p className="mt-4 border-l-2 border-border pl-4 text-sm text-muted-foreground">
                    {interest.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Interested firms can't see your name, email address or full postcode. Only firms you
          contact from their profile get your details.
        </p>

        <h2 className="mt-12 text-2xl">Firms we've matched to your job</h2>
        <MatchedPros trade={job.trade_slug} postcode={job.postcode} budget={job.budget_band} />

        <p className="mt-12 text-sm text-muted-foreground">
          This page is private to you. Anyone with the link can see it, so please don't share it. To
          change or remove this job, email{" "}
          <a href="mailto:hello@tradesmanfinder.org" className="text-primary hover:underline">
            hello@tradesmanfinder.org
          </a>{" "}
          with your reference.
        </p>
      </div>
    </Section>
  );
}
