import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { isAdminQuery } from "@/lib/queries";
import { adminNumbers, type Numbers } from "@/lib/admin-numbers.functions";

export const Route = createFileRoute("/admin/numbers")({
  head: () => ({
    meta: [
      { title: "Numbers — admin | TradesmanFinder" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminNumbers,
});

function AdminNumbers() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending } = useQuery({ ...isAdminQuery(user?.id), enabled: !loading });

  if (loading || (user && isPending)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user || !isAdmin) {
    return (
      <Section>
        <div className="max-w-xl rounded-md border border-border bg-card p-8">
          <h1 className="text-2xl">{user ? "Admins only" : "Sign in required"}</h1>
          <p className="mt-3 text-muted-foreground">
            {user
              ? "Your account does not hold the admin role."
              : "The admin area is only open to signed-in admins."}
          </p>
          {!user && (
            <Link
              to="/signin"
              search={{ redirect: "/admin/numbers" }}
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </Section>
    );
  }
  return <NumbersPage />;
}

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="bg-card p-6">
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-display text-3xl">{value}</dd>
      {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}

const grid = "mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border";
const dash = (value: number | null, suffix = "") =>
  value === null ? "No data yet" : `${value}${suffix}`;

function NumbersPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["admin", "numbers"],
    queryFn: () => adminNumbers(),
    staleTime: 60_000,
  });

  return (
    <Section>
      <Link to="/admin" className="text-sm text-primary hover:underline">
        ← Admin home
      </Link>
      <div className="mt-4">
        <SectionHead
          eyebrow="Admin"
          title="Numbers"
          sub="Supply, demand and how far jobs get, counted from the database. Example listings are left out. Nothing here uses cookies or tracking."
        />
      </div>
      {isPending ? (
        <p className="mt-8 text-muted-foreground">Counting…</p>
      ) : error ? (
        <p role="alert" className="mt-8 text-muted-foreground">
          {error.message}
        </p>
      ) : (
        <Report data={data} />
      )}
    </Section>
  );
}

function Report({ data }: { data: Numbers }) {
  const { supply, demand, funnel, quality } = data;
  const steps: { label: string; value: number }[] = [
    { label: "Jobs posted", value: funnel.jobs },
    { label: "A firm registered interest", value: funnel.withInterest },
    { label: "Homeowner invited a firm to quote", value: funnel.withInvite },
    { label: "At least one quote sent", value: funnel.withQuote },
    { label: "A quote accepted", value: funnel.accepted },
    { label: "Work marked complete", value: funnel.completed },
    { label: "Reviewed", value: funnel.reviewed },
  ];
  const top = Math.max(funnel.jobs, 1);

  return (
    <>
      <p className="mt-6 text-sm text-muted-foreground">
        Counted {new Date(data.generatedAt).toLocaleString("en-GB")}.
      </p>

      <h2 className="mt-10 text-2xl">Firms</h2>
      <dl className={`${grid} sm:grid-cols-2 lg:grid-cols-4`}>
        <Tile label="Published listings" value={supply.listed} />
        <Tile label="With an account" value={supply.withAccount} />
        <Tile
          label="Can quote"
          value={supply.canQuote}
          note="Has an account and insurance that is checked and in date."
        />
        <Tile label="Invited, not yet joined" value={supply.invitedNotJoined} />
      </dl>

      <h2 className="mt-12 text-2xl">Homeowners</h2>
      <dl className={`${grid} sm:grid-cols-2 lg:grid-cols-4`}>
        <Tile label="Jobs posted, last 7 days" value={demand.jobs7} />
        <Tile label="Jobs posted, last 30 days" value={demand.jobs30} />
        <Tile label="Jobs posted, all time" value={demand.jobsTotal} />
        <Tile label="On the waiting list" value={demand.waitingList} />
      </dl>

      <h2 className="mt-12 text-2xl">How far jobs get</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Each row counts jobs that reached that step, out of every job posted.
      </p>
      <ol className="mt-5 grid gap-3">
        {steps.map((step) => {
          const share = Math.round((step.value / top) * 100);
          return (
            <li key={step.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{step.label}</span>
                <span className="font-display">
                  {step.value}
                  <span className="ml-2 text-muted-foreground">
                    {funnel.jobs ? `${share}%` : ""}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
                <div className="h-full bg-primary" style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-12 text-2xl">Quotes, reviews and complaints</h2>
      <dl className={`${grid} sm:grid-cols-2 lg:grid-cols-4`}>
        <Tile label="Quotes per quoted job" value={dash(quality.quotesPerQuotedJob)} />
        <Tile
          label="Time to first quote"
          value={dash(quality.medianHoursToFirstQuote, " hours")}
          note="Median, from job posted to first quote sent."
        />
        <Tile label="Reviews published" value={quality.reviewsPublished} />
        <Tile label="Average rating" value={dash(quality.averageRating, " / 5")} />
        <Tile label="Complaints, all time" value={quality.complaintsTotal} />
        <Tile label="Complaints open" value={quality.complaintsOpen} />
        <Tile
          label="Complaints per 100 completed jobs"
          value={dash(quality.complaintsPer100Completed)}
        />
        <Tile label="Days to resolve a complaint" value={dash(quality.averageDaysToResolve)} />
      </dl>

      <h2 className="mt-12 text-2xl">Where you have firms</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        A homeowner's job only gets an answer where at least one firm in that trade and area can
        quote. Rows showing 0 are listed but cannot quote yet.
      </p>
      {supply.coverage.length === 0 ? (
        <p className="mt-5 text-muted-foreground">No published listings yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Area
                </th>
                <th scope="col" className="px-4 py-3">
                  Trade
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Listed
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Can quote
                </th>
              </tr>
            </thead>
            <tbody>
              {supply.coverage.map((row) => (
                <tr key={`${row.area}-${row.trade}`} className="border-t border-border bg-card">
                  <td className="px-4 py-3">{row.area}</td>
                  <td className="px-4 py-3">{row.trade}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.listed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.canQuote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
