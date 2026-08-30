/**
 * Server-only certification checks shared by the admin "Run checks" action and
 * the scheduled re-verification job, so a manual run and a background run can
 * never drift apart.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  checkInsurance,
  isValidCompanyNumberFormat,
  normaliseCompanyNumber,
  overallOutcome,
  type VerificationCheck,
  type VerificationResult,
} from "@/lib/application-verification";

type Client = SupabaseClient<Database>;

async function companiesHouseCheck(
  company: string,
  chNumber: string,
): Promise<VerificationCheck> {
  if (!chNumber) {
    return {
      key: "companies_house",
      label: "Companies House",
      outcome: "fail",
      detail: "No company registration number supplied.",
    };
  }
  if (!isValidCompanyNumberFormat(chNumber)) {
    return {
      key: "companies_house",
      label: "Companies House",
      outcome: "fail",
      detail: `"${chNumber}" isn't a valid registration number (8 digits, or 2 letters and 6 digits).`,
    };
  }

  const normalised = normaliseCompanyNumber(chNumber);
  const apiKey = process.env["COMPANIES_HOUSE_API_KEY"];
  if (!apiKey) {
    return {
      key: "companies_house",
      label: "Companies House",
      outcome: "warn",
      detail: `${normalised} is a valid number format. Live register lookup is not configured, so confirm the company by hand.`,
    };
  }

  try {
    const response = await fetch(
      `https://api.company-information.service.gov.uk/company/${normalised}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
      },
    );
    if (response.status === 404) {
      return {
        key: "companies_house",
        label: "Companies House",
        outcome: "fail",
        detail: `No company found on the register for ${normalised}.`,
      };
    }
    if (!response.ok) {
      return {
        key: "companies_house",
        label: "Companies House",
        outcome: "warn",
        detail: `Register lookup failed (HTTP ${response.status}). Check by hand.`,
      };
    }
    const found = (await response.json()) as {
      company_name?: string;
      company_status?: string;
    };
    const status = found.company_status ?? "unknown";
    const nameMatch =
      (found.company_name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") ===
      company.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (status !== "active") {
      return {
        key: "companies_house",
        label: "Companies House",
        outcome: "fail",
        detail: `${found.company_name ?? normalised} is "${status}" on the register.`,
      };
    }
    return {
      key: "companies_house",
      label: "Companies House",
      outcome: nameMatch ? "pass" : "warn",
      detail: nameMatch
        ? `${found.company_name} is active on the register.`
        : `${normalised} is active as "${found.company_name}", which doesn't match the applied name "${company}".`,
    };
  } catch (lookupError) {
    console.error("[applications] CH lookup failed", lookupError);
    return {
      key: "companies_house",
      label: "Companies House",
      outcome: "warn",
      detail: "Register lookup couldn't be reached. Check by hand.",
    };
  }
}

/** Runs every automated check for one application and stores the result. */
export async function runVerificationForApplication(
  client: Client,
  applicationId: string,
): Promise<VerificationResult> {
  const { data: row, error } = await client
    .from("pro_applications")
    .select("id, company, companies_house, insurance_provider, insurance_expiry")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Application not found.");

  const checks: VerificationCheck[] = [];
  checks.push(
    await companiesHouseCheck(
      String(row.company),
      (row.companies_house as string | null) ?? "",
    ),
  );
  checks.push(
    checkInsurance(
      (row.insurance_provider as string | null) ?? null,
      (row.insurance_expiry as string | null) ?? null,
    ),
  );

  const { count: docCount } = await client
    .from("pro_application_documents")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .neq("status", "rejected");
  const docs = docCount ?? 0;
  checks.push({
    key: "documents",
    label: "Paperwork",
    outcome: docs >= 2 ? "pass" : docs > 0 ? "warn" : "fail",
    detail: `${docs} document${docs === 1 ? "" : "s"} on file.`,
  });

  const result: VerificationResult = {
    checked_at: new Date().toISOString(),
    overall: overallOutcome(checks),
    checks,
  };

  const { error: saveError } = await client
    .from("pro_applications")
    .update({ verification: result, verified_at: result.checked_at })
    .eq("id", applicationId);
  if (saveError) throw new Error(saveError.message);

  return result;
}
