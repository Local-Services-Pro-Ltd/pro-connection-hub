import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Section } from "@/components/layout-bits";
import { getRequestOrigin } from "@/lib/origin.functions";

export const Route = createFileRoute("/terms")({
  loader: async () => ({ origin: await getRequestOrigin() }),
  head: ({ loaderData }) => {
    const title = "Terms of Use | TradesmanFinder";
    const description =
      "The rules for using TradesmanFinder — posting jobs, contacting trades, writing reviews, and what we are and aren't responsible for.";
    const base = loaderData?.origin ?? "";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: "Terms of Use — TradesmanFinder" },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${base}/terms` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${base}/terms` }],
    };
  },
  component: TermsPage,
});

function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Use"
        sub="Plain-English rules for homeowners and trades using TradesmanFinder."
      />
      <Section>
        <div className="max-w-3xl space-y-8">
          <p className="text-sm text-muted-foreground">
            Last updated {new Date().getFullYear()}. By using TradesmanFinder
            you agree to these terms. TradesmanFinder is part of Local Services
            Pro and All Care 4 U Group.
          </p>

          <Block title="What TradesmanFinder is">
            <p>
              We are an introduction service. We connect homeowners with
              independent tradespeople. We are not a party to any contract you
              agree with a trade, and we don't carry out the work ourselves.
            </p>
          </Block>

          <Block title="Using the site">
            <ul className="list-disc space-y-2 pl-5">
              <li>Give accurate details when posting a job or creating an account.</li>
              <li>You're responsible for anything done through your account.</li>
              <li>
                Don't misuse the service — no spam, scraping, impersonation, or
                attempts to interfere with the site or other users.
              </li>
              <li>You must be 18 or over to post a job or register as a trade.</li>
            </ul>
          </Block>

          <Block title="Quotes and hiring">
            <p>
              Quotes come from independent trades and are theirs, not ours.
              Always agree scope, price and timings directly with the trade, and
              satisfy yourself about their insurance and qualifications before
              work starts.
            </p>
          </Block>

          <Block title="Reviews">
            <p>
              Reviews must describe genuine experience of work arranged through
              the site. We may remove reviews that are false, abusive, defamatory
              or incentivised. You keep ownership of what you write and give us
              permission to display it.
            </p>
          </Block>

          <Block title="Trade memberships">
            <p>
              Trades pay a flat membership rather than per-lead fees. Membership
              renews on the stated cycle and can be cancelled before the next
              renewal date. Listings may be suspended where we receive credible
              reports of poor conduct.
            </p>
          </Block>

          <Block title="Liability">
            <p>
              We take reasonable care to keep listings accurate, but we don't
              guarantee the quality, timing or outcome of any work. To the extent
              permitted by law, we're not liable for losses arising from your
              dealings with a trade or homeowner. Nothing here limits liability
              that can't be limited by law.
            </p>
          </Block>

          <Block title="Changes and contact">
            <p>
              We may update these terms as the service develops; the date above
              shows the latest version. Questions? Email{" "}
              <a
                href="mailto:hello@tradesmanfinder.org"
                className="font-semibold text-primary underline underline-offset-4"
              >
                hello@tradesmanfinder.org
              </a>
              .
            </p>
          </Block>
        </div>
      </Section>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
