import { createServerFn } from "@tanstack/react-start";

/** Validates the same signed challenge used by the site's other public forms. */
export const verifyPasswordRecoveryCheck = createServerFn({ method: "POST" })
  .inputValidator((input: { checkToken?: string; checkAnswer?: string; website?: string }) => ({
    checkToken: (input.checkToken ?? "").trim().slice(0, 512),
    checkAnswer: (input.checkAnswer ?? "").trim().slice(0, 8),
    website: (input.website ?? "").trim().slice(0, 254),
  }))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Something went wrong. Please try again.");
    const { verifyChallenge } = await import("@/lib/human-check.server");
    verifyChallenge(data.checkToken, data.checkAnswer);
    return { ok: true };
  });
