import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/layout-bits";

const SITE = "https://tradesmanfinder.org";

export const Route = createFileRoute("/waiting-list/thanks")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { area?: string; pending?: boolean; waiting?: number } => ({
    ...(typeof search["area"] === "string" && search["area"]
      ? { area: search["area"] }
      : {}),
    ...(search["pending"] === true || search["pending"] === "true"
      ? { pending: true }
      : {}),
    ...(Number(search["waiting"]) > 0
      ? { waiting: Number(search["waiting"]) }
      : {}),
  }),
  head: () => {
    const description =
      "You're on the TradesmanFinder waiting list — we'll email you the moment we open in your area.";
    return {
      meta: [
        { title: "You're on the list | TradesmanFinder" },
        { name: "description", content: description },
        { property: "og:title", content: "You're on the list" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "You're on the list" },
        { name: "twitter:description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:url", content: `${SITE}/waiting-list/thanks` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/waiting-list/thanks` }],
    };
  },
  component: WaitingListThanks,
});

function WaitingListThanks() {
  const { area, pending, waiting } = Route.useSearch();
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow">
          {pending ? "One last step" : "You're on the list"}
        </p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          {pending ? "Check your inbox." : "Thanks — we'll be in touch."}
        </h1>
        <p className="mt-5 text-muted-foreground">
          {pending ? (
            <>
              We've emailed you a confirmation link. Click it and your place
              {area ? ` in ${area}` : ""} is active — until then we won't send
              you anything else. Can't see it? Check your spam folder.
            </>
          ) : (
            <>
              We'll email you the moment TradesmanFinder opens
              {area ? ` in ${area}` : " in your area"}. The more people join
              from your postcode, the sooner that happens — feel free to share
              the waiting list with a neighbour or a local trade.
            </>
          )}
        </p>

        {waiting && waiting > 1 ? (
          <p className="mt-6 rounded-md border border-border bg-card px-6 py-5 text-muted-foreground">
            <strong className="text-foreground">{waiting} people</strong> are
            now waiting in {area || "your postcode area"}. We open an area once
            around 25 confirmed sign-ups are in — you can{" "}
            <Link
              to="/coverage"
              className="font-medium text-primary underline underline-offset-2"
            >
              track the progress here
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-sm border border-border-strong px-6 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Back to home
          </Link>
          <Link
            to="/areas"
            className="rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            See where we're live
          </Link>
        </div>
      </div>
    </Section>
  );
}
