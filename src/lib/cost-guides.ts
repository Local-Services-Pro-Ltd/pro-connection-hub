/**
 * UK job-cost data behind /costs — the cost-guide hub and calculator.
 *
 * Figures are typical 2026 supply-and-fit prices for domestic work in the
 * South East, VAT excluded, based on published industry rate cards and the
 * quote ranges we see on the network. They are estimates, never quotes.
 */

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
  /** Typical day rate range for the trade, £/day ex VAT. */
  dayRate: [number, number];
  jobs: CostJob[];
  /** Practical money-saving or pitfall guidance. */
  tips: string[];
  faqs: { q: string; a: string }[];
};

const guides: CostGuide[] = [
  {
    slug: "plumber",
    intro:
      "Plumbing prices split into three buckets: emergency call-outs charged by the hour, planned replacements priced per item, and full re-pipes priced by the day.",
    dayRate: [280, 420],
    jobs: [
      {
        id: "tap",
        label: "Replace a tap",
        unit: "tap",
        low: 90,
        high: 160,
        defaultQty: 1,
        maxQty: 8,
        note: "Seized old fittings and awkward basin access add an hour.",
      },
      {
        id: "radiator",
        label: "Swap a radiator",
        unit: "radiator",
        low: 180,
        high: 320,
        defaultQty: 1,
        maxQty: 12,
        note: "Cheaper when the new radiator matches the existing pipe centres.",
      },
      {
        id: "toilet",
        label: "Fit a new toilet",
        unit: "toilet",
        low: 200,
        high: 380,
        defaultQty: 1,
        maxQty: 4,
        note: "Concealed cisterns cost more than close-coupled units.",
      },
      {
        id: "leak",
        label: "Trace and fix a leak",
        unit: "visit",
        low: 120,
        high: 300,
        defaultQty: 1,
        maxQty: 3,
        note: "Add £150–£400 if floors or plaster have to come up.",
      },
      {
        id: "bathroom-pipework",
        label: "Bathroom first fix pipework",
        unit: "bathroom",
        low: 900,
        high: 1600,
        defaultQty: 1,
        maxQty: 3,
        note: "Moving the soil stack is the single biggest cost driver.",
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
        a: "Expect a £90–£180 call-out covering the first hour, then £60–£95 an hour. Weekend and bank-holiday rates sit at the top of that range.",
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
    dayRate: [280, 400],
    jobs: [
      {
        id: "socket",
        label: "Add or move a socket",
        unit: "socket",
        low: 90,
        high: 170,
        defaultQty: 2,
        maxQty: 20,
        note: "Chasing into solid walls costs more than surface trunking.",
      },
      {
        id: "downlight",
        label: "Fit downlights",
        unit: "light",
        low: 55,
        high: 110,
        defaultQty: 6,
        maxQty: 40,
        note: "Fire-rated fittings in a ceiling below a bedroom are essential.",
      },
      {
        id: "consumer-unit",
        label: "Replace the consumer unit",
        unit: "board",
        low: 500,
        high: 900,
        defaultQty: 1,
        maxQty: 2,
        note: "Includes testing and an Electrical Installation Certificate.",
      },
      {
        id: "ev-charger",
        label: "Install an EV charger",
        unit: "charger",
        low: 800,
        high: 1400,
        defaultQty: 1,
        maxQty: 2,
        note: "Long cable runs from the board to the drive add £150–£400.",
      },
      {
        id: "eicr",
        label: "EICR safety report",
        unit: "property",
        low: 150,
        high: 300,
        defaultQty: 1,
        maxQty: 3,
        note: "Priced by the number of circuits, not floor area.",
      },
    ],
    tips: [
      "A rewire is far cheaper with floors up and rooms empty — sequence it first.",
      "Landlords need an EICR every five years; book it with other works.",
      "Check the firm is registered with NICEIC, NAPIT or ELECSA.",
    ],
    faqs: [
      {
        q: "How much is a full house rewire?",
        a: "Roughly £4,000–£6,500 for a two-bed terrace and £7,000–£12,000 for a four-bed house, including certification but excluding making good plaster.",
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
    dayRate: [180, 280],
    jobs: [
      {
        id: "room",
        label: "Paint a room (walls and ceiling)",
        unit: "room",
        low: 350,
        high: 700,
        defaultQty: 2,
        maxQty: 12,
        note: "Two coats over a similar colour; dark-to-light needs three.",
      },
      {
        id: "woodwork",
        label: "Gloss the woodwork in a room",
        unit: "room",
        low: 180,
        high: 380,
        defaultQty: 1,
        maxQty: 12,
        note: "Old oil paint needs sanding and a bonding primer.",
      },
      {
        id: "wallpaper",
        label: "Hang wallpaper",
        unit: "roll",
        low: 35,
        high: 70,
        defaultQty: 6,
        maxQty: 40,
        note: "Pattern-matched and hand-printed papers cost more to hang.",
      },
      {
        id: "exterior",
        label: "Exterior masonry and trim",
        unit: "elevation",
        low: 600,
        high: 1600,
        defaultQty: 1,
        maxQty: 4,
        note: "Scaffolding is usually a separate £600–£1,200 line.",
      },
    ],
    tips: [
      "Buy your own paint if you want a specific brand — trade discounts vary.",
      "Empty and clear rooms before day one; it removes half a day of moving.",
      "Agree the number of coats in writing, not just \"paint the room\".",
    ],
    faqs: [
      {
        q: "How long does a room take?",
        a: "A standard bedroom is one to two days including preparation. Add a day for heavy filling or wallpaper stripping.",
      },
      {
        q: "Is paint included?",
        a: "Often not. Materials for an average room run £70–£180 depending on brand and finish.",
      },
    ],
  },
  {
    slug: "roofer",
    intro:
      "Roofing prices depend on access as much as materials. Anything above two storeys usually needs scaffolding, and that is a fixed cost.",
    dayRate: [300, 480],
    jobs: [
      {
        id: "tiles",
        label: "Replace slipped or broken tiles",
        unit: "visit",
        low: 150,
        high: 400,
        defaultQty: 1,
        maxQty: 4,
        note: "Matching reclaimed tiles on older roofs takes longer.",
      },
      {
        id: "ridge",
        label: "Re-bed ridge tiles",
        unit: "linear m",
        low: 45,
        high: 90,
        defaultQty: 8,
        maxQty: 40,
        note: "Dry-ridge systems cost more up front and last far longer.",
      },
      {
        id: "flat-roof",
        label: "New flat roof (EPDM or GRP)",
        unit: "m²",
        low: 90,
        high: 160,
        defaultQty: 15,
        maxQty: 120,
        note: "Includes stripping the old covering and new trims.",
      },
      {
        id: "reroof",
        label: "Full re-roof, pitched",
        unit: "m²",
        low: 120,
        high: 220,
        defaultQty: 80,
        maxQty: 300,
        note: "New battens, membrane and disposal included; scaffolding is extra.",
      },
      {
        id: "guttering",
        label: "Replace guttering",
        unit: "linear m",
        low: 25,
        high: 55,
        defaultQty: 12,
        maxQty: 80,
        note: "Cast iron replacement costs three to four times uPVC.",
      },
    ],
    tips: [
      "Get the scaffolding priced as a separate line so you can compare fairly.",
      "Ask for photos before and after — you cannot inspect the work yourself.",
      "A workmanship guarantee of 10–20 years is standard on a full re-roof.",
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
    dayRate: [250, 380],
    jobs: [
      {
        id: "full-fit",
        label: "Full bathroom refit (labour)",
        unit: "bathroom",
        low: 3200,
        high: 6500,
        defaultQty: 1,
        maxQty: 3,
        note: "Ten to fifteen working days for a standard family bathroom.",
      },
      {
        id: "shower-room",
        label: "Convert to a walk-in shower room",
        unit: "room",
        low: 2800,
        high: 5500,
        defaultQty: 1,
        maxQty: 2,
        note: "Wet-room tanking and a linear drain add £400–£900.",
      },
      {
        id: "ensuite",
        label: "New en-suite in an existing room",
        unit: "room",
        low: 3500,
        high: 7000,
        defaultQty: 1,
        maxQty: 2,
        note: "New soil connection and extract ducting drive the price.",
      },
      {
        id: "tiling",
        label: "Wall tiling",
        unit: "m²",
        low: 45,
        high: 90,
        defaultQty: 18,
        maxQty: 80,
        note: "Large-format and mosaic tiles both cost more to lay.",
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
        a: "Rarely. Fittings for a mid-range bathroom typically add £1,500–£4,000.",
      },
    ],
  },
  {
    slug: "kitchen-specialist",
    intro:
      "Kitchen fitting is quoted per unit or as a fixed install price, separate from the units themselves and from worktops.",
    dayRate: [250, 400],
    jobs: [
      {
        id: "install",
        label: "Fit kitchen units (labour)",
        unit: "unit",
        low: 90,
        high: 180,
        defaultQty: 12,
        maxQty: 40,
        note: "Includes levelling, scribing and door alignment.",
      },
      {
        id: "worktop",
        label: "Template and fit stone worktop",
        unit: "linear m",
        low: 300,
        high: 700,
        defaultQty: 5,
        maxQty: 20,
        note: "Quartz and granite are templated after units are fitted.",
      },
      {
        id: "strip-out",
        label: "Strip out the old kitchen",
        unit: "kitchen",
        low: 350,
        high: 800,
        defaultQty: 1,
        maxQty: 2,
        note: "Includes skip hire and capping off services safely.",
      },
      {
        id: "appliances",
        label: "Install integrated appliances",
        unit: "appliance",
        low: 70,
        high: 150,
        defaultQty: 4,
        maxQty: 12,
        note: "Gas hobs and hard-plumbed fridges need the relevant registration.",
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
        a: "Not necessarily. Independent fitters are often 20–30% cheaper, but you take on coordination of the trades yourself.",
      },
      {
        q: "What is the total for a mid-range kitchen?",
        a: "£8,000–£18,000 including units, worktops, appliances and all labour for a typical 12-unit kitchen.",
      },
    ],
  },
  {
    slug: "plasterer",
    intro:
      "Plastering is priced per wall, per ceiling or per day. Skimming over sound plaster is cheap; hacking off and re-boarding is not.",
    dayRate: [180, 280],
    jobs: [
      {
        id: "skim-wall",
        label: "Skim a wall",
        unit: "wall",
        low: 120,
        high: 250,
        defaultQty: 4,
        maxQty: 20,
        note: "Requires a sound, stable surface — otherwise it needs boarding.",
      },
      {
        id: "skim-ceiling",
        label: "Skim a ceiling",
        unit: "ceiling",
        low: 180,
        high: 350,
        defaultQty: 1,
        maxQty: 10,
        note: "Artex removal or overboarding adds £100–£200 per ceiling.",
      },
      {
        id: "board-skim",
        label: "Board and skim",
        unit: "m²",
        low: 35,
        high: 65,
        defaultQty: 25,
        maxQty: 150,
        note: "Includes plasterboard, scrim and two-coat finish.",
      },
      {
        id: "render",
        label: "External render",
        unit: "m²",
        low: 55,
        high: 110,
        defaultQty: 40,
        maxQty: 200,
        note: "Silicone and monocouche cost more than sand and cement.",
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
    dayRate: [200, 320],
    jobs: [
      {
        id: "door",
        label: "Hang an internal door",
        unit: "door",
        low: 90,
        high: 180,
        defaultQty: 3,
        maxQty: 20,
        note: "Includes hinges, latch and trimming to the frame.",
      },
      {
        id: "skirting",
        label: "Fit skirting and architrave",
        unit: "linear m",
        low: 18,
        high: 40,
        defaultQty: 30,
        maxQty: 200,
        note: "Ornate profiles and scribed corners take longer.",
      },
      {
        id: "wardrobe",
        label: "Built-in wardrobe",
        unit: "metre run",
        low: 700,
        high: 1600,
        defaultQty: 2,
        maxQty: 8,
        note: "Painted MDF is cheaper than hardwood or veneer.",
      },
      {
        id: "stud-wall",
        label: "Build a stud wall",
        unit: "wall",
        low: 400,
        high: 900,
        defaultQty: 1,
        maxQty: 6,
        note: "Add £150–£300 for acoustic insulation and a door opening.",
      },
      {
        id: "decking",
        label: "Build decking",
        unit: "m²",
        low: 90,
        high: 200,
        defaultQty: 15,
        maxQty: 80,
        note: "Composite boards double the material cost but need no upkeep.",
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
        a: "£200–£320 in the South East for a self-employed carpenter, plus materials.",
      },
    ],
  },
  {
    slug: "tiler",
    intro:
      "Tiling is priced per square metre, with a minimum charge for small areas. Preparation and tile format move the rate more than anything else.",
    dayRate: [200, 300],
    jobs: [
      {
        id: "wall-tiles",
        label: "Wall tiling",
        unit: "m²",
        low: 45,
        high: 90,
        defaultQty: 15,
        maxQty: 100,
        note: "Mosaics and herringbone patterns cost 30–50% more to lay.",
      },
      {
        id: "floor-tiles",
        label: "Floor tiling",
        unit: "m²",
        low: 50,
        high: 100,
        defaultQty: 20,
        maxQty: 150,
        note: "Levelling compound over an uneven floor adds £12–£25 per m².",
      },
      {
        id: "tanking",
        label: "Tank a wet room",
        unit: "m²",
        low: 40,
        high: 75,
        defaultQty: 10,
        maxQty: 40,
        note: "Non-negotiable under a walk-in shower; failures are expensive.",
      },
      {
        id: "regrout",
        label: "Re-grout and reseal",
        unit: "m²",
        low: 25,
        high: 50,
        defaultQty: 12,
        maxQty: 60,
        note: "A cheap way to refresh a bathroom without re-tiling.",
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
        a: "Most tilers charge a half-day minimum, roughly £120–£180, for small repairs.",
      },
      {
        q: "Who supplies the adhesive?",
        a: "Usually the tiler, but confirm — adhesive and grout add £8–£15 per m².",
      },
    ],
  },
  {
    slug: "gardener",
    intro:
      "Garden work is priced by the hour or day for maintenance, and per job for hedges, turf and clearance.",
    dayRate: [150, 250],
    jobs: [
      {
        id: "maintenance",
        label: "Regular garden maintenance",
        unit: "visit",
        low: 45,
        high: 90,
        defaultQty: 12,
        maxQty: 52,
        note: "Fortnightly visits usually attract a lower per-visit rate.",
      },
      {
        id: "hedge",
        label: "Cut and shape a hedge",
        unit: "linear m",
        low: 12,
        high: 30,
        defaultQty: 15,
        maxQty: 100,
        note: "Anything above 2.5m needs ladders or a platform.",
      },
      {
        id: "turf",
        label: "Lay new turf",
        unit: "m²",
        low: 14,
        high: 30,
        defaultQty: 60,
        maxQty: 400,
        note: "Includes rotovating, levelling and topsoil.",
      },
      {
        id: "clearance",
        label: "Garden clearance",
        unit: "day",
        low: 250,
        high: 450,
        defaultQty: 1,
        maxQty: 6,
        note: "Green-waste disposal is charged by the load.",
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
        a: "Maintenance is hourly (£25–£45). One-off projects should always be a fixed price.",
      },
      {
        q: "Is waste removal included?",
        a: "Often not — expect £60–£120 a load for green waste.",
      },
    ],
  },
  {
    slug: "builder",
    intro:
      "Building work is quoted per square metre of finished space, or as a fixed contract sum with a staged payment schedule.",
    dayRate: [280, 450],
    jobs: [
      {
        id: "extension",
        label: "Single-storey rear extension",
        unit: "m²",
        low: 2200,
        high: 3400,
        defaultQty: 20,
        maxQty: 60,
        note: "Shell to finished, excluding kitchen and bathroom fittings.",
      },
      {
        id: "loft",
        label: "Loft conversion",
        unit: "conversion",
        low: 42000,
        high: 78000,
        defaultQty: 1,
        maxQty: 2,
        note: "Dormer and en-suite included; hip-to-gable costs more.",
      },
      {
        id: "knock-through",
        label: "Knock through with a steel beam",
        unit: "opening",
        low: 3000,
        high: 6500,
        defaultQty: 1,
        maxQty: 3,
        note: "Includes structural calculations and building control.",
      },
      {
        id: "garage-conversion",
        label: "Garage conversion",
        unit: "conversion",
        low: 9000,
        high: 20000,
        defaultQty: 1,
        maxQty: 2,
        note: "Insulation, damp proofing and a new floor are the bulk of it.",
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
    dayRate: [300, 450],
    jobs: [
      {
        id: "combi-swap",
        label: "Swap a combi boiler like-for-like",
        unit: "boiler",
        low: 1800,
        high: 3000,
        defaultQty: 1,
        maxQty: 2,
        note: "Includes boiler, flue, filter and a power flush.",
      },
      {
        id: "conversion",
        label: "Convert system to combi",
        unit: "system",
        low: 3000,
        high: 4800,
        defaultQty: 1,
        maxQty: 2,
        note: "Removing the cylinder and tanks frees up a cupboard and loft.",
      },
      {
        id: "service",
        label: "Annual boiler service",
        unit: "service",
        low: 80,
        high: 140,
        defaultQty: 1,
        maxQty: 4,
        note: "Landlords also need a CP12 gas safety certificate.",
      },
      {
        id: "power-flush",
        label: "Power flush the system",
        unit: "system",
        low: 400,
        high: 800,
        defaultQty: 1,
        maxQty: 2,
        note: "Priced by the number of radiators, typically £45–£70 each.",
      },
      {
        id: "smart-stat",
        label: "Fit a smart thermostat",
        unit: "thermostat",
        low: 120,
        high: 280,
        defaultQty: 1,
        maxQty: 4,
        note: "Wireless models avoid running new cable through the house.",
      },
    ],
    tips: [
      "Check the engineer's Gas Safe ID card on site — the number is verifiable.",
      "Register the boiler for its warranty within 30 days of installation.",
      "Quotes in autumn are usually higher; book replacements in spring.",
    ],
    faqs: [
      {
        q: "How long does a boiler swap take?",
        a: "One day for a like-for-like combi swap, two to three days for a system conversion.",
      },
      {
        q: "Is a magnetic filter worth it?",
        a: "Yes — most manufacturers now require one for the warranty to stand.",
      },
    ],
  },
  {
    slug: "driveway-specialist",
    intro:
      "Driveways are priced per square metre. Excavation, sub-base and drainage account for more of the cost than the surface itself.",
    dayRate: [280, 450],
    jobs: [
      {
        id: "block-paving",
        label: "Block paving",
        unit: "m²",
        low: 95,
        high: 170,
        defaultQty: 40,
        maxQty: 200,
        note: "Includes excavation, MOT type 1 sub-base and edge restraints.",
      },
      {
        id: "resin",
        label: "Resin-bound surface",
        unit: "m²",
        low: 75,
        high: 130,
        defaultQty: 40,
        maxQty: 200,
        note: "Needs a sound base — laying over failed tarmac will not last.",
      },
      {
        id: "tarmac",
        label: "Tarmac",
        unit: "m²",
        low: 55,
        high: 100,
        defaultQty: 50,
        maxQty: 250,
        note: "The cheapest per m², but the shortest life of the three.",
      },
      {
        id: "dropped-kerb",
        label: "Dropped kerb",
        unit: "kerb",
        low: 900,
        high: 2000,
        defaultQty: 1,
        maxQty: 2,
        note: "Council licence and highways approval required first.",
      },
    ],
    tips: [
      "New driveways over 5 m² must be permeable or drain to a soakaway.",
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
    dayRate: [250, 380],
    jobs: [
      {
        id: "upvc",
        label: "uPVC double-glazed window",
        unit: "window",
        low: 450,
        high: 900,
        defaultQty: 6,
        maxQty: 25,
        note: "Bays and shaped heads cost roughly double a standard casement.",
      },
      {
        id: "timber",
        label: "Timber sash window",
        unit: "window",
        low: 1200,
        high: 2600,
        defaultQty: 4,
        maxQty: 20,
        note: "Conservation areas often require timber and slim units.",
      },
      {
        id: "front-door",
        label: "Composite front door",
        unit: "door",
        low: 1100,
        high: 2200,
        defaultQty: 1,
        maxQty: 3,
        note: "Side panels and multi-point locks add to the price.",
      },
      {
        id: "bifold",
        label: "Aluminium bi-fold doors",
        unit: "metre",
        low: 1100,
        high: 1900,
        defaultQty: 3,
        maxQty: 8,
        note: "Priced per metre of opening; a structural lintel may be needed.",
      },
    ],
    tips: [
      "Check the installer is FENSA or CERTASS registered — you need the certificate to sell.",
      "Compare glass specification (U-value), not just frame colour.",
      "Ten-year insurance-backed guarantees are standard; get it in writing.",
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

const bySlug = new Map(guides.map((g) => [g.slug, g]));

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

export function estimate(
  lines: { job: CostJob; qty: number }[],
  factor: number,
): Estimate {
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
