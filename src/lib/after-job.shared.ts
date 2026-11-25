/** Shared by the "after the job" server functions and screens. */

export const RATING_FIELDS = [
  { key: "quality", label: "Quality of the work", prompt: "Was the work done to a good standard?" },
  {
    key: "punctuality",
    label: "Punctuality",
    prompt: "Did they turn up and finish when they said?",
  },
  { key: "communication", label: "Communication", prompt: "Did they keep you informed?" },
  { key: "cleanliness", label: "Cleanliness", prompt: "Did they leave the place tidy?" },
  {
    key: "price_accuracy",
    label: "Price accuracy",
    prompt: "Did the final price match the quote?",
  },
] as const;

export type RatingKey = (typeof RATING_FIELDS)[number]["key"];
export type Ratings = Record<RatingKey, number>;

export const COMPLAINT_CATEGORIES = [
  { value: "not_started", label: "The firm hasn't started the work" },
  { value: "abandoned", label: "The work was started and not finished" },
  { value: "poor_quality", label: "The work is of poor quality" },
  { value: "overcharged", label: "I was charged more than was agreed" },
  { value: "conduct", label: "The firm's behaviour" },
  { value: "other", label: "Something else" },
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]["value"];

export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  received: "Received",
  firm_asked: "Firm asked to respond",
  resolved: "Resolved",
  closed: "Closed",
};

export function overallRating(ratings: Ratings): number {
  const values = RATING_FIELDS.map((field) => ratings[field.key]);
  return Math.min(5, Math.max(1, Math.round(values.reduce((a, b) => a + b, 0) / values.length)));
}

/** What the job page needs to know about what happened after a firm was chosen. */
export type JobAfter = {
  chosen: { pro_id: string; company: string } | null;
  outcome: "hired" | "completed" | "cancelled" | "problem" | null;
  completed_at: string | null;
  review: { status: "pending" | "published" | "rejected" } | null;
  complaint: { reference: string; status: string } | null;
};

/** Extra detail for a published review, keyed by review id. */
export type ReviewDetail = {
  id: string;
  verified_job: boolean;
  ratings: Partial<Ratings>;
  reply: string | null;
};

/** Which of the five steps the job has reached once a firm is chosen. */
export function afterStep(
  after: { outcome: string | null; review: unknown } | undefined,
): 2 | 3 | 4 {
  if (after?.review) return 4;
  if (after?.outcome === "completed") return 3;
  return 2;
}
