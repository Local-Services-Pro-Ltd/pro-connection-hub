/**
 * "Questions to ask" for homeowners comparing firms. General questions apply
 * to every job; a few trades add questions where the answer matters for
 * safety or for what paperwork the homeowner should end up with.
 */

export const GENERAL_QUESTIONS = [
  "Is the price fixed, and what would make it go up?",
  "Is VAT included in the price?",
  "What exactly is included, and what is not?",
  "When can you start, and how long will it take?",
  "Who will do the work: you, your employees or a subcontractor?",
  "How and when do you expect to be paid? Is there a deposit?",
  "What guarantee do you give on the work, and will you put it in writing?",
  "Is your public liability insurance current?",
  "Will you take away the waste, and is that in the price?",
];

const TRADE_QUESTIONS: Record<string, string[]> = {
  "gas-heating-engineer": [
    "Can I see your Gas Safe ID card? Check the back of the card lists the type of work you need.",
    "Will you register the work and give me the certificate where one is required?",
  ],
  plumber: [
    "If the job involves a boiler or any gas appliance, are you Gas Safe registered for it?",
    "Will you need to turn the water off, and for how long?",
  ],
  electrician: [
    "Which scheme are you registered with, for example NICEIC or NAPIT?",
    "Will I get an electrical certificate at the end, and will the work be notified to building control where that is required?",
  ],
  roofer: [
    "Will you need scaffolding, who arranges it, and is it in the price?",
    "Can you show me photos of the problem before the work and of the finished roof afterwards?",
  ],
  builder: [
    "Does this job need planning permission or building regulations approval, and who will apply?",
    "Will there be a written contract with stage payments tied to finished work?",
  ],
  "window-fitter": [
    "Are you FENSA registered, or will the work be signed off by building control?",
    "Will I receive the compliance certificate and the manufacturer's guarantee?",
  ],
};

const BUILDER_QUESTIONS = TRADE_QUESTIONS["builder"] ?? [];
TRADE_QUESTIONS["loft-conversion-specialist"] = BUILDER_QUESTIONS;
TRADE_QUESTIONS["bricklayer"] = BUILDER_QUESTIONS;
TRADE_QUESTIONS["bathroom-fitter"] = [
  "Who will do the plumbing and any electrical work, and are they registered for it?",
  "Is tiling, making good and waste removal included?",
];
TRADE_QUESTIONS["kitchen-specialist"] = [
  "Who will connect the gas and electrics, and are they Gas Safe and scheme registered?",
  "Is fitting worktops, appliances and making good included?",
];

export function questionsFor(tradeSlug: string | null | undefined): {
  general: string[];
  trade: string[];
} {
  return { general: GENERAL_QUESTIONS, trade: TRADE_QUESTIONS[tradeSlug ?? ""] ?? [] };
}
