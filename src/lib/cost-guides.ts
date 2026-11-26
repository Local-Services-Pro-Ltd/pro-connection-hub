/**
 * UK job-cost data behind /costs — the cost-guide hub and calculator.
 *
 * Every range is drawn from published UK price guides, named in each guide's
 * `sources` and shown on the page. Where two guides price a job the range
 * spans both; where only one does, the note says so. The first fourteen guides
 * were re-checked against published sources in November 2026. They are typical
 * UK figures and the sources do not all say whether VAT is included. Every
 * figure is an estimate, never a quote.
 */

import { CHECKED, checkatrade, moreGuides, myJobQuote } from "./cost-guides-more";

export type CostJob = {
  /** Stable id, used in the calculator's URL-free local state. */
  id: string;
  label: string;
  /** What one unit is: "room", "radiator", "m²", "day". */
  unit: string;
  /** Typical low/high price per unit, £, ex VAT, South East. */
  low: number;
  high: number;
  /** Sensible starting quantity for the calculator. */
  defaultQty: number;
  /** Max quantity the slider allows. */
  maxQty: number;
  /** One line on what drives the price up or down. */
  note: string;
};

export type CostGuide = {
  /** Matches a trade slug in the trades table. */
  slug: string;
  /** Short intro shown under the hero. */
  intro: string;
  /** Typical rate range for the trade, £ ex VAT. Per day unless `rateUnit` says otherwise. */
  dayRate: [number, number];
  /** Some trades are not charged by the day: locksmiths and cleaners by the hour, lofts by area. */
  rateUnit?: "day" | "hour" | "m²" | "job";
  /**
   * Set where job prices are mostly equipment (solar panels, alarm kits), so
   * dividing the total by the day rate would give a nonsense number of days.
   */
  noDayEstimate?: boolean;
  jobs: CostJob[];
  /** Practical money-saving or pitfall guidance. */
  tips: string[];
  faqs: { q: string; a: string }[];
  /**
   * Published price guides the ranges were drawn from. Guides with sources
   * give typical UK figures; guides without are the original South East set.
   */
  sources?: { name: string; url: string }[];
  /** When the sources were last read, for example "November 2026". */
  checked?: string;
};

