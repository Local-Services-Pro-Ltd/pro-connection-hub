/**
 * Shared, browser-safe helpers for certification document tracking and the
 * automated Companies House / insurance verification checks.
 *
 * Pure functions only — the server functions in `applications.functions.ts`
 * import the same rules so the client-side hints and the authoritative
 * server-side validation can never drift apart.
 */

export type DocumentKind =
  | "insurance"
  | "companies_house"
  | "accreditation"
  | "identity"
  | "other";

export const DOCUMENT_KINDS: Array<{
  key: DocumentKind;
  label: string;
  hint: string;
  required: boolean;
}> = [
  {
    key: "insurance",
    label: "Public liability insurance",
    hint: "Certificate showing insurer, cover level and expiry date.",
    required: true,
  },
  {
    key: "companies_house",
    label: "Company registration",
    hint: "Certificate of incorporation or a Companies House filing page.",
    required: true,
  },
  {
    key: "accreditation",
    label: "Trade accreditation",
    hint: "Gas Safe, NICEIC, FENSA or similar scheme certificate.",
    required: false,
  },
  {
    key: "identity",
    label: "Photo ID",
    hint: "Passport or driving licence for the main contact.",
    required: false,
  },
  {
    key: "other",
    label: "Something else",
    hint: "Anything else you think supports the application.",
    required: false,
  },
];

export const DOCUMENT_KIND_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_KINDS.map((d) => [d.key, d.label]),
);

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.webp,.heic";

/** Returns an error message, or null when the file is acceptable. */
export function validateDocumentFile(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (!file.name.trim()) return "That file has no name.";
  if (file.size <= 0) return "That file looks empty.";
  if (file.size > MAX_DOCUMENT_BYTES)
    return `Files must be under ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB. That one is ${formatBytes(file.size)}.`;
  if (!ALLOWED_DOCUMENT_TYPES[file.type])
    return "Send a PDF or a photo (JPG, PNG, WebP or HEIC).";
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type DocumentStatus = "uploaded" | "verified" | "rejected";

export const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  uploaded: "Awaiting check",
  verified: "Verified",
  rejected: "Needs replacing",
};

export type ApplicationDocument = {
  id: string;
  kind: string;
  file_name: string;
  size_bytes: number;
  status: string;
  reviewer_note: string | null;
  created_at: string;
};

