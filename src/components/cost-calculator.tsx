import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Minus, Plus } from "lucide-react";
import {
  conditions,
  estimate,
  gbp,
  regions,
  urgencies,
  type CostGuide,
} from "@/lib/cost-guides";

/**
 * Interactive project cost estimator. Everything is client-side arithmetic on
 * the published rate card in cost-guides.ts — no quotes, no lead capture, so
 * a visitor can price a job before deciding to talk to anyone.
 */
export function CostCalculator({
  guide,
  tradeName,
}: {
  guide: CostGuide;
  tradeName: string;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(guide.jobs.map((j, i) => [j.id, i === 0 ? j.defaultQty : 0])),
  );
  const [region, setRegion] = useState<string>(regions[1].id);
  const [urgency, setUrgency] = useState<string>(urgencies[1].id);
  const [condition, setCondition] = useState<string>(conditions[1].id);

  const factor =
    (regions.find((r) => r.id === region)?.factor ?? 1) *
    (urgencies.find((u) => u.id === urgency)?.factor ?? 1) *
    (conditions.find((c) => c.id === condition)?.factor ?? 1);

  const lines = useMemo(
    () =>
      guide.jobs
        .map((job) => ({ job, qty: qty[job.id] ?? 0 }))
        .filter((l) => l.qty > 0),
    [guide.jobs, qty],
  );

  const total = estimate(lines, factor);
  const days = lines.length
    ? Math.max(
        1,
        Math.round(
          ((total.low + total.high) / 2 / ((guide.dayRate[0] + guide.dayRate[1]) / 2)) *
            10,
        ) / 10,
      )
    : 0;

  const bump = (id: string, delta: number, max: number) =>
    setQty((q) => ({
      ...q,
      [id]: Math.min(max, Math.max(0, (q[id] ?? 0) + delta)),
    }));

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-6 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary/15">
          <Calculator className="h-4 w-4 text-primary" />
        </span>
        <div>
          <h2 className="text-xl">Estimate your job</h2>
          <p className="text-sm text-muted-foreground">
            Pick what you need — we'll price it at current {tradeName.toLowerCase()} rates.
          </p>
        </div>
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <fieldset>
            <legend className="eyebrow">What needs doing</legend>
            <ul className="mt-3 divide-y divide-border rounded-sm border border-border">
              {guide.jobs.map((job) => {
                const value = qty[job.id] ?? 0;
                return (
                  <li
                    key={job.id}
                    className={`flex flex-wrap items-center justify-between gap-4 px-4 py-4 ${
                      value > 0 ? "bg-surface" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold">
                        {job.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {gbp(job.low)}–{gbp(job.high)} per {job.unit} · {job.note}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Fewer ${job.label}`}
                        onClick={() => bump(job.id, -1, job.maxQty)}
                        disabled={value === 0}
                        className="grid h-8 w-8 place-items-center rounded-sm border border-border hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={job.maxQty}
                        value={value}
                        aria-label={`${job.label} quantity (${job.unit})`}
                        onChange={(e) =>
                          setQty((q) => ({
                            ...q,
                            [job.id]: Math.min(
                              job.maxQty,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          }))
                        }
                        className="w-16 rounded-sm border border-border bg-background px-2 py-1.5 text-center text-sm"
                      />
                      <button
                        type="button"
                        aria-label={`More ${job.label}`}
                        onClick={() => bump(job.id, 1, job.maxQty)}
                        className="grid h-8 w-8 place-items-center rounded-sm border border-border hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <Choice
              label="Where"
              value={region}
              onChange={setRegion}
              options={regions.map((r) => ({ id: r.id, label: r.label }))}
            />
            <Choice
              label="When"
              value={urgency}
              onChange={setUrgency}
              options={urgencies.map((u) => ({ id: u.id, label: u.label }))}
            />
            <Choice
              label="Property"
              value={condition}
              onChange={setCondition}
              options={conditions.map((c) => ({ id: c.id, label: c.label }))}
            />
          </div>
        </div>

        <aside className="self-start rounded-sm border border-border-strong bg-surface p-6">
          <p className="eyebrow">Estimated cost</p>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Add at least one item to see a range.
            </p>
          ) : (
            <>
              <p className="mt-2 font-display text-3xl leading-tight text-primary">
                {gbp(total.low)} – {gbp(total.high)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Labour and standard materials, excluding VAT. Roughly {days}{" "}
                working {days === 1 ? "day" : "days"} on site.
              </p>
              <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                {lines.map((l) => (
                  <li key={l.job.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {l.qty} × {l.job.label}
                    </span>
                    <span className="shrink-0">
                      {gbp(Math.round(l.job.low * l.qty * factor))}+
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/post-job"
            search={{ trade: guide.slug }}
            className="mt-6 flex w-full items-center justify-center rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Get real quotes — free
          </Link>
          <Link
            to="/trades/$trade"
            params={{ trade: guide.slug }}
            search={{}}
            className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Browse vetted {tradeName.toLowerCase()}s
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
