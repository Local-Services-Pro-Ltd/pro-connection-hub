import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { submitProApplication } from "@/lib/applications.functions";
import { tradesQuery } from "@/lib/queries";
import { joinFactTiles } from "@/lib/join-content";
import { breadcrumbSchema, ldScript, organizationSchema } from "@/lib/structured-data";

const SITE = "https://tradesmanfinder.org";

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

export const Route = createFileRoute("/join")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tradesQuery),
  head: () => {
    const title = "Join TradesmanFinder — get local jobs without paying for leads";
    const description =
      "Apply to join TradesmanFinder. Free while we onboard trades, no commission and no per-lead fees. A real person replies to every application within 5 working days.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/join` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: `${SITE}/join` }],
      scripts: [
        ldScript(organizationSchema()),
        ldScript(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "For tradesmen", path: "/for-tradesmen" },
            { name: "Join", path: "/join" },
          ]),
        ),
      ],
    };
  },
  component: Join,
});

const steps = [
  { title: "Apply", body: "Tell us about your business and the work you do. It takes about 5 minutes." },
  { title: "We review", body: "A real person looks at every application and replies within 5 working days." },
  {
    title: "Complete your checks",
    body: "We'll ask for photo ID and your public liability insurance, plus any trade registration your work needs (for example Gas Safe or NICEIC).",
  },
  {
    title: "Get matched",
    body: "Set your postcodes and services. Once your checks are approved, we'll send you local jobs to quote for.",
  },
];

const businessTypes = [
  { value: "sole_trader", label: "Sole trader" },
  { value: "partnership", label: "Partnership" },
  { value: "limited_company", label: "Limited company" },
] as const;

