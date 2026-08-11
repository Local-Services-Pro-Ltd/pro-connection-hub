import bathroomFitter from "@/assets/trade-bathroom-fitter.jpg";
import blacksmith from "@/assets/trade-blacksmith.jpg";
import bricklayer from "@/assets/trade-bricklayer.jpg";
import builder from "@/assets/trade-builder.jpg";
import carpenter from "@/assets/trade-carpenter.jpg";
import cctv from "@/assets/trade-cctv-satellites-alarms.jpg";
import cleaner from "@/assets/trade-cleaner.jpg";
import drainage from "@/assets/trade-drainage-specialist.jpg";
import driveway from "@/assets/trade-driveway-specialist.jpg";
import electrician from "@/assets/trade-electrician.jpg";
import floorFitter from "@/assets/trade-floor-fitter.jpg";
import gardener from "@/assets/trade-gardener.jpg";
import gasHeating from "@/assets/trade-gas-heating-engineer.jpg";
import handyman from "@/assets/trade-handyman.jpg";
import kitchen from "@/assets/trade-kitchen-specialist.jpg";
import locksmith from "@/assets/trade-locksmith.jpg";
import loft from "@/assets/trade-loft-conversion-specialist.jpg";
import painter from "@/assets/trade-painter-decorator.jpg";
import pestControl from "@/assets/trade-pest-control.jpg";
import plasterer from "@/assets/trade-plasterer.jpg";
import plumber from "@/assets/trade-plumber.jpg";
import removals from "@/assets/trade-removals.jpg";
import renewables from "@/assets/trade-renewables-specialist.jpg";
import roofer from "@/assets/trade-roofer.jpg";
import security from "@/assets/trade-security-systems.jpg";
import specialist from "@/assets/trade-specialist-tradesperson.jpg";
import stonemason from "@/assets/trade-stonemason.jpg";
import swimmingPool from "@/assets/trade-swimming-pool-specialist.jpg";
import tiler from "@/assets/trade-tiler.jpg";
import traditional from "@/assets/trade-traditional-craftspeople.jpg";
import treeSurgeon from "@/assets/trade-tree-surgeon.jpg";
import windowFitter from "@/assets/trade-window-fitter.jpg";
import street from "@/assets/street.jpg";

const map: Record<string, string> = {
  "bathroom-fitter": bathroomFitter,
  blacksmith,
  bricklayer,
  builder,
  carpenter,
  "cctv-satellites-alarms": cctv,
  cleaner,
  "drainage-specialist": drainage,
  "driveway-specialist": driveway,
  electrician,
  "floor-fitter": floorFitter,
  gardener,
  "gas-heating-engineer": gasHeating,
  handyman,
  "kitchen-specialist": kitchen,
  locksmith,
  "loft-conversion-specialist": loft,
  "painter-decorator": painter,
  "pest-control": pestControl,
  plasterer,
  plumber,
  removals,
  "renewables-specialist": renewables,
  roofer,
  "security-systems": security,
  "specialist-tradesperson": specialist,
  stonemason,
  "swimming-pool-specialist": swimmingPool,
  tiler,
  "traditional-craftspeople": traditional,
  "tree-surgeon": treeSurgeon,
  "window-fitter": windowFitter,
};

/** Hero photo for a trade slug, falling back to a generic street shot. */
export function tradeHero(slug: string): string {
  return map[slug] ?? street;
}

/** True when a bespoke photo exists for this trade (not the generic fallback). */
export function hasTradePhoto(slug: string): boolean {
  return slug in map;
}

/** True when /og/trade-<slug>.jpg exists for social share previews. */
export function hasTradeOgImage(slug: string): boolean {
  return slug in map;
}
