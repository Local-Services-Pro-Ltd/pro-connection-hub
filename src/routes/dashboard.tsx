import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProfileTips } from "@/components/profile-tips";
import { QuoteManager } from "@/components/quote-manager";
import { decideVisit } from "@/lib/visits.functions";
import { FirmReviews } from "@/components/firm-reviews";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PLAN_PRICES,
  createMembershipCheckout,
  openBillingPortal,
  syncMembership,
} from "@/lib/billing.functions";
import { PageHero, Section } from "@/components/layout-bits";
import {
  firmEntitlements,
  foundingPlanLabel,
  ONBOARDING_FREE,
  TRADE_TIER_LIMITS,
} from "@/lib/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  availabilityLabels,
  budgetBands,
  firmApplicationsQuery,
  firmBookingsQuery,
  firmLeadsQuery,
  myProProfileQuery,
  plansQuery,
  type Availability,
  type Pro,
  type Booking,
} from "@/lib/queries";
import { listJobsForMyFirm, registerJobInterest } from "@/lib/job-interest.functions";
import type { FirmJob } from "@/lib/job-interest.shared";
import { WorkGalleryManager } from "@/components/work-gallery-manager";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Trade dashboard — leads, profile and plan | TradesmanFinder" },
      {
        name: "description",
        content:
          "Manage your TradesmanFinder listing: respond to leads, update your services and photos, see upcoming visits and manage your membership.",
      },
      { property: "og:title", content: "Trade dashboard — TradesmanFinder" },
      {
        property: "og:description",
        content: "Leads, profile, photos, visits and membership in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const field =
  "w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";
const label = "block text-xs uppercase tracking-widest text-muted-foreground";
const card = "rounded-md border border-border bg-card p-6";

const TABS = [
  { id: "leads", label: "Leads" },
  { id: "jobs", label: "Jobs near you" },
  { id: "quotes", label: "Quotes" },
  { id: "reviews", label: "Reviews" },
  { id: "visits", label: "Visits" },
  { id: "profile", label: "Profile" },
  { id: "photos", label: "Work gallery" },
  { id: "plan", label: "Membership" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("leads");
  const queryClient = useQueryClient();
  const sync = useServerFn(syncMembership);

  // Deep links from Stripe checkout land on /dashboard?tab=plan&checkout=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested && TABS.some((t) => t.id === requested)) {
      setTab(requested as TabId);
    }
    if (!ONBOARDING_FREE && params.get("checkout") === "success") {
      toast.success("Payment received — unlocking your membership.");
    }
  }, []);

  // Membership state always comes from Stripe, never from the redirect.
  useEffect(() => {
    if (!user || ONBOARDING_FREE) return;
    void sync({})
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-pro-profile"] }))
      .catch(() => {});
  }, [user, sync, queryClient]);

  useEffect(() => {
    if (!loading && !user)
      navigate({
        to: "/signin",
        search: { redirect: "/dashboard" },
        replace: true,
      });
  }, [loading, user, navigate]);

  const profile = useQuery({
    ...myProProfileQuery(user?.id),
    enabled: !!user,
  });
  const pro = profile.data ?? null;

  if (loading || !user) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading your dashboard…</p>
      </Section>
    );
  }

  if (profile.isLoading) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading your listing…</p>
      </Section>
    );
  }

  if (!pro) {
    return (
      <>
        <PageHero
          eyebrow="Trade dashboard"
          title="No listing linked to this account yet"
          sub="Once your listing is linked, you can manage your profile here. ID and insurance checks must be completed before you can quote."
        />
        <Section>
          <div className={card}>
            <p className="text-sm text-muted-foreground">
              Apply to join the directory and we'll link your listing to this account as soon as
              your documents are approved.
            </p>
            <Link
              to="/join"
              className="mt-5 inline-block rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Apply to join
            </Link>
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Trade dashboard"
        title={pro.company}
        sub={
          pro.published
            ? "Your listing is published. Publication is not approval to quote; your firm must complete ID and insurance checks first."
            : "Your listing is not published yet. You can prepare your services and photos while onboarding continues."
        }
      />
      <Section>
        <ProfileTips pro={pro} onOpenTab={setTab} />
        {/* Inverted bar so the tabs stand out: white on the dark themes, black on light. */}
        <div className="flex flex-wrap gap-2 rounded-md bg-foreground p-2 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-background/80 hover:bg-background/10 hover:text-background"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "leads" &&
            (isMember(pro) ? (
              <LeadsTab pro={pro} />
            ) : (
              <MembershipLocked
                what="enquiries and job applications"
                onOpen={() => setTab("plan")}
              />
            ))}
          {tab === "jobs" && <JobsNearYouTab />}
          {tab === "quotes" && <QuoteManager />}
          {tab === "reviews" && <FirmReviews />}
          {tab === "visits" &&
            (isMember(pro) ? (
              <VisitsTab pro={pro} />
            ) : (
              <MembershipLocked what="booked visits" onOpen={() => setTab("plan")} />
            ))}
          {tab === "profile" && <ProfileTab pro={pro} />}
          {tab === "photos" && <WorkGalleryManager pro={pro} />}
          {tab === "plan" && <PlanTab pro={pro} />}
        </div>
      </Section>
    </>
  );
}