function Join() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const submit = useServerFn(submitProApplication);
  const check = useHumanCheck();
  const tiles = joinFactTiles();
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({
    businessType: "",
    company: "",
    tradeSlug: "",
    postcode: "",
    about: "",
    website: "",
    contactName: "",
    email: "",
    phone: "",
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          source: "join",
          consent,
          businessType: form.businessType,
          company: form.company,
          contactName: form.contactName,
          email: form.email,
          postcode: form.postcode,
          tradeSlug: form.tradeSlug,
          about: form.about,
          ...(form.website ? { website: form.website } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          hp: check.state.website,
        },
      }),
    onError: () => check.refresh(),
  });

  const scrollToForm = () =>
    document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <Section>
        <div className="max-w-3xl">
          <p className="eyebrow">Join TradesmanFinder</p>
          <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Get local jobs without paying for leads
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            We're onboarding local trades now. Homeowners post jobs free and we
            match them with checked local firms. No commission, no per-lead fees.
          </p>
          <button
            type="button"
            onClick={scrollToForm}
            className="mt-8 inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Apply to join
          </button>
        </div>

        <dl className="mt-12 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.value} className="bg-card p-6" data-testid="fact-tile">
              <dt className="sr-only">{t.label}</dt>
              <dd>
                <span className="block font-display text-3xl font-semibold text-primary sm:text-4xl">
                  {t.value}
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">{t.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section className="border-t border-border bg-surface">
        <SectionHead eyebrow="How it works" title="From application to local jobs." />
        <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="bg-card p-7">
              <span className="font-display text-sm font-semibold text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-lg leading-relaxed">
            We keep it simple. You apply, we check you're who you say you are and
            that you're properly insured, and then we send you local work. There's
            nothing to pay while we onboard trades, and we'll never charge you per
            lead or take a cut of the jobs you win.
          </p>
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="checks">
              <AccordionTrigger>What we check</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>Your photo ID, matched against your Companies House record or your sole-trader details.</li>
                  <li>Your public liability insurance certificate and its expiry date.</li>
                  <li>Any trade registration your work needs, such as Gas Safe or NICEIC.</li>
                </ul>
                <p className="mt-3 text-muted-foreground">All of this happens before you can quote for any job.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="charging">
              <AccordionTrigger>When charging starts</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>TradesmanFinder is free while we onboard trades. No card needed.</li>
                  <li>Prices after onboarding: Starter £29, Trade £79 and Contractor £129 a month.</li>
                  <li>Founding firms who join during onboarding get 50% off for their first 12 months once charging starts.</li>
                  <li>We'll email you at least 30 days before anything is charged.</li>
                  <li>You can leave any time.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reviews">
              <AccordionTrigger>Reviews</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Reviews will only come from customers who've had work done through TradesmanFinder.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Section>

      <Section className="border-t border-border bg-surface">
        <div id="apply" className="mx-auto max-w-3xl scroll-mt-24">
          {mutation.isSuccess ? (
            <div role="status" className="rounded-md border border-border bg-card p-8 text-center">
              <BadgeCheck className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
              <h2 className="mt-4 text-2xl">Thanks — we've got your application.</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                A real person will reply within 5 working days. Keep an eye on{" "}
                <strong className="text-foreground">{form.email}</strong> for our message.
              </p>
              {mutation.data?.trackingToken && (
                <Link
                  to="/application-status"
                  search={{ token: mutation.data.trackingToken }}
                  className="mt-6 inline-flex rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
                >
                  Track your application
                </Link>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="rounded-md border border-border bg-card p-7 sm:p-9"
            >
              <h2 className="text-3xl">Apply to join</h2>
              <p className="mt-3 text-muted-foreground">
                We review every application, so homeowners can trust the firms they
                find here. It takes about 5 minutes.
              </p>

              <fieldset className="mt-8">
                <legend className="eyebrow">Your business is a</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {businessTypes.map((b) => (
                    <label
                      key={b.value}
                      className="flex cursor-pointer items-center gap-2 rounded-sm border border-input px-4 py-3 text-sm has-[:checked]:border-primary"
                    >
                      <input
                        type="radio"
                        name="businessType"
                        value={b.value}
                        required
                        checked={form.businessType === b.value}
                        onChange={() => set("businessType")(b.value)}
                        className="accent-primary"
                      />
                      {b.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="eyebrow">Business or trading name</span>
                  <input required value={form.company} onChange={(e) => set("company")(e.target.value)} className={field} autoComplete="organization" />
                </label>
                <label className="block">
                  <span className="eyebrow">Your main trade</span>
                  <select required value={form.tradeSlug} onChange={(e) => set("tradeSlug")(e.target.value)} className={field}>
                    <option value="">Choose a trade</option>
                    {trades.map((t) => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Postcode you work from</span>
                  <input required value={form.postcode} onChange={(e) => set("postcode")(e.target.value)} className={field} autoComplete="postal-code" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="eyebrow">What work do you do?</span>
                  <textarea required minLength={10} rows={4} value={form.about} onChange={(e) => set("about")(e.target.value)} className={field} aria-describedby="about-hint" />
                  <span id="about-hint" className="mt-2 block text-xs text-muted-foreground">
                    A sentence or two: the jobs you take on, the areas you cover and roughly how long you've been trading.
                  </span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="eyebrow">Website or social media (optional)</span>
                  <input value={form.website} onChange={(e) => set("website")(e.target.value)} className={field} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="eyebrow">Your full name</span>
                  <input required value={form.contactName} onChange={(e) => set("contactName")(e.target.value)} className={field} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="eyebrow">Email</span>
                  <input required type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} className={field} autoComplete="email" />
                </label>
                <label className="block">
                  <span className="eyebrow">Phone (optional)</span>
                  <input type="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} className={field} autoComplete="tel" />
                </label>
              </div>

              <div className="mt-6">
                <HumanCheck question={check.question} state={check.state} setState={check.setState} refresh={check.refresh} inputClassName={field} />
              </div>

              <label className="mt-6 flex items-start gap-3 text-sm">
                <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-primary" />
                <span>
                  I confirm the details are accurate and that I'll provide ID and insurance before quoting. I understand I'll be asked to agree to the TradesmanFinder trader terms before I can receive jobs.
                </span>
              </label>

              {mutation.isError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {mutation.error.message}
                </p>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="mt-8 inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
              >
                {mutation.isPending ? "Sending…" : "Send application"}
              </button>
              <p className="mt-4 text-xs text-muted-foreground">
                We use your details only to review your application and contact you about it. See our{" "}
                <Link to="/privacy" className="text-primary underline">privacy notice</Link>.
              </p>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}
