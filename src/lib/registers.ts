export const CREDENTIAL_KINDS = [
  "companies_house",
  "gas_safe",
  "niceic",
  "napit",
  "fensa",
  "insurance",
  "other",
] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export type CredentialState = "verified" | "expired" | "pending";

export type CredentialStateInput = {
  verified: boolean;
  expires_on: string | null;
};

export const REGISTERS: Record<CredentialKind, { label: string; url: string | null }> = {
  companies_house: {
    label: "Companies House",
    url: "https://find-and-update.company-information.service.gov.uk/company/{reference}",
  },
  gas_safe: {
    label: "Gas Safe Register",
    url: "https://www.gassaferegister.co.uk/",
  },
  niceic: {
    label: "NICEIC",
    url: "https://www.niceic.com/find-a-contractor",
  },
  napit: {
    label: "NAPIT",
    url: "https://www.napit.org.uk/find-a-member",
  },
  fensa: {
    label: "FENSA",
    url: "https://www.fensa.org.uk/find-an-installer",
  },
  insurance: {
    label: "Public liability insurance",
    url: null,
  },
  other: {
    label: "Other",
    url: null,
  },
};

export function isCredentialKind(kind: string): kind is CredentialKind {
  return (CREDENTIAL_KINDS as readonly string[]).includes(kind);
}

export function credentialRegister(kind: string) {
  return isCredentialKind(kind) ? REGISTERS[kind] : REGISTERS.other;
}

export function credentialRegisterUrl(kind: string, reference: string | null): string | null {
  const template = credentialRegister(kind).url;
  if (!template) return null;
  if (template.includes("{reference}")) {
    const trimmed = reference?.trim();
    if (!trimmed) return null;
    return template.replace("{reference}", encodeURIComponent(trimmed));
  }
  return template;
}

/** Expiry wins over the stored verification flag, including on the expiry job's next run. */
export function credentialState(
  credential: CredentialStateInput,
  today: Date | string = new Date(),
): CredentialState {
  const todayDate =
    typeof today === "string" ? today.slice(0, 10) : today.toISOString().slice(0, 10);
  const expiryDate = credential.expires_on?.slice(0, 10) ?? null;
  if (expiryDate && expiryDate < todayDate) return "expired";
  return credential.verified ? "verified" : "pending";
}

export function credentialVerificationUpdate(
  verified: boolean,
  now = new Date(),
): { verified: boolean; verified_at?: string } {
  return verified ? { verified, verified_at: now.toISOString() } : { verified };
}
