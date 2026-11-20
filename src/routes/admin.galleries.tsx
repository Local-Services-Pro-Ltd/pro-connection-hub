import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus, Trash2 } from "lucide-react";
import { AdminProjectEditor, PortfolioReviewQueue } from "@/components/admin-portfolio";
import { Section, SectionHead } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  adminProAvailabilityQuery,
  adminProsQuery,
  isAdminQuery,
  type ProAvailability,
} from "@/lib/queries";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

      <PortfolioReviewQueue />

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
          <AdminProjectEditor proId={active.id} tradeSlug={active.trade_slug} />
          <AvailabilityEditor proId={active.id} />
        </div>
      )}
    </Section>
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
      const { error } = await supabase.from("pro_availability").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h2 className="text-2xl">Bookable windows</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Set the days and hours this firm accepts visits. With no windows saved, the profile falls
        back to standard weekday slots.
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
              {dayNames[w.weekday]} · {minutesToTime(w.start_minute)}–{minutesToTime(w.end_minute)}{" "}
              · {w.slot_minutes} min slots
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
