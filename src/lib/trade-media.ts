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

export type Focal = { focal: string; focalMobile: string };

/**
 * Where the subject sits in each photo, so the crop keeps the person and the
 * work in frame from a 390px phone to an ultrawide desktop.
 * `focal` applies from `sm` up; `focalMobile` on narrow screens where the
 * hero crop is much tighter horizontally.
 */
const focals: Record<string, Focal> = {
  "bathroom-fitter": { focal: "62% 42%", focalMobile: "68% 42%" },
  blacksmith: { focal: "50% 38%", focalMobile: "55% 38%" },
  bricklayer: { focal: "45% 35%", focalMobile: "45% 32%" },
  builder: { focal: "58% 45%", focalMobile: "66% 42%" },
  carpenter: { focal: "40% 40%", focalMobile: "38% 38%" },
  "cctv-satellites-alarms": { focal: "48% 45%", focalMobile: "52% 42%" },
  cleaner: { focal: "50% 45%", focalMobile: "52% 42%" },
  "drainage-specialist": { focal: "55% 45%", focalMobile: "60% 42%" },
  "driveway-specialist": { focal: "35% 45%", focalMobile: "32% 40%" },
  electrician: { focal: "42% 42%", focalMobile: "40% 40%" },
  "floor-fitter": { focal: "50% 55%", focalMobile: "52% 55%" },
  gardener: { focal: "40% 40%", focalMobile: "36% 38%" },
  "gas-heating-engineer": { focal: "35% 45%", focalMobile: "30% 45%" },
  handyman: { focal: "45% 42%", focalMobile: "45% 40%" },
  "kitchen-specialist": { focal: "48% 45%", focalMobile: "48% 42%" },
  locksmith: { focal: "40% 42%", focalMobile: "36% 40%" },
  "loft-conversion-specialist": { focal: "40% 42%", focalMobile: "36% 40%" },
  "painter-decorator": { focal: "42% 42%", focalMobile: "40% 40%" },
  "pest-control": { focal: "45% 40%", focalMobile: "45% 38%" },
  plasterer: { focal: "55% 45%", focalMobile: "58% 45%" },
  plumber: { focal: "55% 35%", focalMobile: "58% 32%" },
  removals: { focal: "50% 50%", focalMobile: "45% 48%" },
  "renewables-specialist": { focal: "58% 45%", focalMobile: "62% 42%" },
  roofer: { focal: "48% 35%", focalMobile: "50% 32%" },
  "security-systems": { focal: "48% 40%", focalMobile: "50% 38%" },
  "specialist-tradesperson": { focal: "45% 40%", focalMobile: "45% 38%" },
  stonemason: { focal: "48% 35%", focalMobile: "48% 32%" },
  "swimming-pool-specialist": { focal: "58% 40%", focalMobile: "62% 38%" },
  tiler: { focal: "45% 45%", focalMobile: "45% 45%" },
  "traditional-craftspeople": { focal: "38% 40%", focalMobile: "34% 38%" },
  "tree-surgeon": { focal: "45% 45%", focalMobile: "45% 45%" },
  "window-fitter": { focal: "40% 45%", focalMobile: "35% 42%" },
};

export const defaultFocal: Focal = { focal: "50% 45%", focalMobile: "60% 45%" };

/** Focal point for a trade hero, so the subject stays centred on every screen. */
export function tradeFocal(slug: string): Focal {
  return focals[slug] ?? defaultFocal;
}

/**
 * Specific, meaningful alt text per trade hero. Describes what is happening
 * in the photo (WCAG 1.1.1) rather than repeating the page heading.
 */
const alts: Record<string, string> = {
  "bathroom-fitter":
    "A bathroom fitter checking the pipework behind a newly installed basin",
  blacksmith: "A blacksmith striking hot metal on an anvil, sparks flying",
  bricklayer: "A bricklayer in a hard hat spreading mortar on a new brick wall",
  builder: "A builder in a hi-vis jacket working on a house extension at dusk",
  carpenter: "A carpenter marking a length of timber at a workshop bench",
  "cctv-satellites-alarms":
    "An engineer mounting a CCTV camera to the outside wall of a house",
  cleaner: "A professional cleaner wiping down a kitchen worktop",
  "drainage-specialist":
    "Drainage engineers jetting a blocked outside drain at a terraced house",
  "driveway-specialist":
    "A driveway specialist in hi-vis laying block paving outside a brick house",
  electrician: "An electrician testing circuits at a domestic consumer unit",
  "floor-fitter": "A floor fitter laying engineered wood boards in a living room",
  gardener: "A gardener in overalls trimming a hedge in a sunny back garden",
  "gas-heating-engineer":
    "A Gas Safe heating engineer servicing a wall-mounted combi boiler",
  handyman: "A handyman fitting a new door handle in a bright hallway",
  "kitchen-specialist": "A kitchen fitter levelling a new wall unit during an install",
  locksmith: "A locksmith fitting a new mortice lock to a front door",
  "loft-conversion-specialist":
    "A loft conversion specialist fitting a roof window in a converted attic",
  "painter-decorator":
    "A painter and decorator in white overalls rolling fresh paint onto a wall",
  "pest-control":
    "A pest control technician placing a bait station along a skirting board",
  plasterer: "A plasterer skimming a smooth finish onto an interior wall",
  plumber: "A plumber tightening pipework under a kitchen sink with a wrench",
  removals: "A removals team loading boxes into a van outside a house",
  "renewables-specialist":
    "An installer fitting solar panels to a pitched roof on a clear day",
  roofer: "A roofer in a helmet and harness fitting slate tiles to a pitched roof",
  "security-systems": "An engineer fitting an alarm control panel inside a home",
  "specialist-tradesperson":
    "A site specialist reviewing drawings inside a property under renovation",
  stonemason: "A stonemason dressing the edge of a stone block by hand",
  "swimming-pool-specialist":
    "A pool technician testing water chemistry beside an outdoor swimming pool",
  tiler: "A tiler levelling large format floor tiles in a hallway",
  "traditional-craftspeople":
    "A craftsperson hand-carving lettering into a stone panel",
  "tree-surgeon": "A tree surgeon roped into a tree, cutting a limb with a chainsaw",
  "window-fitter": "A window fitter adjusting a newly installed uPVC window",
};

/** Alt text for a trade hero photo; falls back to a plain description. */
export function tradeAlt(slug: string, tradeName: string): string {
  return alts[slug] ?? `A professional ${tradeName.toLowerCase()} at work on a UK job`;
}

/** True when a bespoke photo exists for this trade (not the generic fallback). */
export function hasTradePhoto(slug: string): boolean {
  return slug in map;
}

/** True when /og/trade-<slug>.jpg exists for social share previews. */
export function hasTradeOgImage(slug: string): boolean {
  return slug in map;
}