const guides: CostGuide[] = [
  {
    slug: "plumber",
    intro:
      "Plumbing prices split into three buckets: emergency call-outs charged by the hour, planned replacements priced per item, and bigger jobs priced by the day.",
    dayRate: [320, 480],
    checked: CHECKED,
    sources: [
      checkatrade("plumber-cost/"),
      checkatrade("how-much-do-tradespeople-cost/"),
      myJobQuote("replacing-bath-sink-taps"),
      checkatrade("toilet-installation-cost/"),
    ],
    jobs: [
      {
        id: "tap",
        label: "Replace a tap",
        unit: "tap",
        low: 80,
        high: 130,
        defaultQty: 1,
        maxQty: 6,
        note: "From one guide, supplied and fitted like for like. New supply pipes take it to £100–£250.",
      },
      {
        id: "radiator",
        label: "Fit a radiator",
        unit: "radiator",
        low: 150,
        high: 180,
        defaultQty: 1,
        maxQty: 12,
        note: "From one guide, plus VAT. Large or designer radiators cost more.",
      },
      {
        id: "toilet",
        label: "Fit a new toilet (labour)",
        unit: "toilet",
        low: 150,
        high: 300,
        defaultQty: 1,
        maxQty: 4,
        note: "From one guide: from £150 for a close-coupled toilet, from £300 for a hidden cistern. The toilet itself is extra.",
      },
      {
        id: "leak",
        label: "Fix a leak",
        unit: "visit",
        low: 75,
        high: 130,
        defaultQty: 1,
        maxQty: 3,
        note: "From one guide, plus VAT. Finding a hidden leak under floors or behind tiles costs more.",
      },
    ],
    tips: [
      "Ask whether the price includes parts — many quotes are labour only.",
      "Bundle small jobs into one visit; you pay one call-out, not three.",
      "For anything gas-related, insist on a Gas Safe registration number.",
    ],
    faqs: [
      {
        q: "What does an emergency plumber cost at night?",
        a: "More than in the daytime. Ask for the call-out fee and the hourly rate before they set off, and whether the first hour is included. Nights, weekends and bank holidays cost the most.",
      },
      {
        q: "Is a minimum charge normal?",
        a: "Yes. Most plumbers charge a one-hour minimum even for a ten-minute fix, because travel and parking are real costs.",
      },
    ],
  },
  {
    slug: "electrician",
    intro:
      "Electrical work is priced per point for small jobs and per circuit or per day for rewires. Certification is part of the price, not an extra.",
    dayRate: [225, 500],
    checked: CHECKED,
    sources: [
      checkatrade("electrician-hourly-rate/"),
      checkatrade("how-much-do-tradespeople-cost/"),
      checkatrade("cost-replacing-fuse-box-consumer-unit/"),
      myJobQuote("electrical-safety-certificate"),
      checkatrade("electrical-safety-check-cost/"),
      myJobQuote("fitting-spotlights-and-downlights"),
      checkatrade("cost-install-downlights/"),
      myJobQuote("install-ev-charging-station"),
      checkatrade("electric-car-charger-installation-cost/"),
    ],
    jobs: [
      {
        id: "socket",
        label: "Add a socket",
        unit: "socket",
        low: 50,
        high: 70,
        defaultQty: 2,
        maxQty: 12,
        note: "From one guide, plus VAT, for a simple addition. Expect a minimum charge for a single socket.",
      },
      {
        id: "downlight",
        label: "Fit downlights",
        unit: "light",
        low: 50,
        high: 90,
        defaultQty: 6,
        maxQty: 30,
        note: "Supplied and fitted. Both guides put a room of six to eight lights at £300–£500.",
      },
      {
        id: "consumer-unit",
        label: "Replace the consumer unit",
        unit: "board",
        low: 350,
        high: 800,
        defaultQty: 1,
        maxQty: 1,
        note: "About six circuits at the bottom, twelve or more at the top. Faults found during testing are extra.",
      },
      {
        id: "ev",
        label: "Install a home car charger",
        unit: "charger",
        low: 750,
        high: 1300,
        defaultQty: 1,
        maxQty: 2,
        note: "A 7kW charger, supplied and fitted. Long cable runs or a new consumer unit are priced separately.",
      },
      {
        id: "eicr",
        label: "EICR safety report",
        unit: "property",
        low: 100,
        high: 350,
        defaultQty: 1,
        maxQty: 1,
        note: "A one-bedroom flat at the bottom, a four or five-bedroom house at the top.",
      },
    ],
    tips: [
      "A rewire is far cheaper with floors up and rooms empty — sequence it first.",
      "Landlords need an EICR every five years; book it with other works.",
      "Check the firm is registered with a scheme such as NICEIC or NAPIT.",
    ],
    faqs: [
      {
        q: "How much is a full house rewire?",
        a: "It depends on the size of the house and how much plaster has to be made good afterwards. Ask for a fixed price that includes testing and the certificate.",
      },
      {
        q: "Do I need building control sign-off?",
        a: "For most notifiable work, yes — a registered electrician self-certifies it, and that should be included in the quote.",
      },
    ],
  },
  {
    slug: "painter-decorator",
    intro:
      "Decorating is priced per room or per day. Preparation — filling, sanding, sealing — is where the hours actually go.",
    dayRate: [150, 400],
    checked: CHECKED,
    sources: [
      checkatrade("painter-decorator-prices/"),
      myJobQuote("painting-a-bedroom"),
      checkatrade("cost-to-paint-exterior-of-house/"),
    ],
    jobs: [
      {
        id: "room",
        label: "Paint a room (walls and ceiling)",
        unit: "room",
        low: 250,
        high: 660,
        defaultQty: 2,
        maxQty: 10,
        note: "A small bedroom at the bottom, a large one at the top. A big living room can reach £1,000.",
      },
      {
        id: "woodwork",
        label: "Paint the skirting boards in a room",
        unit: "room",
        low: 180,
        high: 220,
        defaultQty: 2,
        maxQty: 10,
        note: "One guide quotes about £200 for a standard room. Doors and window frames add to it.",
      },
      {
        id: "wallpaper",
        label: "Hang wallpaper in a room (labour)",
        unit: "room",
        low: 300,
        high: 500,
        defaultQty: 1,
        maxQty: 6,
        note: "The wallpaper itself is extra. Stripping old paper adds time.",
      },
      {
        id: "exterior",
        label: "Paint exterior walls",
        unit: "m²",
        low: 15,
        high: 40,
        defaultQty: 60,
        maxQty: 150,
        note: "A terrace is about 40m² and a semi about 90m². Scaffolding and woodwork are extra.",
      },
    ],
    tips: [
      "Buy your own paint if you want a specific brand — trade discounts vary.",
      "Empty and clear rooms before day one; it removes half a day of moving.",
      'Agree the number of coats in writing, not just "paint the room".',
    ],
    faqs: [
      {
        q: "How long does a room take?",
        a: "A standard bedroom is one to two days including preparation. Add a day for heavy filling or wallpaper stripping.",
      },
      {
        q: "Is paint included?",
        a: "Often not. Ask whether the price includes paint, and which brand.",
      },
    ],
  },
  {
    slug: "roofer",
    intro:
      "Roofing prices depend on access as much as materials. Anything above two storeys usually needs scaffolding, and that is a fixed cost.",
    dayRate: [200, 360],
    checked: CHECKED,
    sources: [
      checkatrade("roof-repair-cost/"),
      checkatrade("roof-replacement-cost/"),
      myJobQuote("new-roof"),
      checkatrade("flat-roof-replacement-costs/"),
      myJobQuote("flat-roof-construction-cost"),
      myJobQuote("replace-guttering"),
      checkatrade("gutter-repair-cost/"),
    ],
    jobs: [
      {
        id: "tiles",
        label: "Replace broken or slipped tiles",
        unit: "m²",
        low: 85,
        high: 150,
        defaultQty: 2,
        maxQty: 20,
        note: "From one guide, before VAT and access. Concrete tiles at the bottom, clay at the top. Small repairs carry a minimum charge.",
      },
      {
        id: "ridge",
        label: "Repair ridge tiles",
        unit: "linear m",
        low: 48,
        high: 70,
        defaultQty: 6,
        maxQty: 20,
        note: "From one guide, before VAT and access.",
      },
      {
        id: "flat",
        label: "New flat roof (EPDM or GRP)",
        unit: "m²",
        low: 80,
        high: 180,
        defaultQty: 15,
        maxQty: 60,
        note: "The guides differ. Rubber (EPDM) is cheaper than fibreglass (GRP). New decking or insulation is extra.",
      },
      {
        id: "reroof",
        label: "Full re-roof, pitched",
        unit: "m²",
        low: 110,
        high: 285,
        defaultQty: 60,
        maxQty: 200,
        note: "From one guide, plus VAT. The other puts a typical house at £2,750–£7,250 before scaffolding.",
      },
      {
        id: "gutter",
        label: "Replace guttering (uPVC)",
        unit: "linear m",
        low: 40,
        high: 50,
        defaultQty: 12,
        maxQty: 40,
        note: "Supplied and fitted, including taking the old gutter down.",
      },
    ],
    tips: [
      "Get the scaffolding priced as a separate line so you can compare fairly.",
      "Ask for photos before and after — you cannot inspect the work yourself.",
      "Ask what workmanship guarantee comes with a full re-roof, and get it in writing.",
    ],
    faqs: [
      {
        q: "Why do roofing quotes vary so much?",
        a: "Access, disposal and whether the battens and membrane are being replaced. A cheap quote often means tiles relaid on old timber.",
      },
      {
        q: "Will insurance cover storm damage?",
        a: "Usually yes for sudden damage, rarely for wear and tear. Get a dated written report from the roofer for the claim.",
      },
    ],
  },
  {
    slug: "bathroom-fitter",
    intro:
      "A bathroom is a multi-trade job: strip-out, first-fix plumbing, electrics, tiling and second fix. Most quotes are labour only.",
    dayRate: [320, 480],
    checked: CHECKED,
    sources: [
      checkatrade("bathroom-fitter-costs/"),
      myJobQuote("full-bathroom-cost"),
      checkatrade("wet-room-installation-cost/"),
      myJobQuote("wet-room-cost"),
      checkatrade("ensuite-bathroom-installation-cost/"),
    ],
    jobs: [
      {
        id: "refit",
        label: "Full bathroom refit (labour)",
        unit: "bathroom",
        low: 1500,
        high: 4000,
        defaultQty: 1,
        maxQty: 3,
        note: "Labour only. Moving the toilet or bath to a new position pushes it up.",
      },
      {
        id: "wet-room",
        label: "Convert to a wet room, supplied and fitted",
        unit: "room",
        low: 4000,
        high: 12000,
        defaultQty: 1,
        maxQty: 2,
        note: "The guides put a standard room at about £5,500–£8,000. High-end fittings take it higher.",
      },
      {
        id: "ensuite",
        label: "New en-suite in an existing room, supplied and fitted",
        unit: "room",
        low: 4000,
        high: 10000,
        defaultQty: 1,
        maxQty: 2,
        note: "From one guide. Distance from the existing soil pipe and water supply is the big variable.",
      },
      {
        id: "wall-tile",
        label: "Tile the bathroom walls",
        unit: "bathroom",
        low: 400,
        high: 1250,
        defaultQty: 1,
        maxQty: 3,
        note: "The guides differ on what is included. Ask whether the price covers the tiles.",
      },
    ],
    tips: [
      "Order every fitting before day one — waiting on a delivery costs days.",
      "Keep the layout where it is if budget matters; moving the WC is expensive.",
      "Budget 15% contingency for what's found behind the old tiles.",
    ],
    faqs: [
      {
        q: "How long is the bathroom out of use?",
        a: "Two to three weeks for a full refit. Ask the fitter to leave the WC connected as long as possible.",
      },
      {
        q: "Does the quote include the suite?",
        a: "Rarely. Most fitting quotes are labour only. One guide puts fittings and materials at £2,000–£6,000.",
      },
    ],
  },
  {
    slug: "kitchen-specialist",
    intro:
      "Kitchen fitting is quoted per unit or as a fixed install price, separate from the units themselves and from worktops.",
    dayRate: [200, 350],
    checked: CHECKED,
    sources: [
      checkatrade("kitchen-fitting-cost/"),
      myJobQuote("remodel-a-kitchen"),
      checkatrade("replacing-kitchen-worktops-cost/"),
    ],
    jobs: [
      {
        id: "units",
        label: "Fit kitchen units (labour)",
        unit: "unit",
        low: 100,
        high: 150,
        defaultQty: 10,
        maxQty: 25,
        note: "Fitting a whole kitchen is quoted at £1,100–£6,000 in labour, depending on size.",
      },
      {
        id: "worktop",
        label: "Quartz or granite worktops, supplied and fitted",
        unit: "kitchen",
        low: 2500,
        high: 4500,
        defaultQty: 1,
        maxQty: 1,
        note: "From one guide. The other prices the fitting alone at £80–£180 a square metre. Cut-outs and drainer grooves are extra.",
      },
      {
        id: "strip",
        label: "Strip out the old kitchen",
        unit: "kitchen",
        low: 300,
        high: 500,
        defaultQty: 1,
        maxQty: 1,
        note: "From one guide. Skip hire is about £200–£250 a week on top.",
      },
      {
        id: "appliance",
        label: "Fit an appliance or tap",
        unit: "appliance",
        low: 50,
        high: 150,
        defaultQty: 3,
        maxQty: 8,
        note: "From one guide. Gas hobs and ovens need a Gas Safe registered engineer.",
      },
    ],
    tips: [
      "Have the electrics and plumbing moved before the units arrive.",
      "Check who is responsible for missing or damaged parts from the supplier.",
      "A fitted kitchen is 10–15 working days start to finish; plan meals around it.",
    ],
    faqs: [
      {
        q: "Should I use the retailer's fitter?",
        a: "Not necessarily. An independent fitter can cost less, but you take on coordinating the trades yourself.",
      },
      {
        q: "What is the total for a mid-range kitchen?",
        a: "One guide puts a mid-range kitchen at £8,000–£14,000 supplied and fitted, and a budget one at £5,000–£7,000.",
      },
    ],
  },
  {
    slug: "plasterer",
    intro:
      "Plastering is priced per wall, per ceiling or per day. Skimming over sound plaster is cheap; hacking off and re-boarding is not.",
    dayRate: [150, 350],
    checked: CHECKED,
    sources: [
      checkatrade("cost-plaster-room/"),
      checkatrade("cost-skimming-room/"),
      myJobQuote("plastering-an-indoor-wall-cost"),
      myJobQuote("cost-to-skim-a-room"),
      checkatrade("house-rendering-cost/"),
      myJobQuote("rendering-a-house"),
    ],
    jobs: [
      {
        id: "wall",
        label: "Skim a wall",
        unit: "wall",
        low: 250,
        high: 400,
        defaultQty: 2,
        maxQty: 12,
        note: "From one guide, which puts a typical wall at about £310.",
      },
      {
        id: "ceiling",
        label: "Skim a ceiling",
        unit: "ceiling",
        low: 200,
        high: 725,
        defaultQty: 1,
        maxQty: 8,
        note: "A small ceiling of about 9m² at the bottom, a large one of about 25m² at the top.",
      },
      {
        id: "skim-m2",
        label: "Skim over existing plaster",
        unit: "m²",
        low: 13,
        high: 30,
        defaultQty: 20,
        maxQty: 100,
        note: "Small areas cost more per square metre than whole rooms.",
      },
      {
        id: "room",
        label: "Plaster a whole room",
        unit: "room",
        low: 450,
        high: 1375,
        defaultQty: 1,
        maxQty: 6,
        note: "A small room at the bottom, a large room at the top.",
      },
      {
        id: "render",
        label: "External render",
        unit: "m²",
        low: 30,
        high: 80,
        defaultQty: 40,
        maxQty: 200,
        note: "Sand and cement at the bottom, silicone and monocouche at the top. Scaffolding is extra.",
      },
    ],
    tips: [
      "Fresh plaster needs a mist coat before painting — allow 5–14 days to dry.",
      "Clear the room completely; plasterers charge for moving furniture.",
      "One plasterer covers roughly 40–60 m² of skim a day.",
    ],
    faqs: [
      {
        q: "Can I paint straight onto new plaster?",
        a: "No. Use a watered-down mist coat first, or the topcoat will peel.",
      },
      {
        q: "Skim or re-board?",
        a: "If the existing plaster is blown or hollow-sounding, boarding is cheaper long-term than repeated patching.",
      },
    ],
  },
  {
    slug: "carpenter",
    intro:
      "Carpentry is mostly a day-rate trade, with fixed prices for common items like doors, skirting and fitted wardrobes.",
    dayRate: [150, 360],
    checked: CHECKED,
    sources: [
      checkatrade("carpentry-prices-guide/"),
      checkatrade("how-much-do-tradespeople-cost/"),
      myJobQuote("replacing-skirting-and-architrave"),
      myJobQuote("installing-a-new-fitted-wardrobe"),
      checkatrade("partition-wall-cost/"),
      myJobQuote("timber-decking"),
    ],
    jobs: [
      {
        id: "door",
        label: "Hang a door (labour)",
        unit: "door",
        low: 100,
        high: 140,
        defaultQty: 3,
        maxQty: 15,
        note: "From one guide. The door, hinges and handles are extra.",
      },
      {
        id: "skirting",
        label: "Supply and fit skirting board",
        unit: "linear m",
        low: 20,
        high: 40,
        defaultQty: 20,
        maxQty: 120,
        note: "MDF at the bottom, hardwood at the top.",
      },
      {
        id: "wardrobe",
        label: "Fitted wardrobe",
        unit: "wardrobe",
        low: 800,
        high: 3500,
        defaultQty: 1,
        maxQty: 4,
        note: "Two doors at the bottom, six doors with shelves and rails at the top. Bespoke work can reach £7,000.",
      },
      {
        id: "stud-wall",
        label: "Build a stud wall",
        unit: "wall",
        low: 800,
        high: 900,
        defaultQty: 1,
        maxQty: 4,
        note: "From one guide, for a wall about 3m by 2.4m, plastered both sides.",
      },
      {
        id: "decking",
        label: "Build timber decking",
        unit: "m²",
        low: 35,
        high: 145,
        defaultQty: 15,
        maxQty: 80,
        note: "The guides disagree. One quotes about £85 supplied and fitted with mid-range boards, the other £80–£120 for labour alone.",
      },
    ],
    tips: [
      "Second-fix carpentry after plastering, never before.",
      "Ask whether timber is included; hardwood prices move a lot.",
      "For bespoke joinery, agree a drawing before any timber is cut.",
    ],
    faqs: [
      {
        q: "Carpenter or joiner?",
        a: "A joiner makes items in a workshop; a carpenter fits them on site. Many firms do both.",
      },
      {
        q: "How much is a day?",
        a: "The guides quote £150–£360 a day, plus materials. London and the South East are at the top.",
      },
    ],
  },
  {
    slug: "tiler",
    intro:
      "Tiling is priced per square metre, with a minimum charge for small areas. Preparation and tile format move the rate more than anything else.",
    dayRate: [150, 350],
    checked: CHECKED,
    sources: [
      checkatrade("tiling-cost/"),
      myJobQuote("wall-tile-installation"),
      myJobQuote("tiling-a-floor"),
      checkatrade("regrouting-cost/"),
      myJobQuote("wet-room-cost"),
    ],
    jobs: [
      {
        id: "wall",
        label: "Wall tiling, supplied and fitted",
        unit: "m²",
        low: 60,
        high: 120,
        defaultQty: 10,
        maxQty: 60,
        note: "From one guide. Ceramic at the bottom, porcelain and glazed tiles higher. The other guide quotes about £50 a square metre for labour alone.",
      },
      {
        id: "floor",
        label: "Floor tiling, supplied and fitted",
        unit: "m²",
        low: 30,
        high: 75,
        defaultQty: 10,
        maxQty: 80,
        note: "Standard ceramic or porcelain. The guides disagree on labour, so some quotes will be above this.",
      },
      {
        id: "wetroom",
        label: "Tank a wet room",
        unit: "room",
        low: 300,
        high: 800,
        defaultQty: 1,
        maxQty: 2,
        note: "From one guide, for waterproofing the whole room before tiling.",
      },
      {
        id: "regrout",
        label: "Regrout a shower or bathroom",
        unit: "job",
        low: 160,
        high: 380,
        defaultQty: 1,
        maxQty: 2,
        note: "From one guide: about £160 for a shower and £380 for a bathroom, or about £15 a square metre.",
      },
    ],
    tips: [
      "Order 10% more tiles than the measured area for cuts and breakages.",
      "Large-format tiles need a very flat substrate — budget for levelling.",
      "Epoxy grout costs more but survives showers far better.",
    ],
    faqs: [
      {
        q: "Is there a minimum charge?",
        a: "Most tilers have a minimum charge for small repairs, often half a day. Ask before you book.",
      },
      {
        q: "Who supplies the adhesive?",
        a: "Usually the tiler, but confirm. One guide puts adhesive and grout at about £10 a square metre.",
      },
    ],
  },
  {
    slug: "gardener",
    intro:
      "Garden work is priced by the hour or day for maintenance, and per job for hedges, turf and clearance.",
    dayRate: [150, 250],
    checked: CHECKED,
    sources: [
      checkatrade("gardener-prices/"),
      checkatrade("garden-maintenance-cost/"),
      myJobQuote("hiring-a-gardener"),
      checkatrade("turfing-costs/"),
      myJobQuote("laying-garden-turf"),
      checkatrade("garden-clearance-cost/"),
    ],
    jobs: [
      {
        id: "maintenance",
        label: "Regular garden maintenance",
        unit: "visit",
        low: 30,
        high: 50,
        defaultQty: 4,
        maxQty: 24,
        note: "From one guide. Hourly rates run from £15 to £45.",
      },
      {
        id: "hedge",
        label: "Hedge trimming",
        unit: "hour",
        low: 25,
        high: 60,
        defaultQty: 2,
        maxQty: 8,
        note: "Tall hedges and taking the cuttings away cost more. One guide quotes up to £90 an hour.",
      },
      {
        id: "turf",
        label: "Lay new turf",
        unit: "m²",
        low: 10,
        high: 34,
        defaultQty: 40,
        maxQty: 200,
        note: "Supplied and laid. Standard turf is about £13–£15. Levelling the ground first can add about £20.",
      },
      {
        id: "clearance",
        label: "Garden clearance",
        unit: "job",
        low: 70,
        high: 300,
        defaultQty: 1,
        maxQty: 3,
        note: "Depends on how much there is to take away.",
      },
    ],
    tips: [
      "Check the gardener has a waste carrier licence before they take rubbish away.",
      "Avoid cutting hedges between March and August — nesting birds are protected.",
      "A yearly contract is usually cheaper than ad-hoc visits.",
    ],
    faqs: [
      {
        q: "Hourly or by the job?",
        a: "Maintenance is usually hourly, at £15–£45 in the guides. One-off projects should be a fixed price.",
      },
      {
        q: "Is waste removal included?",
        a: "Often not. One guide quotes £60–£360 a load, depending on how much there is.",
      },
    ],
  },
  {
    slug: "builder",
    intro:
      "Building work is quoted per square metre of finished space, or as a fixed contract sum with a staged payment schedule.",
    dayRate: [240, 300],
    checked: CHECKED,
    sources: [
      checkatrade("builder-day-rate/"),
      checkatrade("house-extension-cost/"),
      myJobQuote("rear-extension"),
      checkatrade("garage-conversion-cost/"),
      myJobQuote("garage-conversion-cost"),
      myJobQuote("removing-a-load-bearing-wall"),
      checkatrade("loft-conversion-cost/"),
      myJobQuote("loft-conversion"),
    ],
    jobs: [
      {
        id: "extension",
        label: "Single-storey rear extension",
        unit: "m²",
        low: 1000,
        high: 3000,
        defaultQty: 20,
        maxQty: 60,
        note: "The guides differ widely. One quotes £1,000–£2,200, the other £1,800–£3,000 before VAT. Kitchens and bathrooms are extra.",
      },
      {
        id: "loft",
        label: "Loft conversion",
        unit: "conversion",
        low: 14000,
        high: 80000,
        defaultQty: 1,
        maxQty: 1,
        note: "A rooflight conversion at the bottom, a mansard at the top. See the loft conversion guide.",
      },
      {
        id: "knock-through",
        label: "Remove a load-bearing wall",
        unit: "opening",
        low: 1000,
        high: 3000,
        defaultQty: 1,
        maxQty: 3,
        note: "From one guide, including the steel beam. Building control fees of £200–£450 and making good are extra.",
      },
      {
        id: "garage",
        label: "Garage conversion",
        unit: "conversion",
        low: 5000,
        high: 20000,
        defaultQty: 1,
        maxQty: 1,
        note: "An integral or attached single garage. A detached garage is quoted at £20,000–£31,000.",
      },
    ],
    tips: [
      "Never pay a large deposit up front — stage payments against completed work.",
      "Budget 10–15% contingency; nobody knows what is under the floor.",
      "Fees for architect, structural engineer and building control add 10–15%.",
    ],
    faqs: [
      {
        q: "Do I need planning permission?",
        a: "Many extensions fall under permitted development, but you still need building regulations approval. Confirm with your council before starting.",
      },
      {
        q: "How long does an extension take?",
        a: "Twelve to twenty weeks on site for a typical single-storey rear extension.",
      },
    ],
  },
  {
    slug: "gas-heating-engineer",
    intro:
      "Boiler and heating work is priced per installation. Only a Gas Safe registered engineer may legally work on gas appliances.",
    dayRate: [300, 300],
    checked: CHECKED,
    sources: [
      checkatrade("new-boiler-cost/"),
      myJobQuote("installing-a-new-boiler"),
      checkatrade("boiler-service-cost/"),
      myJobQuote("power-flush-cost"),
      checkatrade("power-flush-cost/"),
    ],
    jobs: [
      {
        id: "combi-swap",
        label: "Swap a combi boiler like for like",
        unit: "boiler",
        low: 1200,
        high: 4000,
        defaultQty: 1,
        maxQty: 1,
        note: "Supplied and fitted. One guide puts most mid-range jobs at £1,800–£2,800, the other at about £3,000.",
      },
      {
        id: "system-to-combi",
        label: "Convert a regular boiler to a combi",
        unit: "system",
        low: 2500,
        high: 4500,
        defaultQty: 1,
        maxQty: 1,
        note: "Removing tanks and cylinder and re-piping to the new position.",
      },
      {
        id: "service",
        label: "Annual boiler service",
        unit: "service",
        low: 80,
        high: 120,
        defaultQty: 1,
        maxQty: 3,
        note: "From one guide, including VAT.",
      },
      {
        id: "powerflush",
        label: "Power flush the system",
        unit: "system",
        low: 350,
        high: 870,
        defaultQty: 1,
        maxQty: 1,
        note: "Priced by the number of radiators: six at the bottom, sixteen or more at the top.",
      },
      {
        id: "smart-stat",
        label: "Smart thermostat",
        unit: "thermostat",
        low: 150,
        high: 265,
        defaultQty: 1,
        maxQty: 3,
        note: "The lower figure is the thermostat alone. About £265 is quoted fitted.",
      },
    ],
    tips: [
      "Check the engineer's Gas Safe ID card on site — the number is verifiable.",
      "Register the boiler for its warranty within 30 days of installation.",
      "Ask what the price includes: flue, filter, controls, system flush and taking the old boiler away.",
    ],
    faqs: [
      {
        q: "How long does a boiler swap take?",
        a: "One day for a like-for-like combi swap, two to three days for a system conversion.",
      },
      {
        q: "Is a magnetic filter worth it?",
        a: "Often. Many boiler makers ask for one as a condition of the warranty. Check the terms for your boiler.",
      },
    ],
  },
  {
    slug: "driveway-specialist",
    intro:
      "Driveways are priced per square metre. Excavation, sub-base and drainage account for more of the cost than the surface itself.",
    dayRate: [150, 200],
    checked: CHECKED,
    sources: [
      checkatrade("driveway-resurfacing-cost/"),
      myJobQuote("new-driveway"),
      myJobQuote("dropping-a-kerb"),
    ],
    jobs: [
      {
        id: "block",
        label: "Block paving",
        unit: "m²",
        low: 100,
        high: 175,
        defaultQty: 40,
        maxQty: 200,
        note: "Supplied and laid. Patterns and edging details cost more.",
      },
      {
        id: "resin",
        label: "Resin-bound surface",
        unit: "m²",
        low: 70,
        high: 120,
        defaultQty: 40,
        maxQty: 200,
        note: "Supplied and laid. Needs a sound base underneath.",
      },
      {
        id: "tarmac",
        label: "Tarmac",
        unit: "m²",
        low: 60,
        high: 90,
        defaultQty: 40,
        maxQty: 200,
        note: "Supplied and laid. Usually the cheapest hard surface.",
      },
      {
        id: "kerb",
        label: "Dropped kerb",
        unit: "kerb",
        low: 750,
        high: 3000,
        defaultQty: 1,
        maxQty: 1,
        note: "From one guide, which puts the average at about £2,000. Council application fees are extra.",
      },
    ],
    tips: [
      "A new front driveway over 5 m² must be permeable or drain within your boundary, or it needs planning permission.",
      "Ask how deep the sub-base is — 150mm is the minimum for cars.",
      "Never buy from a doorstep caller offering 'leftover tarmac'.",
    ],
    faqs: [
      {
        q: "How long does a driveway take?",
        a: "Three to six days for a typical two-car block-paved drive, weather permitting.",
      },
      {
        q: "Do I need planning permission?",
        a: "Not if the surface is permeable or drains to a soakaway within your boundary.",
      },
    ],
  },
  {
    slug: "window-fitter",
    intro:
      "Windows and doors are priced per opening, supplied and fitted, including making good internally.",
    dayRate: [175, 300],
    checked: CHECKED,
    sources: [
      checkatrade("double-glazing-cost/"),
      myJobQuote("new-window-costs"),
      checkatrade("cost-replacing-sash-windows/"),
      myJobQuote("new-front-door"),
      checkatrade("double-glazing-doors-cost/"),
      checkatrade("cost-install-bifold-doors/"),
      myJobQuote("bifold-doors"),
    ],
    jobs: [
      {
        id: "upvc",
        label: "uPVC double-glazed window",
        unit: "window",
        low: 300,
        high: 1250,
        defaultQty: 6,
        maxQty: 20,
        note: "The guides differ. One puts a standard casement at £350–£550, the other averages about £1,000.",
      },
      {
        id: "sash",
        label: "Sash window",
        unit: "window",
        low: 700,
        high: 2000,
        defaultQty: 4,
        maxQty: 16,
        note: "uPVC at the bottom. Timber is quoted at £1,500–£2,000.",
      },
      {
        id: "door",
        label: "Composite front door",
        unit: "door",
        low: 550,
        high: 2350,
        defaultQty: 1,
        maxQty: 3,
        note: "Supplied and fitted. Glazing, side panels and security locks push it up.",
      },
      {
        id: "bifold",
        label: "Aluminium bi-fold doors",
        unit: "set",
        low: 3000,
        high: 7500,
        defaultQty: 1,
        maxQty: 2,
        note: "Three panels at the bottom, five at the top. Widening the opening is extra.",
      },
    ],
    tips: [
      "Check the installer is FENSA or CERTASS registered — you need the certificate to sell.",
      "Compare glass specification (U-value), not just frame colour.",
      "Ask for an insurance-backed guarantee and get it in writing.",
    ],
    faqs: [
      {
        q: "How long do windows take to fit?",
        a: "A whole-house replacement of eight to ten windows is typically two to three days.",
      },
      {
        q: "Will they make good the plaster?",
        a: "Most quotes include internal trims but not full re-plastering. Ask explicitly.",
      },
    ],
  },
];

