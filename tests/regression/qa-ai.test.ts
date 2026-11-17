import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseQuestion, buildGeminiBody } from "@/lib/qa-ai.server";

const ok = (content: object) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
  });
const result = {
  answer: "Check the trap.",
  safety: "none",
  safety_note: null,
  tags: ["leak"],
  urgency: "soon",
  suggested_trade: "plumber",
  verdict: "publish",
  risk: "low",
  reasons: [],
  summary: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Gemini request body", () => {
  it("uses the current Gemini default and a Gemini-safe schema", () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "");
    const body = buildGeminiBody([{ role: "user", content: "x" }]);
    expect(body.model).toBe("gemini-3.8-flash");
    const s = JSON.stringify(body.response_format);
    expect(s).not.toMatch(/[[,:[]null[\],}]/);
    expect(s).not.toContain('"strict"');
    expect(s).not.toMatch(/"type":\[/);
  });
  it("json_object mode", () => {
    expect(buildGeminiBody([], "json_object").response_format).toEqual({ type: "json_object" });
  });
});

describe("analyseQuestion on Gemini", () => {
  it("retries once with json_object after a 400 and logs without the key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    vi.stubEnv("GEMINI_MODEL", "");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad schema", { status: 400 }))
      .mockResolvedValueOnce(ok(result));
    vi.stubGlobal("fetch", fetchMock);
    const out = await analyseQuestion({ title: "Leak", body: "Sink drips" }, ["plumber"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.model).toBe("gemini-3.8-flash");
    expect(second.model).toBe("gemini-3.8-flash");
    expect(second.response_format).toEqual({ type: "json_object" });
    expect(out?.suggested_trade).toBe("plumber");
    expect(err).toHaveBeenCalledWith(
      "[qa-ai] provider error",
      expect.objectContaining({ provider: "gemini", status: 400, body: "bad schema" }),
    );
    expect(JSON.stringify(err.mock.calls)).not.toContain("secret-key");
  });
  it("returns null and logs when the retry also fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockImplementation(async () => new Response("no", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await analyseQuestion({ title: "a", body: "b" }, [])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("AI timeout budget", () => {
  it("returns null within the budget when fetch never resolves", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("GEMINI_API_KEY", "k");
      vi.stubEnv("GEMINI_MODEL", "");
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fetchMock);
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const p = analyseQuestion({ title: "Leak", body: "Sink leaks" }, ["plumber"]);
      await vi.advanceTimersByTimeAsync(20_000);
      await expect(p).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(err).toHaveBeenCalledWith(
        "[qa-ai] timeout",
        expect.objectContaining({ provider: "gemini" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("Gemini body asks for low reasoning effort", () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(buildGeminiBody([{ role: "user", content: "x" }])).toMatchObject({
      reasoning_effort: "low",
    });
    expect(buildGeminiBody([{ role: "user", content: "x" }], "json_object")).toMatchObject({
      reasoning_effort: "low",
    });
  });
  it("Lovable path body is unchanged (no reasoning_effort)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("LOVABLE_API_KEY", "k");
    const fetchMock = vi.fn(async () => ok(result));
    vi.stubGlobal("fetch", fetchMock);
    await analyseQuestion({ title: "Leak", body: "Sink leaks" }, ["plumber"]);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.model).toBe("openai/gpt-5.6-sol");
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.response_format.json_schema.strict).toBe(true);
  });
});
