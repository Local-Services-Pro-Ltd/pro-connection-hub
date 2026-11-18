import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { parseJobHelperText } from "@/lib/job-helper.types";
import {
  buildJobHelperBody,
  generateJobSuggestion,
  JOB_HELPER_RATE_LIMIT,
  jobHelperRateLimited,
  normaliseJobSuggestion,
} from "@/lib/job-helper.server";

const trades = [
  { slug: "plumber", name: "Plumber" },
  { slug: "electrician", name: "Electrician" },
];
const description =
  "I need help with a leak under my kitchen sink. It is one cupboard unit, access is clear and I am not sure when it started.";
const validResult = {
  trade_slug: "plumber",
  title: "Repair a leak under the kitchen sink",
  description,
  questions_to_add: ["Is the leak constant?"],
  safety_note: null,
};
const ok = (content: object) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("job helper input", () => {
  it("trims input and enforces 20 to 1000 characters", () => {
    expect(parseJobHelperText(`  ${"x".repeat(20)}  `)).toBe("x".repeat(20));
    expect(parseJobHelperText("x".repeat(1000))).toHaveLength(1000);
    expect(() => parseJobHelperText("x".repeat(19))).toThrow();
    expect(() => parseJobHelperText("x".repeat(1001))).toThrow();
  });
});

describe("job helper AI", () => {
  it("uses Gemini's configured model, JSON object output and low reasoning effort", () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test-model");
    expect(buildJobHelperBody([])).toEqual({
      model: "gemini-test-model",
      messages: [],
      response_format: { type: "json_object" },
      reasoning_effort: "low",
    });
  });

  it("keeps the Lovable fallback free of Gemini-only reasoning settings", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("LOVABLE_API_KEY", "key");
    const body = buildJobHelperBody([]);
    expect(body.model).toBe("openai/gpt-5.6-sol");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("returns only validated fields and nulls an unknown trade slug", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    vi.stubEnv("GEMINI_MODEL", "");
    const fetchMock = vi.fn(async () =>
      ok({
        ...validResult,
        trade_slug: "invented-trade",
        title: `  ${"x".repeat(100)}  `,
        questions_to_add: ["One?", "Two?", "Three?", "Four?"],
        price: 999,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const suggestion = await generateJobSuggestion("A leak under my kitchen sink", trades);
    expect(suggestion).toEqual({
      trade_slug: null,
      title: "x".repeat(80),
      description,
      questions_to_add: ["One?", "Two?", "Three?"],
      safety_note: null,
    });
    expect(suggestion).not.toHaveProperty("price");
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe("gemini-3.8-flash");
  });

  it("rejects short descriptions and malformed results", () => {
    expect(normaliseJobSuggestion({ ...validResult, description: "Too short" }, trades)).toBeNull();
    expect(normaliseJobSuggestion(null, trades)).toBeNull();
    expect(normaliseJobSuggestion({ ...validResult, title: " " }, trades)).toBeNull();
  });

  it("returns null on provider errors without logging the key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    const fetchMock = vi.fn(async () => new Response("provider failed", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await generateJobSuggestion("A leak under my kitchen sink", trades)).toBeNull();
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret-key");
  });

  it("returns null after the 20-second timeout when fetch never resolves", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("GEMINI_API_KEY", "key");
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fetchMock);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const pending = generateJobSuggestion("A leak under my kitchen sink", trades);
      await vi.advanceTimersByTimeAsync(20_000);
      await expect(pending).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        "[job-helper] timeout",
        expect.objectContaining({ provider: "gemini" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("job helper rate limit", () => {
  it("uses five calls per IP per hour through the existing limiter", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const client = { rpc } as unknown as SupabaseClient<Database>;
    expect(await jobHelperRateLimited(client, "hashed-ip")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", {
      p_bucket: "qa:job-helper:hashed-ip",
      p_limit: 5,
      p_window_seconds: 3600,
    });
    expect(JOB_HELPER_RATE_LIMIT.limit).toBe(5);
  });

  it("blocks the sixth-call denial and fails closed on limiter errors", async () => {
    const denied = {
      rpc: vi.fn(async () => ({ data: false, error: null })),
    } as unknown as SupabaseClient<Database>;
    expect(await jobHelperRateLimited(denied, "hashed-ip")).toBe(true);
    const unavailable = {
      rpc: vi.fn(async () => ({ data: null, error: new Error("offline") })),
    } as unknown as SupabaseClient<Database>;
    await expect(jobHelperRateLimited(unavailable, "hashed-ip")).rejects.toThrow(
      "job_helper_rate_limit_unavailable",
    );
  });
});