guides.push(...moreGuides);

const bySlug = new Map(guides.map((g) => [g.slug, g]));

/** "Typical day rate" or "Typical hourly rate", with the range. */
export function rateLabel(guide: CostGuide): string {
  const unit = guide.rateUnit ?? "day";
  return unit === "hour"
    ? "Typical hourly rate"
    : unit === "m²"
      ? "Typical cost per m²"
      : unit === "job"
        ? "Typical labour per job"
        : "Typical day rate";
}

export function rateRange(guide: CostGuide): string {
  const [low, high] = guide.dayRate;
  return low === high ? `about ${gbp(low)}` : `${gbp(low)}–${gbp(high)}`;
}

export function allCostGuides(): CostGuide[] {
  return guides;
}

export function costGuide(slug: string): CostGuide | undefined {
  return bySlug.get(slug);
}

export function hasCostGuide(slug: string): boolean {
  return bySlug.has(slug);
}

/** Regional labour multipliers applied on top of the South East baseline. */
export const regions = [
  { id: "london", label: "Greater London", factor: 1.18 },
  { id: "south-east", label: "Kent, Surrey & the South East", factor: 1 },
  { id: "midlands", label: "Midlands & East", factor: 0.92 },
  { id: "north", label: "North & Scotland", factor: 0.88 },
] as const;

