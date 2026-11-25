import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Section } from "@/components/layout-bits";
import { MatchedPros } from "@/components/matched-pros";
import { JobAfterPanel } from "@/components/job-after";
import { JobSteps, QuoteCompare } from "@/components/quote-compare";
import { getJobAfter } from "@/lib/after-job.functions";
import { afterStep } from "@/lib/after-job.shared";
import { getJobByLink } from "@/lib/job-link.functions";
import { decideQuote, getJobQuotes, inviteToQuote } from "@/lib/quotes.functions";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes.shared";

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

  const queryClient = useQueryClient();
  const quotes = useQuery({
    queryKey: ["job-quotes", token],
    queryFn: () => getJobQuotes({ data: { token } }),
    enabled: Boolean(token) && Boolean(job),
    retry: false,
  });
  const after = useQuery({
    queryKey: ["job-after", token],
    queryFn: () => getJobAfter({ data: { token } }),
    enabled: Boolean(token) && Boolean(job),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["job-quotes", token] });
  const invite = useMutation({
    mutationFn: (proId: string) => inviteToQuote({ data: { token, proId } }),
    onSuccess: async () => {
      toast.success("Invitation sent. We'll email you when their quote arrives.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decide = useMutation({
    mutationFn: (input: { quoteId: string; decision: "accept" | "decline" }) =>
      decideQuote({ data: { token, ...input } }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.decision === "accept"
          ? "Quote accepted. We've told the firm and given them your details."
          : "Quote declined. We've let the firm know.",
      );
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["job-link", token] });
      await queryClient.invalidateQueries({ queryKey: ["job-after", token] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const received = quotes.data?.quotes ?? [];
  const chosen = quotes.data?.chosen ?? null;
  const invitedStatus = new Map(
    (quotes.data?.invited ?? []).map((row) => [row.pro_id, row.status]),
  );
  const quoteReady = new Set(quotes.data?.quoteReady ?? []);
  const canInvite = Boolean(quotes.data) && !chosen && (quotes.data?.invitesLeft ?? 0) > 0;
  const step: 0 | 1 | 2 | 3 | 4 = chosen ? afterStep(after.data) : received.length > 0 ? 1 : 0;

  return (
    <Section>
      <div className="mx-auto max-w-5xl">
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

        <JobSteps step={step} />

        {received.length > 0 && (
          <>
            <h2 className="mt-12 text-2xl">
              {chosen ? `You chose ${chosen.company}` : "Compare your quotes"}
            </h2>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              {chosen
                ? "We've told the firm and given them your contact details. Agree the start date with them and get the agreement in writing before work begins."
                : "Every quote uses the same headings in the same order. Accepting one tells that firm you'd like to go ahead and lets the others know."}
            </p>
            <QuoteCompare
              quotes={received}
              busy={decide.isPending}
              canDecide={!chosen}
              onDecide={(quoteId, decision) => {
                if (
                  decision === "accept" &&
                  !window.confirm(
                    "Accept this quote? We'll tell this firm you'd like to go ahead and let the other firms know.",
                  )
                )
                  return;
                decide.mutate({ quoteId, decision });
              }}
            />
          </>
        )}

        {chosen && <JobAfterPanel token={token} />}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/pro/$id"
                      params={{ id: interest.pro_id }}
                      className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
                    >
                      Profile and checks
                    </Link>
                    {invitedStatus.has(interest.pro_id) ? (
                      <span className="rounded-sm bg-primary/15 px-3 py-2 text-sm font-medium">
                        {invitedStatus.get(interest.pro_id) === "invited" ||
                        invitedStatus.get(interest.pro_id) === "draft"
                          ? "Invited, quote awaited"
                          : QUOTE_STATUS_LABEL[invitedStatus.get(interest.pro_id)!]}
                      </span>
                    ) : !quoteReady.has(interest.pro_id) ? (
                      <span className="rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground">
                        Can't quote yet: insurance check not finished
                      </span>
                    ) : canInvite ? (
                      <button
                        type="button"
                        disabled={invite.isPending}
                        onClick={() => invite.mutate(interest.pro_id)}
                        className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                      >
                        Invite to quote
                      </button>
                    ) : null}
                  </div>
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
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          Interested firms can't see your name, email address or full postcode. Inviting a firm to
          quote shares those three details with that firm only, so it can price the job properly.
          {quotes.data && !chosen
            ? ` You can invite ${quotes.data.invitesLeft} more ${
                quotes.data.invitesLeft === 1 ? "firm" : "firms"
              }, up to three in total.`
            : ""}
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
