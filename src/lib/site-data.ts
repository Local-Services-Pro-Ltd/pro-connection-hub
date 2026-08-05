export type Trade = {
  slug: string;
  name: string;
  blurb: string;
  pros: number;
  typicalCost: string;
};

export const trades: Trade[] = [
  {
    slug: "builder",
    name: "Builder",
    blurb: "Extensions, structural work, conversions and full renovations.",
    pros: 6,
    typicalCost: "£1,800 – £45,000",
  },
  {
    slug: "plumber",
    name: "Plumber",
    blurb: "Leaks, boilers, bathrooms and emergency call-outs.",
    pros: 7,
    typicalCost: "£90 – £3,500",
  },
  {
    slug: "electrician",
    name: "Electrician",
    blurb: "Rewires, consumer units, EV chargers and EICR certificates.",
    pros: 4,
    typicalCost: "£120 – £6,000",
  },
  {
    slug: "painter-decorator",
    name: "Painter & Decorator",
    blurb: "Interior and exterior decorating, wallpapering and spraying.",
    pros: 3,
    typicalCost: "£180 – £4,000",
  },
  {
    slug: "carpenter",
    name: "Carpenter",
    blurb: "Fitted joinery, doors, staircases, decking and second fix.",
    pros: 4,
    typicalCost: "£200 – £8,000",
  },
  {
    slug: "roofer",
    name: "Roofer",
    blurb: "Repairs, re-roofs, flat roofs, guttering and leadwork.",
    pros: 6,
    typicalCost: "£150 – £12,000",
  },
  {
    slug: "plasterer",
    name: "Plasterer",
    blurb: "Skimming, rendering, coving and damp-proof plastering.",
    pros: 4,
    typicalCost: "£150 – £2,500",
  },
  {
    slug: "tiler",
    name: "Tiler",
    blurb: "Bathrooms, kitchens, floors, wet rooms and natural stone.",
    pros: 3,
    typicalCost: "£200 – £3,000",
  },
  {
    slug: "gardener",
    name: "Gardener / Landscaper",
    blurb: "Garden design, patios, fencing, turfing and maintenance.",
    pros: 3,
    typicalCost: "£80 – £15,000",
  },
  {
    slug: "handyman",
    name: "Handyman",
    blurb: "Odd jobs, flat-pack, shelving, small repairs and fixes.",
    pros: 4,
    typicalCost: "£60 – £600",
  },
];

export type Pro = {
  id: string;
  name: string;
  company: string;
  trade: string;
  tradeSlug: string;
  area: string;
  rating: number;
  reviews: number;
  years: number;
  responseMins: number;
  verified: string[];
  bio: string;
  services: string[];
  photo: 1 | 2 | 3;
};

export const pros: Pro[] = [
  {
    id: "marcus-webb",
    name: "Marcus Webb",
    company: "Webb Plumbing & Heating",
    trade: "Plumber",
    tradeSlug: "plumber",
    area: "Bristol",
    rating: 4.9,
    reviews: 87,
    years: 18,
    responseMins: 42,
    verified: ["ID checked", "Gas Safe", "Public liability £2m"],
    bio: "Family-run heating and plumbing firm covering Bristol and north Somerset. Boiler installs, full bathroom fits and same-day leak work.",
    services: [
      "Boiler installation & servicing",
      "Bathroom installation",
      "Leak detection",
      "Emergency call-out",
    ],
    photo: 1,
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    company: "Shah Electrical",
    trade: "Electrician",
    tradeSlug: "electrician",
    area: "Manchester",
    rating: 5,
    reviews: 61,
    years: 11,
    responseMins: 25,
    verified: ["ID checked", "NICEIC approved", "Public liability £5m"],
    bio: "NICEIC-approved contractor specialising in domestic rewires, EV charge points and landlord certification across Greater Manchester.",
    services: [
      "Full & partial rewires",
      "EV charger installation",
      "Consumer unit upgrades",
      "EICR reports",
    ],
    photo: 2,
  },
  {
    id: "tom-halloran",
    name: "Tom Halloran",
    company: "Halloran Joinery",
    trade: "Carpenter",
    tradeSlug: "carpenter",
    area: "Leeds",
    rating: 4.8,
    reviews: 54,
    years: 26,
    responseMins: 90,
    verified: ["ID checked", "City & Guilds", "Public liability £2m"],
    bio: "Bespoke joinery workshop making fitted wardrobes, staircases and alcove units. Twenty-six years on the tools, mostly period property work.",
    services: [
      "Fitted wardrobes & alcoves",
      "Staircases",
      "Doors & second fix",
      "Decking",
    ],
    photo: 3,
  },
];

export const areas = [
  { slug: "london", name: "London", pros: 12, note: "All 32 boroughs covered" },
  { slug: "manchester", name: "Manchester", pros: 8, note: "Greater Manchester" },
  { slug: "birmingham", name: "Birmingham", pros: 7, note: "West Midlands" },
  { slug: "bristol", name: "Bristol", pros: 6, note: "Bristol & Bath" },
  { slug: "leeds", name: "Leeds", pros: 5, note: "West Yorkshire" },
  { slug: "glasgow", name: "Glasgow", pros: 4, note: "Strathclyde" },
  { slug: "cardiff", name: "Cardiff", pros: 4, note: "South Wales" },
  { slug: "newcastle", name: "Newcastle", pros: 3, note: "Tyne & Wear" },
];

export const reviews = [
  {
    quote:
      "Three quotes in under two hours, all with photos of previous work. Picked the middle one and the bathroom was done in four days.",
    name: "Hannah D.",
    place: "Bristol",
    job: "Bathroom refit",
  },
  {
    quote:
      "I'd been ghosted by two electricians before this. The one I found here turned up when he said he would, which is all I wanted.",
    name: "Ade O.",
    place: "Manchester",
    job: "Consumer unit upgrade",
  },
  {
    quote:
      "Being able to read real reviews rather than a star rating with no detail made the difference. No haggling, no hard sell.",
    name: "Ruth M.",
    place: "Leeds",
    job: "Fitted wardrobes",
  },
];

export const stats = [
  { value: "36", label: "Verified tradesmen" },
  { value: "1,200+", label: "Jobs posted" },
  { value: "91 min", label: "Average response" },
  { value: "395", label: "Customer reviews" },
];
