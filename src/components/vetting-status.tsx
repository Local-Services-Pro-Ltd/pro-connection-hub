import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import {
  VETTING_ACTIONS,
  VETTING_STAGES,
  type VettingStage,
} from "@/lib/vetting-status";

/**
 * Shown on the homepage while no firm has been featured yet. It tells people
 * exactly where vetting has got to and what they can do meanwhile, instead of
 * padding the page with placeholder profiles. The copy comes from
 * `@/lib/vetting-status`, which /api/public/vetting-status also serves, so
 * every surface stays in step.
 */

const ICONS: Record<VettingStage["state"], typeof CheckCircle2> = {
  Done: CheckCircle2,
  "In progress": Clock,
  Next: ShieldCheck,
};

const stages = VETTING_STAGES.map((s) => ({ ...s, icon: ICONS[s.state] }));

export function VettingStatusPanel() {
  return (
    <div className="mt-8">
      <ol className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
        {stages.map((s) => (
          <li key={s.title} className="bg-card p-7">
            <div className="flex items-center gap-3">
              <s.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {s.state}
              </span>
            </div>
            <h3 className="mt-4 text-lg">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
        {VETTING_ACTIONS.map((a) => (
          <div key={a.key} className="bg-card p-8">
            <h3 className="text-xl">{a.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {a.body}
            </p>
            <Link
              to={a.href}
              className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {a.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        You can still{" "}
        <Link to="/trades" className="text-primary hover:underline">
          browse every trade we cover
        </Link>
        , or{" "}
        <Link to="/waiting-list" className="text-primary hover:underline">
          join the waiting list
        </Link>{" "}
        to hear when your area goes live.
      </p>
    </div>
  );
}
