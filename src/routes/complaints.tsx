import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, SectionHead } from "@/components/layout-bits";
import { breadcrumbSchema, ldScript } from "@/lib/structured-data";

const SITE = "https://tradesmanfinder.org";

export const Route = createFileRoute("/complaints")({
  head: () => {
    const title = "If something goes wrong | TradesmanFinder";
    const description =
      "How to report a problem with a firm you found on TradesmanFinder, what we do about it, how long it takes, and what we cannot do.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/complaints` },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/complaints` }],
      scripts: [
        ldScript(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "If something goes wrong", path: "/complaints" },
          ]),
        ),
      ],
    };
  },
  component: Complaints,
});

const steps = [
  {
    title: "Tell us",
    body: "Open your job page using the link in your confirmation email and choose Report a problem. You can report a problem with the firm you chose for that job.",
  },
  {
    title: "We acknowledge it",
    body: "You get an email with a reference straight away, and a person at TradesmanFinder reads your report within 2 working days.",
  },
  {
    title: "We ask the firm",
    body: "We share what you wrote with the firm and ask it to respond within 5 working days. We do not share your contact details again; the firm already has them from quoting for your job.",
  },
  {
    title: "We tell you the outcome",
    body: "We email you what we found and what we decided, and we tell the firm too.",
  },
];

function Complaints() {
  return (
    <>
      <Section>
        <SectionHead
          eyebrow="Customer protection"
          title="If something goes wrong."
          sub="Most jobs go well. If yours doesn't, tell us. This page sets out exactly what we will do, how long it takes, and what we cannot do."
        />
        <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className="bg-card p-8">
              <p className="font-display text-sm text-primary">Step {index + 1}</p>
              <h2 className="mt-2 text-xl">{step.title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="border-t border-border">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl">What we can do</h2>
            <ul className="mt-4 grid gap-3 text-muted-foreground">
              <li>Keep a record of the problem against the firm.</li>
              <li>Warn the firm.</li>
              <li>Suspend the firm's listing while we look into it.</li>
              <li>Remove the firm from TradesmanFinder.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl">What we cannot do</h2>
            <ul className="mt-4 grid gap-3 text-muted-foreground">
              <li>Make a firm redo work, finish a job or give you a refund.</li>
              <li>Award compensation or act as a court.</li>
              <li>
                Guarantee any job. Your agreement for the work is with the firm, not with
                TradesmanFinder.
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section className="border-t border-border">
        <h2 className="text-2xl">Your legal rights</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
          Reporting a problem to us does not affect your legal rights against the firm. For free
          advice on what those are and how to use them, contact{" "}
          <a
            href="https://www.citizensadvice.org.uk/consumer/"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Citizens Advice
          </a>
          . If you are in immediate danger, for example from unsafe gas or electrical work, call the
          emergency number on your gas or electricity bill first.
        </p>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
          Can't find your job link, or the problem is about something else? Email{" "}
          <a href="mailto:hello@tradesmanfinder.org" className="text-primary hover:underline">
            hello@tradesmanfinder.org
          </a>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/verification"
            className="inline-flex rounded-sm border border-border-strong px-6 py-3 font-display font-semibold hover:border-primary hover:text-primary"
          >
            How we check firms
          </Link>
          <Link
            to="/terms"
            className="inline-flex rounded-sm border border-border-strong px-6 py-3 font-display font-semibold hover:border-primary hover:text-primary"
          >
            Terms of use
          </Link>
        </div>
      </Section>
    </>
  );
}
