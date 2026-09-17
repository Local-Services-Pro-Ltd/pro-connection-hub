import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createMembershipCheckout,
  openBillingPortal,
  syncMembership,
} from "@/lib/billing.functions";
import { PageHero, Section } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  availabilityLabels,
  firmApplicationsQuery,
  firmBookingsQuery,
  firmLeadsQuery,
  myProProfileQuery,
  adminProProjectsQuery,
  plansQuery,
  type Availability,
  type Pro,
} from "@/lib/queries";

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
  { id: "visits", label: "Visits" },
  { id: "profile", label: "Profile" },
  { id: "photos", label: "Photos" },
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
    if (params.get("checkout") === "success") {
      toast.success("Payment received — unlocking your membership.");
    }
  }, []);

  // Membership state always comes from Stripe, never from the redirect.
  useEffect(() => {
    if (!user) return;
    void sync({})
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ["my-pro-profile"] }),
      )
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
          sub="Once your firm is vetted and your listing is linked, your leads, visits, photos and membership all live here."
        />
        <Section>
          <div className={card}>
            <p className="text-sm text-muted-foreground">
              Apply to join the directory and we'll link your listing to this
              account as soon as your documents are approved.
            </p>
            <Link
              to="/claim"
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
            ? "Your listing is live. Keep your services, photos and availability current to win more work."
            : "Your listing is not live yet — it goes public once vetting is approved."
        }
      />
      <Section>
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-sm px-4 py-2 text-sm transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "leads" && <LeadsTab pro={pro} />}
          {tab === "visits" && <VisitsTab pro={pro} />}
          {tab === "profile" && <ProfileTab pro={pro} />}
          {tab === "photos" && <PhotosTab pro={pro} />}
          {tab === "plan" && <PlanTab pro={pro} />}
        </div>
      </Section>
    </>
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
            No enquiries yet. Homeowners reach you from your profile page and
            from the matching results after they post a job.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {(leads.data ?? []).map((lead) => (
              <li key={lead.id} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-base">{lead.name}</h3>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString("en-GB")} ·{" "}
                    {lead.reference}
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
                  Applied {new Date(a.created_at).toLocaleDateString("en-GB")} ·{" "}
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- visits */

function VisitsTab({ pro }: { pro: Pro }) {
  const bookings = useQuery(firmBookingsQuery(pro.id));
  const rows = bookings.data ?? [];
  const now = Date.now();
  const upcoming = rows.filter((b) => new Date(b.slot_start).getTime() >= now);
  const past = rows.filter((b) => new Date(b.slot_start).getTime() < now);

  const render = (title: string, list: typeof rows) => (
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
                  {b.status} · {b.duration_mins} mins
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.contact_name}
                {b.postcode ? ` · ${b.postcode}` : ""}
              </p>
              {b.notes && <p className="mt-3 text-sm">{b.notes}</p>}
              <a
                href={`mailto:${b.contact_email}`}
                className="mt-3 inline-block text-sm text-primary underline"
              >
                Email {b.contact_email}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      {render("Upcoming visits", upcoming)}
      {render("Past visits", past)}
      <p className="text-sm text-muted-foreground">
        Visit windows homeowners can book come from your availability — ask us
        to change them any time.
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

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

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
        Your trade category, service area and vetting badges are set during
        vetting — contact us to change them.
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

/* --------------------------------------------------------------- photos */

const BUCKET = "pro-projects";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

function PhotosTab({ pro }: { pro: Pro }) {
  const queryClient = useQueryClient();
  const projects = useQuery(adminProProjectsQuery(pro.id));
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [busy, setBusy] = useState<"before" | "after" | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "pro-projects"] });
    void queryClient.invalidateQueries({ queryKey: ["pro-projects"] });
    void queryClient.invalidateQueries({ queryKey: ["trade-projects"] });
  };

  async function upload(file: File, which: "before" | "after") {
    setBusy(which);
    try {
      const path = `${pro.id}/${which}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL);
      const url = data?.signedUrl ?? "";
      if (!url) throw new Error("Could not create a link for that upload.");
      if (which === "before") setBeforeUrl(url);
      else setAfterUrl(url);
      toast.success(`${which === "before" ? "Before" : "After"} photo uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give the job a title.");
      if (!afterUrl) throw new Error("An after photo is required.");
      const { error } = await supabase.from("pro_projects").insert({
        pro_id: pro.id,
        trade_slug: pro.trade_slug,
        title: title.trim(),
        summary: summary.trim(),
        before_url: beforeUrl || null,
        after_url: afterUrl,
        published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setSummary("");
      setBeforeUrl("");
      setAfterUrl("");
      refresh();
      toast.success("Job added to your portfolio");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: { id: string; published: boolean }) => {
      const { error } = await supabase
        .from("pro_projects")
        .update({ published: !row.published })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-10">
      <div className={card}>
        <h2 className="text-lg">Add a completed job</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="p-title">
              Title
            </label>
            <input
              id="p-title"
              className={`${field} mt-2`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="p-summary">
              Short summary
            </label>
            <input
              id="p-summary"
              className={`${field} mt-2`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="p-before">
              Before photo (optional)
            </label>
            <input
              id="p-before"
              type="file"
              accept="image/*"
              className={`${field} mt-2`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, "before");
              }}
            />
            {busy === "before" && (
              <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
            )}
            {beforeUrl && (
              <p className="mt-1 text-xs text-success">Before photo ready</p>
            )}
          </div>
          <div>
            <label className={label} htmlFor="p-after">
              After photo
            </label>
            <input
              id="p-after"
              type="file"
              accept="image/*"
              className={`${field} mt-2`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, "after");
              }}
            />
            {busy === "after" && (
              <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
            )}
            {afterUrl && (
              <p className="mt-1 text-xs text-success">After photo ready</p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
          className="mt-5 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {create.isPending ? "Saving…" : "Add to portfolio"}
        </button>
      </div>

      <div>
        <h2 className="text-lg">Your portfolio</h2>
        {(projects.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No jobs added yet. Before-and-after photos are the single biggest
            driver of enquiries.
          </p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(projects.data ?? []).map((row) => (
              <div key={row.id} className="rounded-md border border-border bg-card">
                {row.after_url && (
                  <img
                    src={row.after_url}
                    alt={row.title}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-t-md object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="text-base">{row.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.summary}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      toggle.mutate({ id: row.id, published: row.published })
                    }
                    className="mt-3 text-sm text-primary underline"
                  >
                    {row.published ? "Hide from profile" : "Show on profile"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- plan */

function PlanTab({ pro }: { pro: Pro }) {
  const plans = useQuery(plansQuery);
  const current = useMemo(
    () => (plans.data ?? []).find((p) => p.slug === pro.plan_slug) ?? null,
    [plans.data, pro.plan_slug],
  );

  const active = pro.subscription_status === "active";

  return (
    <div className="max-w-3xl space-y-8">
      <div className={card}>
        <p className="eyebrow">Current membership</p>
        <h2 className="mt-2 text-2xl">
          {current ? current.name : "No paid membership"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {active
            ? `Active${
                pro.current_period_end
                  ? ` — renews ${new Date(pro.current_period_end).toLocaleDateString("en-GB")}`
                  : ""
              }.`
            : "Your listing is visible, but paid membership unlocks the full lead allowance and priority placement."}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {(plans.data ?? [])
          .filter((p) => p.visible)
          .map((p) => (
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
              <Link
                to="/for-tradesmen"
                className="mt-5 inline-block rounded-sm border border-border px-5 py-2.5 text-sm font-semibold"
              >
                {pro.plan_slug === p.slug ? "Your plan" : "Choose this plan"}
              </Link>
            </div>
          ))}
      </div>
    </div>
  );
}
