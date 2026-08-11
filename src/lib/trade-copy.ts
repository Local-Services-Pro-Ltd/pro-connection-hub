/**
 * Central copy for trade hero banners.
 *
 * Edit this file to change the wording on every /trades/<slug> hero — no
 * component changes needed. `defaults` applies to all trades; add a key to
 * `overrides` to customise a single trade.
 */

export type TradeHeroCopy = {
  /** Small label above the headline. Used when no area filter is active. */
  eyebrow: string;
  /** `{trade}` = plural trade name, e.g. "Builders". */
  title: string;
  /** Optional sub-headline. `{blurb}` = the trade's blurb from the database. */
  sub: string;
  /** Eyebrow when an area filter is active. `{area}` = the area name. */
  areaEyebrow: string;
  /** Labels for the stat row under the headline. */
  stats: { cost: string; available: string; response: string };
};

export const defaults: TradeHeroCopy = {
  eyebrow: "Trade",
  title: "{trade} you can actually trust.",
  sub: "{blurb}",
  areaEyebrow: "Near {area}",
  stats: {
    cost: "Typical cost",
    available: "Free right now",
    response: "Avg. response",
  },
};

/** Per-trade tweaks. Any omitted field falls back to `defaults`. */
export const overrides: Record<string, Partial<TradeHeroCopy>> = {};

/** Alt text for the hero photo. `{trade}` = singular, lowercase trade name. */
export const heroImageAlt = "A professional {trade} at work on a UK job";

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

export function tradeHeroCopy(
  slug: string,
  vars: { trade: string; tradePlural: string; blurb: string; area?: string },
) {
  const c = { ...defaults, ...(overrides[slug] ?? {}) };
  const map = {
    trade: vars.tradePlural,
    blurb: vars.blurb,
    area: vars.area ?? "",
  };
  return {
    eyebrow: vars.area
      ? fill(c.areaEyebrow, map)
      : fill(c.eyebrow, map),
    title: fill(c.title, map),
    sub: fill(c.sub, map),
    imageAlt: fill(heroImageAlt, { trade: vars.trade.toLowerCase() }),
    stats: c.stats,
  };
}
