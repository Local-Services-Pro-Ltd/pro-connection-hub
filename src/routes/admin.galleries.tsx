import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus, Trash2, Upload } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  adminProAvailabilityQuery,
  adminProProjectsQuery,
  adminProsQuery,
  isAdminQuery,
  type ProAvailability,
  type ProProject,
} from "@/lib/queries";

const BUCKET = "pro-projects";
/** Signed-URL lifetime for uploaded project photos (10 years). */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function minutesToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function timeToMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const Route = createFileRoute("/admin/galleries")({
  head: () => ({
    meta: [
      { title: "Project galleries & availability — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Upload before-and-after project photos and set bookable visit windows for any listed tradesperson.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  component: AdminGalleries,
});

function Locked({ title, body }: { title: string; body: string }) {
  return (
    <Section>
      <div className="mx-auto max-w-lg rounded-md border border-border bg-card p-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-primary/15">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <Link
          to="/signin"
          search={{}}
          className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
        >
          Sign in
        </Link>
      </div>
    </Section>
  );
}

function AdminGalleries() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending: checkingRole } = useQuery({
    ...isAdminQuery(user?.id),
    enabled: !loading,
  });

  if (loading || (user && checkingRole)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user) {
    return (
      <Locked
        title="Sign in required"
        body="This page manages published project photos, so it is only open to signed-in admins."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Admins only"
        body="Your account does not hold the admin role, so project galleries stay read-only."
      />
    );
  }
  return <GalleryManager />;
}

function GalleryManager() {
  const { data: pros } = useQuery(adminProsQuery);
  const [proId, setProId] = useState<string>("");
  const active = (pros ?? []).find((p) => p.id === proId) ?? null;

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Project galleries & availability"
        sub="Publish real before-and-after work and set the visit windows a tradesperson can actually be booked into. Nothing here is placeholder content — only upload photos the firm has approved."
      />

      <label className="mt-8 block max-w-md">
        <span className="eyebrow">Tradesperson</span>
        <select
          value={proId}
          onChange={(e) => setProId(e.target.value)}
          className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        >
          <option value="">Choose a listing…</option>
          {(pros ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.company} — {p.name} ({p.published ? "published" : "draft"})
            </option>
          ))}
        </select>
      </label>

      {active && (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <ProjectEditor proId={active.id} tradeSlug={active.trade_slug} />
          <AvailabilityEditor proId={active.id} />
        </div>
      )}
    </Section>
  );
}

function ProjectEditor({
  proId,
  tradeSlug,
}: {
  proId: string;
  tradeSlug: string;
}) {
  const queryClient = useQueryClient();
  const { data: projects } = useQuery(adminProProjectsQuery(proId));
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
      const path = `${proId}/${which}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
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
      if (!title.trim()) throw new Error("Give the project a title.");
      if (!afterUrl) throw new Error("An after photo is required.");
      const { error } = await supabase.from("pro_projects").insert({
        pro_id: proId,
        trade_slug: tradeSlug,
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
      toast.success("Project published");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: ProProject) => {
      const { error } = await supabase
        .from("pro_projects")
        .update({ published: !row.published })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: ProProject) => {
      const { error } = await supabase
        .from("pro_projects")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Project removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h2 className="text-2xl">Before &amp; after projects</h2>

      <div className="mt-6 space-y-4 rounded-md border border-border bg-card p-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title (e.g. Victorian bathroom refit, Bromley)"
          className="w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        />
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="What the job involved, in a sentence or two."
          className="w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["before", "after"] as const).map((which) => {
            const url = which === "before" ? beforeUrl : afterUrl;
            return (
              <div key={which} className="rounded-sm border border-border p-4">
                <p className="eyebrow">
                  {which} photo{which === "after" ? " (required)" : ""}
                </p>
                {url && (
                  <img
                    src={url}
                    alt={`${which} preview`}
                    className="mt-3 aspect-[4/3] w-full rounded-sm object-cover"
                  />
                )}
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary">
                  <Upload className="h-4 w-4" />
                  {busy === which ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f, which);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {create.isPending ? "Publishing…" : "Publish project"}
        </button>
      </div>

      <ul className="mt-6 space-y-3">
        {(projects ?? []).map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-4 rounded-md border border-border bg-card p-4"
          >
            {row.after_url && (
              <img
                src={row.after_url}
                alt=""
                className="h-16 w-20 shrink-0 rounded-sm object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold">
                {row.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.published ? "Live" : "Draft"} · {row.summary || "No summary"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle.mutate(row)}
              className="rounded-sm border border-border-strong px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
            >
              {row.published ? "Unpublish" : "Publish"}
            </button>
            <button
              type="button"
              aria-label={`Delete ${row.title}`}
              onClick={() => remove.mutate(row)}
              className="rounded-sm border border-border-strong p-2 text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {(projects ?? []).length === 0 && (
          <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No projects yet for this firm.
          </li>
        )}
      </ul>
    </div>
  );
}

function AvailabilityEditor({ proId }: { proId: string }) {
  const queryClient = useQueryClient();
  const { data: windows } = useQuery(adminProAvailabilityQuery(proId));
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [slot, setSlot] = useState(120);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "pro-availability"] });
    void queryClient.invalidateQueries({ queryKey: ["pro-availability"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const s = timeToMinutes(start);
      const e = timeToMinutes(end);
      if (e <= s) throw new Error("The end time must be after the start time.");
      const { error } = await supabase.from("pro_availability").insert({
        pro_id: proId,
        weekday,
        start_minute: s,
        end_minute: e,
        slot_minutes: slot,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Window added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: ProAvailability) => {
      const { error } = await supabase
        .from("pro_availability")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h2 className="text-2xl">Bookable windows</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Set the days and hours this firm accepts visits. With no windows saved,
        the profile falls back to standard weekday slots.
      </p>

      <div className="mt-6 space-y-4 rounded-md border border-border bg-card p-6">
        <select
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className="w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        >
          {dayNames.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-muted-foreground">
            From
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border-strong bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border-strong bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Slot (min)
            <input
              type="number"
              min={30}
              max={480}
              step={30}
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="mt-1 w-full rounded-sm border border-border-strong bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Add window
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {(windows ?? []).map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
          >
            <span>
              {dayNames[w.weekday]} · {minutesToTime(w.start_minute)}–
              {minutesToTime(w.end_minute)} · {w.slot_minutes} min slots
            </span>
            <button
              type="button"
              aria-label="Remove window"
              onClick={() => remove.mutate(w)}
              className="rounded-sm border border-border-strong p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {(windows ?? []).length === 0 && (
          <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No windows saved — standard weekday slots are shown on the profile.
          </li>
        )}
      </ul>
    </div>
  );
}
