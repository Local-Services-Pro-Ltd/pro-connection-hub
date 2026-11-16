import { describe, expect, it, vi, afterEach } from "vitest";
import { aiProvider, aiChatUrl, aiAuthHeaders, aiModel, aiApiKey } from "@/lib/ai-provider";
import { emailProvider, deliverEmail, mapResendError } from "@/lib/email-templates/email-transport";
import { resolveSender } from "@/lib/email-templates/send-email";
import { policy } from "@/lib/security-headers";
import { showGoogleSignIn } from "@/lib/auth-redirect";

describe("AI provider", () => {
  it("uses Gemini when GEMINI_API_KEY is set", () => {
    const e = { GEMINI_API_KEY: "g", LOVABLE_API_KEY: "l" };
    expect(aiProvider(e)).toBe("gemini");
    expect(aiChatUrl(e)).toContain("generativelanguage.googleapis.com");
    expect(aiAuthHeaders("g", e)).toEqual({ Authorization: "Bearer g" });
    expect(aiModel("google/gemini-2.5-flash", e)).toBe("gemini-flash-latest");
  });
  it("uses Lovable otherwise, and nothing without keys", () => {
    const e = { LOVABLE_API_KEY: "l" };
    expect(aiProvider(e)).toBe("lovable");
    expect(aiChatUrl(e)).toContain("ai.gateway.lovable.dev");
    expect(aiAuthHeaders("l", e)).toEqual({ "Lovable-API-Key": "l" });
    expect(aiProvider({})).toBeNull();
    expect(aiApiKey({})).toBeUndefined();
  });
});

describe("email provider", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("picks Resend when RESEND_API_KEY is set, Lovable otherwise", () => {
    expect(emailProvider({ RESEND_API_KEY: "r", LOVABLE_API_KEY: "l" })).toBe("resend");
    expect(emailProvider({ LOVABLE_API_KEY: "l" })).toBe("lovable");
  });
  it("posts to Resend with idempotency and sanitised tags", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await deliverEmail(
      {
        from: "TradesmanFinder <noreply@notify.tradesmanfinder.org>",
        to: "a@b.co",
        subject: "s",
        html: "h",
        text: "t",
        senderDomain: "notify.tradesmanfinder.org",
        template: "waiting list.confirm",
        purpose: "transactional",
        idempotencyKey: "k1",
      },
      { RESEND_API_KEY: "r" },
    );
    expect(r).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["a@b.co"]);
    expect(body.tags[1]).toEqual({ name: "template", value: "waiting_list_confirm" });
  });
  it("maps Resend errors", () => {
    const errorCode = (result: ReturnType<typeof mapResendError>) =>
      result === "suppressed" ? result : result.code;
    expect(mapResendError(422, "recipient suppressed", null)).toBe("suppressed");
    expect(errorCode(mapResendError(403, "domain not verified", null))).toBe("domain_not_verified");
    expect(errorCode(mapResendError(401, "bad key", null))).toBe("emails_disabled");
    expect(errorCode(mapResendError(422, "invalid", null))).toBe("validation_error");
    const rl = mapResendError(429, "slow", "7");
    if (rl === "suppressed") throw new Error("Expected a rate-limit error");
    expect([rl.code, rl.retryAfterSeconds]).toEqual(["rate_limited", 7]);
  });
});

describe("CSP", () => {
  it("uses the env database URL", async () => {
    const p = await policy({ SUPABASE_URL: "https://fzijsbkoiuhvjfmuvbrl.supabase.co" });
    expect(p).toContain(
      "connect-src 'self' https://fzijsbkoiuhvjfmuvbrl.supabase.co wss://fzijsbkoiuhvjfmuvbrl.supabase.co",
    );
    expect(p).not.toContain("muohvxodwefhwjhdqbxh");
  });
});

describe("Google sign-in visibility", () => {
  it("hidden off Lovable hosting without the flag", () => {
    expect(showGoogleSignIn("tradesmanfinder.org", undefined)).toBe(false);
    expect(showGoogleSignIn("tradesmanfinder.org", "true")).toBe(true);
    expect(showGoogleSignIn("pro-connection-hub.lovable.app", undefined)).toBe(true);
  });
});

describe("email sender", () => {
  it("uses EMAIL_FROM_DOMAIN when it is set", () => {
    expect(resolveSender({ EMAIL_FROM_DOMAIN: "tradesmanfinder.org" })).toEqual({
      from: "TradesmanFinder <noreply@tradesmanfinder.org>",
      senderDomain: "tradesmanfinder.org",
    });
  });
  it("keeps the notify subdomain when EMAIL_FROM_DOMAIN is unset or blank", () => {
    for (const e of [{}, { EMAIL_FROM_DOMAIN: "" }, { EMAIL_FROM_DOMAIN: "   " }]) {
      expect(resolveSender(e)).toEqual({
        from: "TradesmanFinder <noreply@notify.tradesmanfinder.org>",
        senderDomain: "notify.tradesmanfinder.org",
      });
    }
  });
});