/** Share of required paperwork that has been sent and verified. */
export function documentProgress(documents: ApplicationDocument[]) {
  const required = DOCUMENT_KINDS.filter((d) => d.required);
  const sent = required.filter((d) =>
    documents.some((doc) => doc.kind === d.key && doc.status !== "rejected"),
  );
  const verified = required.filter((d) =>
    documents.some((doc) => doc.kind === d.key && doc.status === "verified"),
  );
  return {
    requiredTotal: required.length,
    sent: sent.length,
    verified: verified.length,
    missing: required.filter((d) => !sent.includes(d)).map((d) => d.label),
    percent: required.length
      ? Math.round(((sent.length + verified.length) / (required.length * 2)) * 100)
      : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Automated checks                                                    */
/* ------------------------------------------------------------------ */

export type CheckOutcome = "pass" | "warn" | "fail" | "unchecked";

export type VerificationCheck = {
  key: string;
  label: string;
  outcome: CheckOutcome;
  detail: string;
};

export type VerificationResult = {
  checked_at: string;
  overall: CheckOutcome;
  checks: VerificationCheck[];
};

export const CHECK_OUTCOME_LABEL: Record<CheckOutcome, string> = {
  pass: "Passed",
  warn: "Warning",
  fail: "Failed",
  unchecked: "Not checked",
};

/** Companies House numbers are 8 characters: 8 digits, or 2 letters + 6 digits. */
export function normaliseCompanyNumber(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidCompanyNumberFormat(value: string) {
  const v = normaliseCompanyNumber(value);
  return /^(\d{8}|[A-Z]{2}\d{6})$/.test(v);
}

export function daysUntil(dateIso: string) {
  const then = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.floor((then - now) / 86_400_000);
}

/** Insurance expiry rules: expired = fail, under 30 days = warn. */
export function checkInsurance(
  provider: string | null,
  expiry: string | null,
): VerificationCheck {
  if (!provider && !expiry)
    return {
      key: "insurance",
      label: "Insurance",
      outcome: "fail",
      detail: "No insurer or expiry date supplied.",
    };
  if (!expiry)
    return {
      key: "insurance",
      label: "Insurance",
      outcome: "warn",
      detail: `${provider} named, but no expiry date supplied.`,
    };
  const days = daysUntil(expiry);
  if (days < 0)
    return {
      key: "insurance",
      label: "Insurance",
      outcome: "fail",
      detail: `Cover expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago (${expiry}).`,
    };
  if (days <= 30)
    return {
      key: "insurance",
      label: "Insurance",
      outcome: "warn",
      detail: `Cover expires in ${days} day${days === 1 ? "" : "s"} (${expiry}). Ask for renewed cover.`,
    };
  return {
    key: "insurance",
    label: "Insurance",
    outcome: "pass",
    detail: `${provider ?? "Cover"} valid until ${expiry} (${days} days).`,
  };
}

export function overallOutcome(checks: VerificationCheck[]): CheckOutcome {
  if (checks.some((c) => c.outcome === "fail")) return "fail";
  if (checks.some((c) => c.outcome === "warn")) return "warn";
  if (checks.every((c) => c.outcome === "unchecked")) return "unchecked";
  return "pass";
}

/* ------------------------------------------------------------------ */
/* Request-changes workflow                                            */
/* ------------------------------------------------------------------ */

export const REQUESTABLE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "contact_name", label: "Main contact name" },
  { key: "phone", label: "Phone number" },
  { key: "website", label: "Website" },
  { key: "companies_house", label: "Companies House number" },
  { key: "insurance_provider", label: "Insurer name" },
  { key: "insurance_expiry", label: "Insurance expiry date" },
  { key: "accreditations", label: "Trade accreditations" },
  { key: "about", label: "About your firm" },
  { key: "document_insurance", label: "Insurance certificate (upload)" },
  { key: "document_companies_house", label: "Company registration (upload)" },
  { key: "document_accreditation", label: "Accreditation certificate (upload)" },
  { key: "document_identity", label: "Photo ID (upload)" },
];

export const REQUESTABLE_FIELD_LABEL: Record<string, string> =
  Object.fromEntries(REQUESTABLE_FIELDS.map((f) => [f.key, f.label]));

export const APPLICATION_STATUSES = [
  "pending",
  "in_review",
  "changes_requested",
  "resubmitted",
  "approved",
  "rejected",
] as const;

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: "In the queue",
  in_review: "Being checked",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Not certified yet",
};

export const OPEN_STATUSES = [
  "pending",
  "in_review",
  "changes_requested",
  "resubmitted",
];

/* ------------------------------------------------------------------ */
/* Reminder email preferences                                          */
/* ------------------------------------------------------------------ */

export type ReminderKind =
  | "documents_pending"
  | "document_rejected"
  | "insurance_expiring"
  | "insurance_expired";

export type ReminderPrefs = Record<ReminderKind, boolean>;

export const REMINDER_KINDS: Array<{
  key: ReminderKind;
  label: string;
  hint: string;
}> = [
  {
    key: "documents_pending",
    label: "Pending uploads",
    hint: "A nudge while required paperwork is still missing.",
  },
  {
    key: "document_rejected",
    label: "Rejected documents",
    hint: "Told straight away when a document can't be accepted.",
  },
  {
    key: "insurance_expiring",
    label: "Cover expiring",
    hint: "Warnings at 30 and 7 days before your insurance lapses.",
  },
  {
    key: "insurance_expired",
    label: "Cover expired",
    hint: "A weekly reminder once cover has lapsed.",
  },
];

export const REMINDER_KIND_LABEL: Record<string, string> = Object.fromEntries(
  REMINDER_KINDS.map((r) => [r.key, r.label]),
);

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  documents_pending: true,
  document_rejected: true,
  insurance_expiring: true,
  insurance_expired: true,
};

export function normaliseReminderPrefs(value: unknown): ReminderPrefs {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    documents_pending: raw["documents_pending"] !== false,
    document_rejected: raw["document_rejected"] !== false,
    insurance_expiring: raw["insurance_expiring"] !== false,
    insurance_expired: raw["insurance_expired"] !== false,
  };
}
