import { createHash } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { parseJobHelperText } from "@/lib/job-helper.types";

function callerKey() {
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip =
    (forwarded.split(",")[0] ?? "").trim() || getRequestHeader("cf-connecting-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export const helpWriteJob = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => ({ text: parseJobHelperText(input.text) }))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { generateJobSuggestion, jobHelperRateLimited } =
        await import("@/lib/job-helper.server");

      let limited: boolean;
      try {
        limited = await jobHelperRateLimited(supabaseAdmin, callerKey());
      } catch (error) {
        console.error("[job-helper] rate limit failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        return { error: "unavailable" as const };
      }
      if (limited) return { error: "rate_limited" as const };

      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      const url = process.env["SUPABASE_URL"];
      if (!key || !url) return { error: "unavailable" as const };
      const { createClient } = await import("@supabase/supabase-js");
      const supabasePublic = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
              headers.delete("Authorization");
            }
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        },
      });
      const { data: trades, error } = await supabasePublic
        .from("trades")
        .select("slug, name")
        .order("sort_order");
      if (error || !trades?.length) return { error: "unavailable" as const };

      const suggestion = await generateJobSuggestion(data.text, trades);
      return suggestion ? { suggestion } : { error: "unavailable" as const };
    } catch (error) {
      console.error("[job-helper] request failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { error: "unavailable" as const };
    }
  });
