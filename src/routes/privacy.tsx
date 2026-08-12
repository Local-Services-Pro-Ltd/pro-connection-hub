import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Section } from "@/components/layout-bits";
import { getRequestOrigin } from "@/lib/origin.functions";
import { openCookiePreferences } from "@/lib/cookie-consent";

export const Route = createFileRoute("/privacy")({
  loader: async () => ({ origin: await getRequestOrigin() }),
  head: ({ loaderData }) => {
    const title = "Privacy Policy | TradesmanFinder";
    const description =
      "How TradesmanFinder collects, uses and protects the details you share when you post a job, sign in or contact a trade.";
    const base = loaderData?.origin ?? "";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: "Privacy Policy — TradesmanFinder" },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${base}/privacy` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${base}/privacy` }],
    };
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        sub="What we collect when you use TradesmanFinder, why we collect it, and how you stay in control of it."
      />
      <Section>
        <div className="prose-tf max-w-3xl space-y-8">
          <p className="text-sm text-muted-foreground">
            Last updated {new Date().getFullYear()}. This policy is published by
            TradesmanFinder, part of Local Services Pro and All Care 4 U Group.
          </p>

          <Block title="What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Job details</strong> — the trade, area, budget,
                timescale and description you enter when posting a job.
              </li>
              <li>
                <strong>Contact details</strong> — your name, email and phone
                number where you give them, so trades can reply to you.
              </li>
              <li>
                <strong>Account details</strong> — if you sign in, the email
                address and basic profile from your chosen sign-in method.
              </li>
              <li>
                <strong>Reviews and feedback</strong> — anything you choose to
                write and submit on the site.
              </li>
              <li>
                <strong>Location</strong> — only if you explicitly allow it in
                your browser, and only while that permission is active.
              </li>
            </ul>
          </Block>

          <Block title="How we use it">
            <p>
              We use your details to match your job to relevant local trades,
              to let those trades respond, to run your account, to publish
              reviews you submit, and to keep the service secure and working.
              We do not sell your personal details.
            </p>
          </Block>

          <Block title="Who sees it">
            <p>
              Job details are shared with a small number of trades that cover
              your area and category so they can quote. Reviews you publish are
              visible to anyone using the site. Our hosting and database
              providers process data on our behalf under contract.
            </p>
          </Block>

          <Block title="Cookies and similar technology">
            <p>
              Necessary cookies keep you signed in and remember your display and
              consent choices. Optional analytics and personalisation cookies
              only run if you allow them.
            </p>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="mt-3 text-sm font-semibold text-primary underline underline-offset-4"
            >
              Change your cookie preferences
            </button>
          </Block>

          <Block title="Your choices">
            <ul className="list-disc space-y-2 pl-5">
              <li>Ask for a copy of the personal data we hold about you.</li>
              <li>Ask us to correct anything that's wrong.</li>
              <li>Ask us to delete your account and associated job posts.</li>
              <li>Withdraw location or cookie consent at any time.</li>
            </ul>
            <p className="mt-3">
              To make any of these requests, email{" "}
              <a
                href="mailto:privacy@tradesmanfinder.org"
                className="font-semibold text-primary underline underline-offset-4"
              >
                privacy@tradesmanfinder.org
              </a>
              .
            </p>
          </Block>

          <Block title="Contact">
            <p>
              Questions about this policy? Email{" "}
              <a
                href="mailto:hello@tradesmanfinder.org"
                className="font-semibold text-primary underline underline-offset-4"
              >
                hello@tradesmanfinder.org
              </a>{" "}
              and we'll come back to you.
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
