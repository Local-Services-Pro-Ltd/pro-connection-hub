import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseQuestion, buildGeminiBody, GEMINI_QA_MODEL } from "@/lib/qa-ai.server";

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
  it("uses a stable model and a Gemini-safe schema", () => {
    const body = buildGeminiBody([{ role: "user", content: "x" }]);
    expect(body.model).toBe("gemini-2.5-flash");
    expect(GEMINI_QA_MODEL).toBe("gemini-2.5-flash");
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
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad schema", { status: 400 }))
      .mockResolvedValueOnce(ok(result));
    vi.stubGlobal("fetch", fetchMock);
    const out = await analyseQuestion({ title: "Leak", body: "Sink drips" }, ["plumber"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
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
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockImplementation(async () => new Response("no", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await analyseQuestion({ title: "a", body: "b" }, [])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
