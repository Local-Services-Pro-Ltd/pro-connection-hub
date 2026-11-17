import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Search } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { submitProApplication } from "@/lib/applications.functions";
import { searchClaimableListings } from "@/lib/claims.functions";
import { tradesQuery } from "@/lib/queries";
import { joinFactTiles } from "@/lib/join-content";
import { validateJoinForm, type JoinField, type JoinFormValues } from "@/lib/join-validation";
import { breadcrumbSchema, ldScript, organizationSchema } from "@/lib/structured-data";

const SITE = "https://tradesmanfinder.org";
const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

export const Route = createFileRoute("/join")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tradesQuery),
  head: () => {
    const title = "Join TradesmanFinder — get local jobs without paying for leads";
    const description =
      "Apply to join TradesmanFinder. Free while we onboard trades, no commission and no per-lead fees. Our compliance and onboarding team replies to every application within 2 working days.";
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
  {
    title: "Apply",
    body: "Tell us about your business and the work you do. It takes about 5 minutes.",
  },
  {
    title: "We review",
    body: "Our compliance and onboarding team looks at every application and replies within 2 working days.",
  },
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

const initialForm: JoinFormValues = {
  businessType: "",
  company: "",
  tradeSlug: "",
  postcode: "",
  about: "",
  website: "",
  contactName: "",
  email: "",
  phone: "",
};

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} role="alert" className="mt-2 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function ClaimSearch() {
  const search = useServerFn(searchClaimableListings);
  const [query, setQuery] = useState("");
  const mutation = useMutation({
    mutationFn: (value: string) => search({ data: { query: value } }),
  });

  return (
    <div className="rounded-md border border-border bg-card p-7 sm:p-8">
      <p className="eyebrow">Already listed?</p>
      <h2 className="mt-3 text-2xl leading-tight sm:text-3xl">
        Already on TradesmanFinder? Search for your business first.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        If your listing is already here, send a claim for review instead of applying again.
      </p>
      <form
        className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(query);
        }}
      >
        <label className="min-w-0">
          <span className="sr-only">Business name or postcode</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Business name or postcode"
            aria-label="Business name or postcode"
            minLength={3}
            required
            className={`${field} mt-0`}
          />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-border-strong bg-background px-5 py-3 font-display text-sm font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {mutation.isPending ? "Searching…" : "Search"}
        </button>
      </form>
      {mutation.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && mutation.data.length > 0 && (
        <ul
          className="mt-6 divide-y divide-border border-y border-border"
          aria-label="Claimable listings"
        >
          {mutation.data.map((listing) => (
            <li
              key={listing.id}
              className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold">{listing.company}</h3>
                <p className="mt-1 text-sm capitalize text-muted-foreground">
                  {listing.trade.replaceAll("-", " ")} · {listing.area}
                </p>
              </div>
              <Link
                to="/claim/$proId"
                params={{ proId: listing.id }}
                className="inline-flex items-center justify-center rounded-sm border border-primary px-4 py-2.5 font-display text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Claim this listing
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mutation.isSuccess && mutation.data.length === 0 && (
        <div role="status" className="mt-6 rounded-sm bg-muted p-5">
          <p className="text-sm leading-relaxed">
            We couldn't find your business. Apply below; it takes about 5 minutes.
          </p>
          <button
            type="button"
            onClick={() => scrollTo("apply")}
            className="mt-3 font-display text-sm font-semibold text-primary hover:underline"
          >
            Go to the application form
          </button>
        </div>
      )}
    </div>
  );
}

function Join() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const submit = useServerFn(submitProApplication);
  const check = useHumanCheck();
  const tiles = joinFactTiles();
  const successRef = useRef<HTMLDivElement>(null);
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState<JoinFormValues>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<JoinField, boolean>>>({});
  const errors = validateJoinForm(form, consent);
  const set = (key: keyof JoinFormValues) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const touch = (key: JoinField) => setTouched((current) => ({ ...current, [key]: true }));
  const error = (key: JoinField) => (touched[key] ? errors[key] : undefined);
  const describedBy = (key: JoinField, hint?: string) =>
    [hint, error(key) ? `${key}-error` : ""].filter(Boolean).join(" ") || undefined;

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

  useEffect(() => {
    if (mutation.isSuccess)
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [mutation.isSuccess]);

  function sendApplication(event: React.FormEvent) {
    event.preventDefault();
    const allTouched = Object.fromEntries(
      [...Object.keys(form), "consent"].map((key) => [key, true]),
    ) as Record<JoinField, boolean>;
    setTouched(allTouched);
    const firstError = Object.keys(errors)[0] as JoinField | undefined;
    if (firstError) {
      document.getElementById(firstError)?.focus();
      return;
    }
    mutation.mutate();
  }

  return (
    <>
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Join TradesmanFinder</p>
          <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Get local jobs without paying for leads
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Free to join while we onboard trades, with no commission or per-lead fees.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => scrollTo("apply")}
              className="inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Apply to join
            </button>
            <button
              type="button"
              onClick={() => scrollTo("find")}
              className="inline-flex items-center justify-center rounded-sm border border-border-strong bg-background px-6 py-3.5 font-display font-semibold text-foreground hover:border-primary hover:text-primary"
            >
              Find and claim your listing
            </button>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {tiles.map((tile) => (
              <div
                key={tile.value}
                className="flex flex-col bg-card p-5 sm:p-6"
                data-testid="fact-tile"
              >
                <dd className="order-1 font-display text-3xl font-semibold text-primary sm:text-4xl">
                  {tile.value}
                </dd>
                <dt className="order-2 mt-2 text-sm text-muted-foreground">{tile.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section id="find" className="scroll-mt-24 border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl">
          <ClaimSearch />
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="mx-auto max-w-3xl">
          <SectionHead eyebrow="How it works" title="From application to local jobs." />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step.title} className="bg-card p-7">
                <span className="font-display text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl">
          <p className="text-lg leading-relaxed">
            We keep it simple. You apply, we check you're who you say you are and that you're
            properly insured, and then we send you local work. There's nothing to pay while we
            onboard trades, and we'll never charge you per lead or take a cut of the jobs you win.
          </p>
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="checks">
              <AccordionTrigger>What we check</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>
                    Your photo ID, matched against your Companies House record or your sole-trader
                    details.
                  </li>
                  <li>Your public liability insurance certificate and its expiry date.</li>
                  <li>Any trade registration your work needs, such as Gas Safe or NICEIC.</li>
                </ul>
                <p className="mt-3 text-muted-foreground">
                  All of this happens before you can quote for any job.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="charging">
              <AccordionTrigger>When charging starts</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>TradesmanFinder is free while we onboard trades. No card needed.</li>
                  <li>
                    Prices after onboarding: Starter £29, Trade £79 and Contractor £129 a month.
                  </li>
                  <li>
                    Founding firms who join during onboarding get 50% off for their first 12 months
                    once charging starts.
                  </li>
                  <li>We'll email you at least 30 days before anything is charged.</li>
                  <li>You can leave any time.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reviews">
              <AccordionTrigger>Reviews</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Reviews will only come from customers who've had work done through
                  TradesmanFinder.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Section>

      <Section className="border-t border-border">
        <div id="apply" className="mx-auto max-w-3xl scroll-mt-24">
          {mutation.isSuccess ? (
            <div
              ref={successRef}
              role="status"
              className="rounded-md border border-border bg-card p-8 text-center"
            >
              <BadgeCheck className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
              <h2 className="mt-4 text-2xl">Thanks — we've got your application.</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                A member of our compliance and onboarding team will reply within 2 working days.
                Keep an eye on <strong className="text-foreground">{form.email}</strong> for our
                message.
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
              noValidate
              onSubmit={sendApplication}
              className="rounded-md border border-border bg-card p-6 sm:p-9"
            >
              <h2 className="text-3xl">Apply to join</h2>
              <p className="mt-3 text-muted-foreground">
                Required fields are marked *. It takes about 5 minutes.
              </p>

              <fieldset className="mt-8 border-t border-border pt-7">
                <legend className="px-0 font-display text-xl font-semibold">
                  About your business
                </legend>
                <div className="mt-5">
                  <span className="eyebrow">
                    Your business is a <span aria-hidden="true">*</span>
                  </span>
                  <div
                    className="mt-3 flex flex-wrap gap-3"
                    role="radiogroup"
                    aria-describedby={describedBy("businessType")}
                  >
                    {businessTypes.map((type) => (
                      <label
                        key={type.value}
                        className="flex cursor-pointer items-center gap-2 rounded-sm border border-input px-4 py-3 text-sm has-[:checked]:border-primary"
                      >
                        <input
                          id={type.value === "sole_trader" ? "businessType" : undefined}
                          type="radio"
                          name="businessType"
                          value={type.value}
                          required
                          checked={form.businessType === type.value}
                          onChange={() => set("businessType")(type.value)}
                          onBlur={() => touch("businessType")}
                          className="accent-primary"
                        />
                        {type.label}
                      </label>
                    ))}
                  </div>
                  <FieldError id="businessType-error" message={error("businessType")} />
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="eyebrow">
                      Business or trading name <span aria-hidden="true">*</span>
                    </span>
                    <input
                      id="company"
                      required
                      value={form.company}
                      onChange={(e) => set("company")(e.target.value)}
                      onBlur={() => touch("company")}
                      aria-invalid={Boolean(error("company"))}
                      aria-describedby={describedBy("company")}
                      className={field}
                      autoComplete="organization"
                    />
                    <FieldError id="company-error" message={error("company")} />
                  </label>
                  <label className="block">
                    <span className="eyebrow">
                      Your main trade <span aria-hidden="true">*</span>
                    </span>
                    <select
                      id="tradeSlug"
                      required
                      value={form.tradeSlug}
                      onChange={(e) => set("tradeSlug")(e.target.value)}
                      onBlur={() => touch("tradeSlug")}
                      aria-invalid={Boolean(error("tradeSlug"))}
                      aria-describedby={describedBy("tradeSlug")}
                      className={field}
                    >
                      <option value="">Choose a trade</option>
                      {trades.map((trade) => (
                        <option key={trade.slug} value={trade.slug}>
                          {trade.name}
                        </option>
                      ))}
                    </select>
                    <FieldError id="tradeSlug-error" message={error("tradeSlug")} />
                  </label>
                  <label className="block">
                    <span className="eyebrow">
                      Postcode you work from <span aria-hidden="true">*</span>
                    </span>
                    <input
                      id="postcode"
                      required
                      value={form.postcode}
                      onChange={(e) => set("postcode")(e.target.value)}
                      onBlur={() => touch("postcode")}
                      aria-invalid={Boolean(error("postcode"))}
                      aria-describedby={describedBy("postcode")}
                      className={field}
                      autoComplete="postal-code"
                    />
                    <FieldError id="postcode-error" message={error("postcode")} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="eyebrow">
                      What work do you do? <span aria-hidden="true">*</span>
                    </span>
                    <textarea
                      id="about"
                      required
                      minLength={10}
                      rows={4}
                      value={form.about}
                      onChange={(e) => set("about")(e.target.value)}
                      onBlur={() => touch("about")}
                      aria-invalid={Boolean(error("about"))}
                      aria-describedby={describedBy("about", "about-hint")}
                      className={field}
                    />
                    <span id="about-hint" className="mt-2 block text-xs text-muted-foreground">
                      A sentence or two: the jobs you take on, the areas you cover and roughly how
                      long you've been trading.
                    </span>
                    <FieldError id="about-error" message={error("about")} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="eyebrow">Website or social media (optional)</span>
                    <input
                      value={form.website}
                      onChange={(e) => set("website")(e.target.value)}
                      className={field}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="mt-9 border-t border-border pt-7">
                <legend className="px-0 font-display text-xl font-semibold">About you</legend>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="eyebrow">
                      Your full name <span aria-hidden="true">*</span>
                    </span>
                    <input
                      id="contactName"
                      required
                      value={form.contactName}
                      onChange={(e) => set("contactName")(e.target.value)}
                      onBlur={() => touch("contactName")}
                      aria-invalid={Boolean(error("contactName"))}
                      aria-describedby={describedBy("contactName")}
                      className={field}
                      autoComplete="name"
                    />
                    <FieldError id="contactName-error" message={error("contactName")} />
                  </label>
                  <label className="block">
                    <span className="eyebrow">
                      Email <span aria-hidden="true">*</span>
                    </span>
                    <input
                      id="email"
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email")(e.target.value)}
                      onBlur={() => touch("email")}
                      aria-invalid={Boolean(error("email"))}
                      aria-describedby={describedBy("email")}
                      className={field}
                      autoComplete="email"
                    />
                    <FieldError id="email-error" message={error("email")} />
                  </label>
                  <label className="block">
                    <span className="eyebrow">Phone (optional)</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone")(e.target.value)}
                      className={field}
                      autoComplete="tel"
                    />
                  </label>
                </div>
              </fieldset>

              <div className="mt-8 border-t border-border pt-7">
                <HumanCheck
                  question={check.question}
                  state={check.state}
                  setState={check.setState}
                  refresh={check.refresh}
                  inputClassName={field}
                />
              </div>
              <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed">
                <input
                  id="consent"
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    touch("consent");
                  }}
                  onBlur={() => touch("consent")}
                  aria-invalid={Boolean(error("consent"))}
                  aria-describedby={describedBy("consent")}
                  className="mt-1 accent-primary"
                />
                <span>
                  I confirm the details are accurate and that I'll provide ID and insurance before
                  quoting. I understand I'll be asked to agree to the TradesmanFinder trader terms
                  before I can receive jobs. <span aria-hidden="true">*</span>
                </span>
              </label>
              <FieldError id="consent-error" message={error("consent")} />
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
                We use your details only to review your application and contact you about it. See
                our{" "}
                <Link to="/privacy" className="text-primary underline">
                  privacy notice
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}