/** How soon the work is needed — emergency work carries a premium. */
export const urgencies = [
  { id: "flexible", label: "Flexible dates", factor: 0.95 },
  { id: "few-weeks", label: "Within a few weeks", factor: 1 },
  { id: "this-week", label: "This week", factor: 1.1 },
  { id: "emergency", label: "Emergency / today", factor: 1.3 },
] as const;

/** Property age and access — old buildings hide surprises. */
export const conditions = [
  { id: "straightforward", label: "Straightforward access", factor: 0.95 },
  { id: "typical", label: "Typical home", factor: 1 },
  { id: "awkward", label: "Period property or tricky access", factor: 1.15 },
] as const;

export type Estimate = { low: number; high: number };

/** Rounds to a readable figure so estimates never look like fake precision. */
function round(value: number): number {
  if (value >= 10000) return Math.round(value / 500) * 500;
  if (value >= 1000) return Math.round(value / 100) * 100;
  if (value >= 200) return Math.round(value / 25) * 25;
  return Math.round(value / 5) * 5;
}

export function estimate(lines: { job: CostJob; qty: number }[], factor: number): Estimate {
  const low = lines.reduce((sum, l) => sum + l.job.low * l.qty, 0) * factor;
  const high = lines.reduce((sum, l) => sum + l.job.high * l.qty, 0) * factor;
  return { low: round(low), high: round(high) };
}

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
