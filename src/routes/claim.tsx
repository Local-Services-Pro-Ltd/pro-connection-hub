import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, ShieldCheck, FileCheck2, Clock } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import {
  getApplicationStatus,
  submitProApplication,
} from "@/lib/applications.functions";
import { DocumentTracker } from "@/components/application-documents";
import { tradesQuery } from "@/lib/queries";
import {
  breadcrumbSchema,
  ldScript,
  organizationSchema,
} from "@/lib/structured-data";


const SITE = "https://tradesmanfinder.org";

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

export const Route = createFileRoute("/claim")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } =>
    typeof search["plan"] === "string" && search["plan"]
      ? { plan: search["plan"] }
      : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(tradesQuery),
  head: () => {
    const title = "Get certified — apply to list your firm | TradesmanFinder";
    const description =
      "Apply to be a checked TradesmanFinder firm: send your company details, insurance and trade accreditations once, and we verify them before you appear in search.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/claim` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: `${SITE}/claim` }],
      scripts: [
        ldScript(organizationSchema()),
        ldScript(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "For tradesmen", path: "/for-tradesmen" },
            { name: "Get certified", path: "/claim" },
          ]),
        ),
      ],
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
  component: Claim,
});

const promises = [
  {
    icon: FileCheck2,
    title: "One set of documents",
    body: "Company details, insurance certificate and accreditation numbers. Send them once — we chase the issuing bodies, not you.",
  },
  {
    icon: ShieldCheck,
    title: "Checked before you're listed",
    body: "Nothing goes live on the strength of a subscription. Your profile publishes when the checks come back clean.",
  },
  {
    icon: Clock,
    title: "Re-checked, not checked once",
    body: "We store every expiry date and re-verify on the anniversary. Badges drop off automatically if cover lapses.",
  },
];

