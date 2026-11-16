import { createServerFn } from "@tanstack/react-start";
import { ONBOARDING_FREE } from "@/lib/onboarding";

export type MatchInput = {
  trade: string;
  postcode?: string | undefined;
  budget?: string | undefined;
  jobId?: string | undefined;
  limit?: number | undefined;
};

/** Public matching results, with the commercial flag supplied only by the server. */
export const matchPublicPros = createServerFn({ method: "POST" })
  .inputValidator((input: MatchInput) => {
    const trade = (input.trade ?? "").trim();
    if (!trade) throw new Error("Choose a trade to match.");
    return {
      trade: trade.slice(0, 80),
      postcode: input.postcode?.trim().slice(0, 12) || undefined,
      budget: input.budget?.trim().slice(0, 40) || undefined,
      jobId: input.jobId?.trim() || undefined,
      limit: Math.min(Math.max(Math.round(input.limit ?? 3), 1), 100),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches, error } = await supabaseAdmin.rpc("match_pros", {
      p_trade: data.trade,
      p_limit: data.limit,
      p_onboarding_free: ONBOARDING_FREE,
      ...(data.postcode ? { p_postcode: data.postcode } : {}),
      ...(data.budget ? { p_budget: data.budget } : {}),
      ...(data.jobId ? { p_job_id: data.jobId } : {}),
    });
    if (error) throw new Error("We couldn't match that job just now.");
    return matches ?? [];
  });
