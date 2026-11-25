/** Types and helpers shared by the quote server functions and screens. */

export const VAT_RATE = 0.2;
export const MAX_INVITES = 3;

export type QuoteStatus =
  "invited" | "draft" | "sent" | "accepted" | "declined" | "withdrawn" | "expired";

export type QuoteItem = { kind: "labour" | "materials"; description: string; amount_pence: number };

/** The parts of a quote both sides can see. */
export type QuoteView = {
  id: string;
  pro_id: string;
  company: string;
  status: QuoteStatus;
  labour_pence: number;
  materials_pence: number;
  vat_registered: boolean;
  vat_pence: number;
  total_pence: number;
  start_date: string | null;
  duration_days: number | null;
  warranty: string;
  payment_schedule: string;
  exclusions: string;
  possible_extras: string;
  notes: string;
  expires_on: string | null;
  sent_at: string | null;
  items: QuoteItem[];
};

/** What a firm sees for a job it has been invited to quote for. */
export type FirmQuote = QuoteView & {
  job_id: string;
  invited_at: string;
  viewed_at: string | null;
  job: {
    reference: string;
    title: string;
    description: string;
    timing: string;
    budget_band: string;
    postcode: string;
    contact_name: string;
    contact_email: string;
    photos: string[];
  };
};

export type QuoteInput = {
  quoteId: string;
  labour: number;
  materials: number;
  vatRegistered: boolean;
  startDate: string | null;
  durationDays: number | null;
  warranty: string;
  paymentSchedule: string;
  exclusions: string;
  possibleExtras: string;
  notes: string;
  expiresOn: string | null;
  items: { kind: "labour" | "materials"; description: string; amount: number }[];
  send: boolean;
};

export function toPence(pounds: number): number {
  return Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : 0;
}

/** VAT is charged on labour and materials together, and only by VAT-registered firms. */
export function quoteTotals(labourPence: number, materialsPence: number, vatRegistered: boolean) {
  const net = labourPence + materialsPence;
  const vat = vatRegistered ? Math.round(net * VAT_RATE) : 0;
  return { net, vat, total: net + vat };
}

export function gbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function longDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  invited: "Invited to quote",
  draft: "Draft, not sent",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Not chosen",
  withdrawn: "Withdrawn",
  expired: "Expired",
};