/* ----------------------------------------------------------- membership */

/** Approved firms receive the same entitlement decision on every tab. */
function isMember(pro: Pro) {
  return firmEntitlements(pro).hasAccess;
}

function MembershipLocked({ what, onOpen }: { what: string; onOpen: () => void }) {
  return (
    <div className={`${card} max-w-2xl`}>
      <p className="eyebrow">Membership needed</p>
      <h2 className="mt-2 text-2xl">Unlock your {what}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your listing stays live either way. A paid membership opens the contact details on every
        enquiry and your booked visits. Membership never changes where you rank.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-5 rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
      >
        See membership options
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- leads */

function LeadsTab({ pro }: { pro: Pro }) {
  const leads = useQuery(firmLeadsQuery(pro.id));
  const applications = useQuery(firmApplicationsQuery(pro.id));

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg">Enquiries sent to you</h2>
        {leads.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : (leads.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No enquiries yet. Homeowners reach you from your profile page and from the matching
            results after they post a job.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {(leads.data ?? []).map((lead) => (
              <li key={lead.id} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-base">{lead.name}</h3>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString("en-GB")} · {lead.reference}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.postcode}
                  {lead.timing ? ` · ${lead.timing}` : ""}
                  {lead.budget_band ? ` · ${lead.budget_band}` : ""}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm">{lead.message}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <a
                    href={`mailto:${lead.email}?subject=Your%20enquiry%20(${lead.reference})`}
                    className="text-primary underline"
                  >
                    Reply by email
                  </a>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="text-primary underline">
                      Call {lead.phone}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg">Jobs you've applied for</h2>
        {(applications.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You haven't applied to any project-board listings yet.{" "}
            <Link to="/projects" className="text-primary underline">
              Browse the project board
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(applications.data ?? []).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4 text-sm"
              >
                <Link
                  to="/projects/$id"
                  params={{ id: a.project_id }}
                  className="text-primary underline"
                >
                  View posting
                </Link>
                <span className="text-muted-foreground">
                  Applied {new Date(a.created_at).toLocaleDateString("en-GB")} · {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- jobs near you */

function JobsNearYouTab() {
  const getJobs = useServerFn(listJobsForMyFirm);
  const jobs = useQuery({
    queryKey: ["jobs-for-my-firm"],
    queryFn: () => getJobs({}),
    staleTime: 30_000,
  });

  return (
    <div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        You'll see the job, not the homeowner's contact details. If they'd like a quote they can
        invite you, and the invitation appears under Quotes.
      </p>
      {jobs.isLoading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading jobs…</p>
      ) : jobs.error ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {(jobs.error as Error).message}
        </p>
      ) : (jobs.data?.jobs.length ?? 0) === 0 ? (
        <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          No jobs in your trade and area right now. New jobs appear here as homeowners post them.
        </p>
      ) : (
        <ul className="mt-6 grid gap-5">
          {jobs.data!.jobs.map((job) => (
            <JobNearYouCard key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobNearYouCard({ job }: { job: FirmJob }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(job.interested);
  const register = useServerFn(registerJobInterest);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => register({ data: { jobId: job.id, message: note } }),
    onSuccess: () => {
      setSent(true);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["jobs-for-my-firm"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const budget =
    budgetBands.find((band) => band.value === job.budget_band)?.label ?? job.budget_band;

  return (
    <li className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl">{job.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.postcode_district} · {job.timing} · {budget}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          Posted {new Date(job.created_at).toLocaleDateString("en-GB")}
        </span>
      </div>
      <p
        className={`mt-4 whitespace-pre-line text-sm leading-relaxed ${expanded ? "" : "line-clamp-4"}`}
      >
        {job.description}
      </p>
      {job.description.length > 240 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-sm text-primary underline underline-offset-4"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {sent ? (
        <p className="mt-5 rounded-sm border border-border bg-surface p-3 text-sm">
          Interest sent — the homeowner has your profile link
        </p>
      ) : open ? (
        <div className="mt-5 rounded-sm border border-border bg-surface p-4">
          <label className="block text-sm font-medium" htmlFor={`interest-note-${job.id}`}>
            Add a short note (optional)
          </label>
          <textarea
            id={`interest-note-${job.id}`}
            rows={3}
            maxLength={600}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={`${field} mt-2 resize-y`}
          />
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="rounded-sm bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {mutation.isPending ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-border-strong px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 rounded-sm bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          I'm interested
        </button>
      )}
    </li>
  );
}

/* --------------------------------------------------------------- visits */

function VisitsTab({ pro }: { pro: Pro }) {
  const queryClient = useQueryClient();
  const bookings = useQuery(firmBookingsQuery(pro.id));
  const decide = useServerFn(decideVisit);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const answer = useMutation({
    mutationFn: (input: { bookingId: string; decision: "accept" | "decline" }) =>
      decide({ data: { ...input, note: notes[input.bookingId] ?? "" } }),
    onSuccess: async (result, input) => {
      toast.success(
        `${input.decision === "accept" ? "Visit confirmed" : "Request declined"}. ${
          result.emailed ? "We've emailed the homeowner." : "Please email the homeowner yourself."
        }`,
      );
      await queryClient.invalidateQueries({ queryKey: ["firm-bookings", pro.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = (bookings.data ?? []) as (Booking & {
    suggested_by_customer?: boolean;
    decided_at?: string | null;
    firm_note?: string | null;
  })[];
  const now = Date.now();
  const upcoming = rows.filter((b) => new Date(b.slot_start).getTime() >= now);
  const past = rows.filter((b) => new Date(b.slot_start).getTime() < now);
  const waiting = upcoming.filter((b) => b.status === "requested");
  const statusLabel = (b: (typeof rows)[number]) =>
    b.status === "requested"
      ? "Waiting for your answer"
      : b.status === "confirmed"
        ? "Confirmed"
        : b.decided_at
          ? "Declined"
          : "Cancelled";

  const render = (title: string, list: typeof rows, canAnswer: boolean) => (
    <div>
      <h2 className="text-lg">{title}</h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((b) => (
            <li key={b.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-base">
                  {new Date(b.slot_start).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </h3>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {statusLabel(b)} · {b.duration_mins} mins
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.contact_name}
                {b.postcode ? ` · ${b.postcode}` : ""}
              </p>
              {b.suggested_by_customer ? (
                <p className="mt-2 text-sm text-primary">
                  The homeowner suggested this time. It is outside your listed slots.
                </p>
              ) : null}
              {b.notes && <p className="mt-3 text-sm">{b.notes}</p>}
              <a
                href={`mailto:${b.contact_email}`}
                className="mt-3 inline-block text-sm text-primary underline"
              >
                Email {b.contact_email}
              </a>
              {b.firm_note ? (
                <p className="mt-3 border-l-2 border-border pl-3 text-sm text-muted-foreground">
                  Your message: {b.firm_note}
                </p>
              ) : null}
              {canAnswer && b.status === "requested" && (
                <div className="mt-4 border-t border-border pt-4">
                  <label className="block text-sm">
                    <span className="text-muted-foreground">
                      Message to the homeowner (optional). If you decline, say when you could come.
                    </span>
                    <textarea
                      rows={2}
                      maxLength={600}
                      value={notes[b.id] ?? ""}
                      onChange={(e) => setNotes((all) => ({ ...all, [b.id]: e.target.value }))}
                      className={`${field} mt-2`}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={answer.isPending}
                      onClick={() => answer.mutate({ bookingId: b.id, decision: "accept" })}
                      className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                    >
                      Accept this visit
                    </button>
                    <button
                      type="button"
                      disabled={answer.isPending}
                      onClick={() => answer.mutate({ bookingId: b.id, decision: "decline" })}
                      className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      {waiting.length > 0 && (
        <p className="rounded-md border border-primary bg-card p-4 text-sm">
          {waiting.length === 1
            ? "1 visit request is waiting for your answer."
            : `${waiting.length} visit requests are waiting for your answer.`}{" "}
          The homeowner is emailed as soon as you accept or decline.
        </p>
      )}
      {render("Upcoming visits", upcoming, true)}
      {render("Past visits", past, false)}
      <p className="text-sm text-muted-foreground">
        The listed slots homeowners can book come from your availability. Ask us to change them any
        time. Homeowners can also suggest another time, which is only booked if you accept it.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- profile */

function ProfileTab({ pro }: { pro: Pro }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: pro.name,
    company: pro.company,
    bio: pro.bio,
    services: pro.services.join(", "),
    years: String(pro.years),
    response_mins: String(pro.response_mins),
    day_rate: pro.day_rate === null ? "" : String(pro.day_rate),
    min_job_budget: String(pro.min_job_budget),
    availability: pro.availability as Availability,
    contact_email: pro.contact_email ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pros")
        .update({
          name: form.name.trim(),
          company: form.company.trim(),
          bio: form.bio.trim(),
          services: form.services
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          years: Number(form.years) || 0,
          response_mins: Number(form.response_mins) || 60,
          day_rate: form.day_rate ? Number(form.day_rate) : null,
          min_job_budget: Number(form.min_job_budget) || 0,
          availability: form.availability,
          contact_email: form.contact_email.trim() || null,
        })
        .eq("id", pro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["my-pro-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["pro", pro.id] });
      void queryClient.invalidateQueries({ queryKey: ["pros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="d-company">
            Business name
          </label>
          <input
            id="d-company"
            className={`${field} mt-2`}
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="d-name">
            Your name
          </label>
          <input
            id="d-name"
            className={`${field} mt-2`}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="d-bio">
          About the business
        </label>
        <textarea
          id="d-bio"
          rows={5}
          className={`${field} mt-2`}
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
        />
      </div>

      <div>
        <label className={label} htmlFor="d-services">
          Services (comma separated)
        </label>
        <input
          id="d-services"
          className={`${field} mt-2`}
          value={form.services}
          onChange={(e) => set("services", e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="d-years">
            Years trading
          </label>
          <input
            id="d-years"
            type="number"
            min={0}
            className={`${field} mt-2`}
            value={form.years}
            onChange={(e) => set("years", e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="d-response">
            Typical reply time (minutes)
          </label>
          <input
            id="d-response"
            type="number"
            min={5}
            className={`${field} mt-2`}
            value={form.response_mins}
            onChange={(e) => set("response_mins", e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="d-rate">
            Day rate (£, optional)
          </label>
          <input
            id="d-rate"
            type="number"
            min={0}
            className={`${field} mt-2`}
            value={form.day_rate}
            onChange={(e) => set("day_rate", e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="d-min">
            Smallest job you take (£)
          </label>
          <input
            id="d-min"
            type="number"
            min={0}
            className={`${field} mt-2`}
            value={form.min_job_budget}
            onChange={(e) => set("min_job_budget", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="d-availability">
            Availability
          </label>
          <select
            id="d-availability"
            className={`${field} mt-2`}
            value={form.availability}
            onChange={(e) => set("availability", e.target.value)}
          >
            {Object.entries(availabilityLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="d-email">
            Enquiry email
          </label>
          <input
            id="d-email"
            type="email"
            className={`${field} mt-2`}
            value={form.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Your trade category, service area and vetting badges are set during vetting — contact us to
        change them.
      </p>

      <button
        type="submit"
        disabled={save.isPending}
        className="rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

/* ----------------------------------------------------------------- plan */

function PlanTab({ pro }: { pro: Pro }) {
  return ONBOARDING_FREE ? <FreeFoundingPlan pro={pro} /> : <PaidPlanTab pro={pro} />;
}

function FreeFoundingPlan({ pro }: { pro: Pro }) {
  return (
    <div className="max-w-3xl space-y-8">
      <div className={card}>
        <p className="eyebrow">Current membership</p>
        <h2 className="mt-2 text-2xl">{foundingPlanLabel(pro)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No card needed and no checkout.{" "}
          {pro.published
            ? "Your approved firm has Trade-tier features while we onboard."
            : "Once approved, your firm has Trade-tier features while we onboard."}
        </p>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          <li>· Unlimited matched jobs</li>
          <li>· {TRADE_TIER_LIMITS.tradeCategoryLimit} trade categories</li>
          <li>· {TRADE_TIER_LIMITS.postcodeAreaLimit} postcode areas</li>
          <li>· Photo portfolio</li>
        </ul>
      </div>
      <div className={card}>
        <h3 className="text-lg">Founding-firm offer</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Join during onboarding and get 50% off for your first 12 months once charging starts.
          We'll email you at least 30 days before anything is charged, and you can leave any time.
        </p>
      </div>
    </div>
  );
}

function PaidPlanTab({ pro }: { pro: Pro }) {
  const plans = useQuery(plansQuery);
  const current = useMemo(
    () => (plans.data ?? []).find((p) => p.slug === pro.plan_slug) ?? null,
    [plans.data, pro.plan_slug],
  );

  const active = isMember(pro);
  const checkout = useServerFn(createMembershipCheckout);
  const portal = useServerFn(openBillingPortal);
  const [busy, setBusy] = useState<string | null>(null);

  async function startCheckout(planSlug: string) {
    setBusy(planSlug);
    try {
      const { url } = await checkout({ data: { planSlug } });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't open checkout.");
      setBusy(null);
    }
  }

  async function manage() {
    setBusy("manage");
    try {
      const { url } = await portal({});
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't open your billing page.");
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className={card}>
        <p className="eyebrow">Current membership</p>
        <h2 className="mt-2 text-2xl">{current ? current.name : "No paid membership"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {active
            ? `Active${
                pro.current_period_end
                  ? ` — renews ${new Date(pro.current_period_end).toLocaleDateString("en-GB")}`
                  : ""
              }.`
            : "Your listing is visible, but paid membership unlocks the full lead allowance."}
        </p>
        {active && (
          <button
            type="button"
            onClick={manage}
            disabled={busy !== null}
            className="mt-5 rounded-sm border border-border px-5 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {busy === "manage" ? "Opening…" : "Manage billing"}
          </button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {(plans.data ?? [])
          .filter((p) => p.visible)
          .map((p) => {
            const payable = p.slug in PLAN_PRICES;
            const mine = pro.plan_slug === p.slug && active;
            return (
              <div key={p.slug} className={card}>
                <h3 className="text-lg">{p.name}</h3>
                <p className="mt-1 text-2xl">
                  {p.price}
                  <span className="text-sm text-muted-foreground">{p.per}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{p.line}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {p.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                {mine ? (
                  <span className="mt-5 inline-block rounded-sm border border-primary px-5 py-2.5 text-sm font-semibold text-primary">
                    Your plan
                  </span>
                ) : payable ? (
                  <button
                    type="button"
                    onClick={() => startCheckout(p.slug)}
                    disabled={busy !== null}
                    className="mt-5 rounded-sm bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
                  >
                    {busy === p.slug
                      ? "Opening checkout…"
                      : active
                        ? `Switch to ${p.name}`
                        : `Subscribe — ${p.price}${p.per}`}
                  </button>
                ) : (
                  <Link
                    to="/enterprise"
                    className="mt-5 inline-block rounded-sm border border-border px-5 py-2.5 text-sm font-semibold"
                  >
                    Talk to us
                  </Link>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
