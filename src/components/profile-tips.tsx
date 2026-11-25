import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyPortfolio } from "@/lib/portfolio.functions";
import { credentialState } from "@/lib/registers";
import type { Pro } from "@/lib/queries";

type Tip = {
  id: string;
  done: boolean;
  title: string;
  why: string;
  action?: { label: string; tab: "profile" | "photos" };
};

const GALLERY_TARGET = 3;

/**
 * A short "finish your profile" checklist at the top of the trade dashboard.
 * It only reports what is actually stored, and disappears once everything is done.
 */
export function ProfileTips({
  pro,
  onOpenTab,
}: {
  pro: Pro;
  onOpenTab: (tab: "profile" | "photos") => void;
}) {
  const list = useServerFn(listMyPortfolio);
  const gallery = useQuery({ queryKey: ["my-portfolio"], queryFn: () => list({}) });
  const credentials = useQuery({
    queryKey: ["my-credentials", pro.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_credentials")
        .select("kind, verified, expires_on")
        .eq("pro_id", pro.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (gallery.isPending || credentials.isPending || gallery.isError || credentials.isError)
    return null;

  const jobs = gallery.data.projects.length;
  const checked = (kind: string) =>
    credentials.data.some((c) => c.kind === kind && credentialState(c) === "verified");
  const insured = checked("insurance");
  const registered = credentials.data.some(
    (c) => c.kind !== "insurance" && credentialState(c) === "verified",
  );

  const tips: Tip[] = [
    {
      id: "bio",
      done: (pro.bio ?? "").trim().length >= 80,
      title: "Describe your firm",
      why: "A few sentences on the work you do and how long you have been doing it.",
      action: { label: "Edit profile", tab: "profile" },
    },
    {
      id: "services",
      done: (pro.services ?? []).length >= 3,
      title: "List at least three services",
      why: "Homeowners search by the job they need, such as boiler repair or roof leaks.",
      action: { label: "Add services", tab: "profile" },
    },
    {
      id: "email",
      done: Boolean((pro.contact_email ?? "").trim()),
      title: "Add an email address for enquiries",
      why: "This is where we send homeowner enquiries. It isn't shown on your profile.",
      action: { label: "Add email", tab: "profile" },
    },
    {
      id: "gallery",
      done: jobs >= GALLERY_TARGET,
      title: `Add ${GALLERY_TARGET} jobs to your work gallery`,
      why:
        jobs === 0
          ? "Before-and-after photos show homeowners what your work looks like."
          : `You have added ${jobs} so far. We review each job before it appears.`,
      action: { label: "Add photos", tab: "photos" },
    },
    {
      id: "insurance",
      done: insured,
      title: "Send us your public liability insurance",
      why: "Email your certificate to hello@tradesmanfinder.org. Once we have checked it, your profile shows it with its expiry date.",
    },
    {
      id: "register",
      done: registered,
      title: "Send us your company or trade registration number",
      why: "For example your Companies House, Gas Safe, NICEIC, NAPIT or FENSA number. We check it against the official register.",
    },
  ];

  const done = tips.filter((tip) => tip.done).length;
  if (done === tips.length) return null;

  return (
    <section
      aria-labelledby="profile-tips-heading"
      className="mb-8 rounded-md border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="profile-tips-heading" className="text-xl">
          Finish your profile
        </h2>
        <p className="text-sm text-muted-foreground">
          {done} of {tips.length} done
        </p>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tips.length}
        aria-valuenow={done}
        aria-label="Profile steps completed"
      >
        <div className="h-full bg-primary" style={{ width: `${(done / tips.length) * 100}%` }} />
      </div>
      <ul className="mt-5 grid gap-3">
        {tips.map((tip) => (
          <li key={tip.id} className="flex flex-wrap items-start gap-3">
            {tip.done ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle
                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1 basis-64">
              <p className={tip.done ? "text-muted-foreground line-through" : "font-medium"}>
                <span className="sr-only">{tip.done ? "Done: " : "To do: "}</span>
                {tip.title}
              </p>
              {!tip.done && <p className="mt-1 text-sm text-muted-foreground">{tip.why}</p>}
            </div>
            {!tip.done && tip.action ? (
              <button
                type="button"
                onClick={() => onOpenTab(tip.action!.tab)}
                className="rounded-sm border border-border-strong px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
              >
                {tip.action.label}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