function Claim() {
  const { plan } = Route.useSearch();
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const submit = useServerFn(submitProApplication);
  const check = useHumanCheck();
  const [done, setDone] = useState(false);
  const loadStatus = useServerFn(getApplicationStatus);

  const [form, setForm] = useState({
    company: "",
    contactName: "",
    email: "",
    phone: "",
    postcode: "",
    tradeSlug: "",
    years: "",
    website: "",
    companiesHouse: "",
    insuranceProvider: "",
    insuranceExpiry: "",
    accreditations: "",
    about: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          company: form.company,
          contactName: form.contactName,
          email: form.email,
          postcode: form.postcode,
          ...(form.tradeSlug ? { tradeSlug: form.tradeSlug } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
          years: Number(form.years) || 0,
          ...(form.website ? { website: form.website } : {}),
          ...(form.companiesHouse
            ? { companiesHouse: form.companiesHouse }
            : {}),
          ...(form.insuranceProvider
            ? { insuranceProvider: form.insuranceProvider }
            : {}),
          ...(form.insuranceExpiry
            ? { insuranceExpiry: form.insuranceExpiry }
            : {}),
          ...(form.accreditations
            ? { accreditations: form.accreditations }
            : {}),
          ...(form.about ? { about: form.about } : {}),
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          hp: check.state.website,
        },
      }),
    onSuccess: () => {
      setDone(true);
      toast.success("Application received — we'll be in touch.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      check.refresh();
    },
  });

  const token = mutation.data?.trackingToken ?? "";
  const status = useQuery({
    queryKey: ["claim-status", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () => loadStatus({ data: { token } }),
  });

  return (
    <>
      <Section>
        <SectionHead
          eyebrow={plan ? `Apply — ${plan} plan` : "Get certified"}
          title="Apply to be a checked firm."
          sub="We don't sell listings. Send the paperwork, we verify it with the people who issued it, and your profile goes live once it checks out."
        />

        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
          {promises.map((p) => (
            <div key={p.title} className="bg-card p-7">
              <p.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border bg-surface">
        {done ? (
          <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-8 text-center">
            <BadgeCheck
              className="mx-auto h-8 w-8 text-success"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-2xl">Application received</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We've emailed {form.email} a confirmation with your tracking link.
              A human reads every application — usually within two working days.
              If anything is missing we'll say exactly what, rather than leaving
              you guessing.
            </p>
            {mutation.data?.reference && (
              <p className="mt-4 font-display text-sm font-semibold">
                Reference {mutation.data.reference}
              </p>
            )}
            {token && (
              <div className="mt-8 text-left">
                <DocumentTracker
                  token={token}
                  documents={status.data?.documents ?? []}
                  onChange={() => void status.refetch()}
                />
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {mutation.data?.trackingToken && (
                <Link
                  to="/application-status"
                  search={{ token: mutation.data.trackingToken }}
                  className="inline-flex rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground"
                >
                  Track your application
                </Link>
              )}
              <Link
                to="/verification"
                className="inline-flex rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
              >
                See what we check
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="mx-auto max-w-3xl rounded-md border border-border bg-card p-7 sm:p-9"
          >
            <h2 className="text-2xl">Your firm</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow">Company name</span>
                <input
                  required
                  value={form.company}
                  onChange={(e) => set("company")(e.target.value)}
                  className={field}
                  placeholder="Ember Plumbing Ltd"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Main contact</span>
                <input
                  required
                  value={form.contactName}
                  onChange={(e) => set("contactName")(e.target.value)}
                  className={field}
                  placeholder="Jamie Hall"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  className={field}
                  placeholder="jamie@emberplumbing.co.uk"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  className={field}
                  placeholder="07700 900123"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Main trade</span>
                <select
                  value={form.tradeSlug}
                  onChange={(e) => set("tradeSlug")(e.target.value)}
                  className={field}
                >
                  <option value="">Choose a trade</option>
                  {trades.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="eyebrow">Base postcode</span>
                <input
                  required
                  value={form.postcode}
                  onChange={(e) => set("postcode")(e.target.value)}
                  className={field}
                  placeholder="SE15 4TY"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Years trading</span>
                <input
                  inputMode="numeric"
                  value={form.years}
                  onChange={(e) => set("years")(e.target.value)}
                  className={field}
                  placeholder="8"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Website</span>
                <input
                  value={form.website}
                  onChange={(e) => set("website")(e.target.value)}
                  className={field}
                  placeholder="https://…"
                />
              </label>
            </div>

            <h2 className="mt-10 text-2xl">Checks</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These are the details we verify. Leave a field blank if it doesn't
              apply — we'll ask if we need it.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow">Companies House number</span>
                <input
                  value={form.companiesHouse}
                  onChange={(e) => set("companiesHouse")(e.target.value)}
                  className={field}
                  placeholder="12345678"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Insurance provider</span>
                <input
                  value={form.insuranceProvider}
                  onChange={(e) => set("insuranceProvider")(e.target.value)}
                  className={field}
                  placeholder="Hiscox"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Insurance expiry</span>
                <input
                  type="date"
                  value={form.insuranceExpiry}
                  onChange={(e) => set("insuranceExpiry")(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block">
                <span className="eyebrow">Accreditations</span>
                <input
                  value={form.accreditations}
                  onChange={(e) => set("accreditations")(e.target.value)}
                  className={field}
                  placeholder="Gas Safe 123456, NICEIC…"
                />
              </label>
            </div>

            <label className="mt-6 block">
              <span className="eyebrow">About the work you do</span>
              <textarea
                rows={4}
                value={form.about}
                onChange={(e) => set("about")(e.target.value)}
                className={field}
                placeholder="Typical jobs, areas you cover, anything a homeowner should know."
              />
            </label>

            <div className="mt-6">
              <HumanCheck
                question={check.question}
                state={check.state}
                setState={check.setState}
                refresh={check.refresh}
                inputClassName={field}
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="mt-8 inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
            >
              {mutation.isPending ? "Sending…" : "Send application"}
            </button>
            <p className="mt-4 text-xs text-muted-foreground">
              No payment now. We only talk about plans once the checks pass.
            </p>
          </form>
        )}
      </Section>
    </>
  );
}
