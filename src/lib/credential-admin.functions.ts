import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  credentialVerificationUpdate,
  isCredentialKind,
  type CredentialKind,
} from "@/lib/registers";

async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

function cleanId(value: string, field: string) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned.length > 100) throw new Error(`${field} is required`);
  return cleaned;
}

function cleanOptional(value: string | null | undefined, maxLength: number) {
  const cleaned = value?.trim() ?? "";
  if (cleaned.length > maxLength) throw new Error("One of the credential fields is too long");
  return cleaned || null;
}

export const adminListCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proId: string }) => ({ proId: cleanId(input.proId, "Firm") }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credentials, error } = await supabaseAdmin
      .from("pro_credentials")
      .select("*")
      .eq("pro_id", data.proId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load credentials.");
    return credentials ?? [];
  });

type AddCredentialInput = {
  proId: string;
  kind: CredentialKind;
  label: string;
  reference?: string;
  expiresOn?: string;
};

export const adminAddCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AddCredentialInput) => {
    if (!isCredentialKind(input.kind)) throw new Error("Choose a credential kind");
    const label = input.label?.trim();
    if (!label || label.length > 160) throw new Error("Enter a credential label");
    const expiresOn = cleanOptional(input.expiresOn, 10);
    if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
      throw new Error("Enter a valid expiry date");
    }
    return {
      proId: cleanId(input.proId, "Firm"),
      kind: input.kind,
      label,
      reference: cleanOptional(input.reference, 120),
      expiresOn,
    };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credential, error } = await supabaseAdmin
      .from("pro_credentials")
      .insert({
        pro_id: data.proId,
        kind: data.kind,
        label: data.label,
        reference: data.reference,
        expires_on: data.expiresOn,
        verified: false,
      })
      .select("*")
      .single();
    if (error) throw new Error("Could not add the credential.");
    return credential;
  });

export const adminSetCredentialVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; verified: boolean }) => {
    if (typeof input.verified !== "boolean") throw new Error("Verification state is required");
    return { id: cleanId(input.id, "Credential"), verified: input.verified };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credential, error } = await supabaseAdmin
      .from("pro_credentials")
      .update(credentialVerificationUpdate(data.verified))
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error("Could not update the credential.");
    return credential;
  });
