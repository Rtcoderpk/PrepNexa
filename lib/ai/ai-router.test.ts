import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIError, type AIProvider, type AITask, type ChatOptions } from "@/lib/ai/ai-types";
import { withRetry, isRetryableKind } from "@/lib/ai/retry-manager";
import { generateAIResponse, generateAIStream } from "@/lib/ai/ai-router";
import {
  recordFailure,
  recordSuccess,
  resetProviderHealth,
  isCooldown,
} from "@/lib/ai/provider-health";
import { redactedUrl } from "@/lib/ai/providers/gemini";

// ---- Fakes / mocks ------------------------------------------------
function fakeProvider(
  id: string,
  priority: number,
  behavior: "ok" | "fail" | "rate" | "quota" | "timeout" | "invalid" | "config" = "ok",
): AIProvider {
  return {
    id,
    priority,
    supports: () => true,
    async chat(_options: ChatOptions): Promise<string> {
      if (behavior === "fail") throw new AIError("server_error", `${id} down`, { providerId: id });
      if (behavior === "rate") throw new AIError("rate_limited", `${id} limited`, { providerId: id, retryAfterSec: 2 });
      if (behavior === "quota") throw new AIError("quota", `${id} quota`, { providerId: id });
      if (behavior === "timeout") throw new AIError("timeout", `${id} timeout`, { providerId: id });
      if (behavior === "invalid") throw new AIError("invalid_response", `${id} bad`, { providerId: id });
      if (behavior === "config") throw new AIError("config", `${id} misconfigured`, { providerId: id });
      return `reply from ${id}`;
    },
    async ping() {
      return true;
    },
  };
}

// Small typed helper so the test can inject a provider list into the router.
const testProviders: AIProvider[] = [];
function setProviders(list: AIProvider[]): void {
  testProviders.splice(0, testProviders.length, ...list);
}

// Mock lib/ai/providers + usage + redis so tests don't need live infra.
vi.mock("@/lib/ai/providers", () => ({
  createProviders: () => [...testProviders],
}));

vi.mock("@/lib/redis", () => ({
  getRedis: async () => null,
}));

// Lifted budget mocks so individual tests can override results.
const reserveMock = vi.hoisted(() => vi.fn());
const releaseMock = vi.hoisted(() => vi.fn());
const logUsageMock = vi.hoisted(() => vi.fn(async (_p: Record<string, unknown>) => undefined));

vi.mock("@/lib/usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage")>();
  return {
    ...actual,
    reserveAiBudget: reserveMock,
    releaseAiBudget: releaseMock,
    logAiUsage: logUsageMock,
    persistProviderHealth: async () => {},
  };
});

beforeEach(() => {
  vi.resetModules();
  resetProviderHealth();
  reserveMock.mockReset().mockResolvedValue({ allowed: true });
  releaseMock.mockReset().mockResolvedValue(undefined);
  logUsageMock.mockClear();
  setProviders([]);
});

afterEach(() => {
  setProviders([]);
});

const task: AITask = "interview_question";

// ---- withRetry: backoff + Retry-After + bounded -------------------
describe("withRetry", () => {
  it("isRetryableKind marks transient kinds only", () => {
    expect(isRetryableKind("rate_limited")).toBe(true);
    expect(isRetryableKind("timeout")).toBe(true);
    expect(isRetryableKind("server_error")).toBe(true);
    expect(isRetryableKind("config")).toBe(false);
    expect(isRetryableKind("invalid_response")).toBe(false);
    expect(isRetryableKind("quota")).toBe(false);
  });

  it("does not retry config errors (fail fast)", async () => {
    const fn = vi.fn().mockRejectedValue(new AIError("config", "no key"));
    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow("no key");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects maxAttempts (bounded — no infinite retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new AIError("timeout", "t"));
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 })).rejects.toThrow("t");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries retryable kinds and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIError("server_error", "first"))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After by waiting at least that long", async () => {
    const t0 = Date.now();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIError("rate_limited", "r", { retryAfterSec: 2 }))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 })).resolves.toBe("ok");
    // Retry-After 2s dominates the tiny backoff.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1900);
  });
});

// ---- Router: priority + fallback + all-fail ------------------------
describe("generateAIResponse", () => {
  it("tries providers in priority order (deterministic, not registration order)", async () => {
    // Registration order deliberately reversed; priority must win.
    setProviders([
      fakeProvider("openrouter", 40, "ok"),
      fakeProvider("groq", 10, "fail"),
      fakeProvider("gemini", 20, "ok"),
      fakeProvider("cloudflare", 30, "ok"),
    ]);
    const result = await generateAIResponse({ task, messages: [] });
    expect(result).toBe("reply from gemini"); // groq failed first, gemini next.
  });

  it("fails over when the first provider errors", async () => {
    setProviders([
      fakeProvider("groq", 10, "fail"),
      fakeProvider("gemini", 20, "ok"),
    ]);
    await expect(generateAIResponse({ task, messages: [] })).resolves.toBe("reply from gemini");
  });

  it("fails over past a single provider's config error when others are healthy", async () => {
    const cfg = fakeProvider("groq", 10, "ok");
    cfg.chat = async () => {
      throw new AIError("config", "Groq API key not configured", { providerId: "groq" });
    };
    setProviders([
      cfg,
      fakeProvider("gemini", 20, "ok"),
    ]);
    await expect(generateAIResponse({ task, messages: [] })).resolves.toBe("reply from gemini");
  });

  it("propagates config when EVERY provider fails with config", async () => {
    setProviders([
      fakeProvider("groq", 10, "config"),
      fakeProvider("gemini", 20, "config"),
    ]);
    await expect(generateAIResponse({ task, messages: [] })).rejects.toMatchObject({ kind: "config" });
  });

  it("returns a stable error when ALL providers fail", async () => {
    // quota is non-retryable (fails fast, no heavy backoff) but still fails over,
    // so the all-fail handler is reached quickly.
    setProviders([
      fakeProvider("groq", 10, "quota"),
      fakeProvider("gemini", 20, "quota"),
    ]);
    const err = await generateAIResponse({ task, messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.message).toBe("All AI providers are temporarily unavailable");
  });

  it("skips providers currently in cooldown", async () => {
    recordFailure("groq", "rate_limited", 60);
    setProviders([
      fakeProvider("groq", 10, "ok"),
      fakeProvider("gemini", 20, "ok"),
    ]);
    // groq is in cooldown → gemini handles it.
    await expect(generateAIResponse({ task, messages: [] })).resolves.toBe("reply from gemini");
  });
});

// ---- Cooldown behavior + recovery ---------------------------------
describe("cooldowns", () => {
  it("rate_limited sets a cooldown (min 15s)", async () => {
    recordFailure("groq", "rate_limited");
    expect(await isCooldown("groq")).toBe(true);
  });

  it("quota sets a longer cooldown", async () => {
    recordFailure("gemini", "quota");
    expect(await isCooldown("gemini")).toBe(true);
  });

  it("success clears the cooldown (provider recovery)", async () => {
    recordFailure("groq", "rate_limited");
    expect(await isCooldown("groq")).toBe(true);
    recordSuccess("groq", 200);
    expect(await isCooldown("groq")).toBe(false);
  });

  it("transient failure records a short cooldown", async () => {
    recordFailure("cloudflare", "server_error");
    expect(await isCooldown("cloudflare")).toBe(true);
  });
});

// ---- In-flight cleanup --------------------------------------------
describe("in-flight cleanup", () => {
  it("releases in-flight state when the request throws mid-dispatch", async () => {
    setProviders([
      fakeProvider("groq", 10, "config"),
      fakeProvider("gemini", 20, "config"),
    ]);
    await expect(
      generateAIResponse({ task, messages: [] }, { dedupKey: "k1" }),
    ).rejects.toMatchObject({ kind: "config" });

    // A second call with the same dedup key must NOT be blocked as in-flight.
    resetProviderHealth(); // clear the cooldowns the first config failure set
    setProviders([
      fakeProvider("groq", 10, "ok"),
      fakeProvider("gemini", 20, "ok"),
    ]);
    await expect(generateAIResponse({ task, messages: [] }, { dedupKey: "k1" })).resolves.toBe(
      "reply from groq",
    );
  });
});

// ---- Gemini key redaction -----------------------------------------
describe("Gemini URL redaction", () => {
  it("redacts the API key from the logged URL", () => {
    process.env.GEMINI_API_KEY = "AIzaSOMEKEYVALUE12345678901234567890";
    const url = redactedUrl("gemini-2.0-flash");
    expect(url).not.toContain("AIza");
    expect(url).toContain("key=<REDACTED>");
    delete process.env.GEMINI_API_KEY;
  });
});

// ---- Per-user AI budget guardrail --------------------------------
describe("per-user AI budget (RouteOptions.userId)", () => {
  it("blocks a request when the budget is exceeded (kind=budget_limit)", async () => {
    reserveMock.mockResolvedValue({ allowed: false, reason: "daily" });
    setProviders([
      fakeProvider("groq", 10, "ok"),
    ]);
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "user-1" }),
    ).rejects.toMatchObject({ kind: "budget_limit" });
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "user-1" }),
    ).rejects.toThrow("AI usage limit");
  });

  it("allows through when within budget", async () => {
    reserveMock.mockResolvedValue({ allowed: true });
    setProviders([
      fakeProvider("groq", 10, "ok"),
    ]);
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "user-1" }),
    ).resolves.toBe("reply from groq");
  });

  it("does NOT release the reservation on success", async () => {
    reserveMock.mockResolvedValue({ allowed: true });
    releaseMock.mockClear();
    setProviders([
      fakeProvider("groq", 10, "ok"),
    ]);
    await generateAIResponse({ task, messages: [] }, { userId: "user-1" });
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it("releases the reservation when all providers fail", async () => {
    reserveMock.mockResolvedValue({ allowed: true });
    releaseMock.mockClear();
    setProviders([
      fakeProvider("groq", 10, "quota"),
      fakeProvider("gemini", 20, "quota"),
    ]);
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "user-1" }),
    ).rejects.toThrow("All AI providers");
    expect(releaseMock).toHaveBeenCalledWith("user-1");
  });
});

// ---- Duplicate dispatch dedup -------------------------------------
describe("dedupKey (duplicate dispatch protection)", () => {
  it("blocks a concurrent duplicate request with the same task+key", async () => {
    let resolveFirst: () => void;
    const gate = new Promise<void>((r) => (resolveFirst = r));
    const slow = fakeProvider("groq", 10, "ok");
    slow.chat = async () => {
      await gate;
      return "slow reply";
    };
    setProviders([slow]);
    const first = generateAIResponse(
      { task, messages: [] },
      { dedupKey: "k1", userId: "u1" },
    );
    const second = generateAIResponse(
      { task, messages: [] },
      { dedupKey: "k1", userId: "u1" },
    );
    // The duplicate should fail fast while the first is still in flight.
    await expect(second).rejects.toThrow("already in progress");
    // The duplicate is rejected BEFORE budget reservation — no budget leak.
    expect(reserveMock).toHaveBeenCalledTimes(1); // only the first reserved
    resolveFirst!();
    await expect(first).resolves.toBe("slow reply");
    // After completion the key is released — a new call proceeds.
    setProviders([]);
    resetProviderHealth();
    setProviders([fakeProvider("groq", 10, "ok")]);
    await expect(generateAIResponse({ task, messages: [] }, { dedupKey: "k1" })).resolves.toBe(
      "reply from groq",
    );
  });
});

// ---- Retry/fallback telemetry -------------------------------------
describe("retry/fallback telemetry", () => {
  it("logs fallback_from/fallback_to and attempts when a provider fails over", async () => {
    setProviders([
      fakeProvider("groq", 10, "fail"),
      fakeProvider("gemini", 20, "ok"),
    ]);
    await generateAIResponse({ task, messages: [] }, { userId: "u1" });
    const successLog = logUsageMock.mock.calls.find((c) => c[0].success === true);
    expect(successLog).toBeDefined();
    // Gemini succeeded after falling back from groq.
    expect(successLog![0].provider).toBe("gemini");
    expect(successLog![0].fallbackFrom).toBe("groq");
    expect(successLog![0].fallbackTo).toBe("gemini");
    expect(successLog![0].attempts).toBeGreaterThan(0);
  });

  it("logs attempts on a single-provider success (no fallback)", async () => {
    setProviders([fakeProvider("groq", 10, "ok")]);
    await generateAIResponse({ task, messages: [] }, { userId: "u1" });
    const successLog = logUsageMock.mock.calls.find((c) => c[0].success === true);
    expect(successLog![0].provider).toBe("groq");
    expect(successLog![0].fallbackFrom).toBeUndefined();
    expect(successLog![0].attempts).toBe(1);
  });
});

// ---- P3: token usage carried into telemetry ------------------------
describe("token telemetry (P3)", () => {
  it("passes normalized usage from chatWithUsage into logAiUsage", async () => {
    const withUsage = fakeProvider("groq", 10, "ok");
    withUsage.chatWithUsage = async () => ({
      content: "reply with usage",
      usage: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
    });
    setProviders([withUsage]);
    await generateAIResponse({ task, messages: [] }, { userId: "u1" });
    const successLog = logUsageMock.mock.calls.find((c) => c[0].success === true);
    expect(successLog).toBeDefined();
    expect(successLog![0].promptTokens).toBe(100);
    expect(successLog![0].completionTokens).toBe(40);
    expect(successLog![0].totalTokens).toBe(140);
  });

  it("logs null token fields when usage is unavailable (request still succeeds)", async () => {
    const noUsage = fakeProvider("groq", 10, "ok");
    noUsage.chatWithUsage = async () => ({ content: "reply", usage: null });
    setProviders([noUsage]);
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "u1" }),
    ).resolves.toBe("reply");
    const successLog = logUsageMock.mock.calls.find((c) => c[0].success === true);
    expect(successLog![0].promptTokens).toBeNull();
    expect(successLog![0].completionTokens).toBeNull();
    expect(successLog![0].totalTokens).toBeNull();
  });

  it("falls back to chat() when a provider lacks chatWithUsage", async () => {
    const plain = fakeProvider("groq", 10, "ok");
    delete plain.chatWithUsage;
    setProviders([plain]);
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "u1" }),
    ).resolves.toBe("reply from groq");
    const successLog = logUsageMock.mock.calls.find((c) => c[0].success === true);
    expect(successLog![0].promptTokens).toBeNull();
  });
});

// ---- P7-F1: streaming budget + idempotency -------------------------
describe("generateAIStream budget/dedup (P7-F1)", () => {
  it("reserves budget + dedup at stream start and keeps the slot on success", async () => {
    const streamable = fakeProvider("groq", 10, "ok");
    streamable.stream = async function* () {
      yield "chunk";
    };
    setProviders([streamable]);
    reserveMock.mockClear();
    releaseMock.mockClear();
    const iterable = await generateAIStream(
      { task, messages: [] },
      { userId: "u1", dedupKey: "s1" },
    );
    const chunks: string[] = [];
    for await (const c of iterable) chunks.push(c);
    expect(chunks).toEqual(["chunk"]);
    // Reserved exactly once at stream start. On SUCCESS the reservation is
    // consumed (like generateAIResponse) — not released.
    expect(reserveMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it("releases the budget reservation when a stream fails mid-flight", async () => {
    const streamable = fakeProvider("groq", 10, "ok");
    streamable.stream = async function* () {
      yield "partial";
      throw new AIError("server_error", "stream broke", { providerId: "groq" });
    };
    setProviders([streamable]);
    reserveMock.mockClear();
    releaseMock.mockClear();
    const iterable = await generateAIStream(
      { task, messages: [] },
      { userId: "u1", dedupKey: "s1" },
    );
    const chunks: string[] = [];
    await expect(async () => {
      for await (const c of iterable) chunks.push(c);
    }).rejects.toThrow("stream broke");
    expect(chunks).toEqual(["partial"]);
    // Failed request rolls back its slot (mirrors generateAIResponse).
    expect(releaseMock).toHaveBeenCalledWith("u1");
  });

  it("rejects a duplicate stream (dedup before dispatch) without reserving budget", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const streamable = fakeProvider("groq", 10, "ok");
    streamable.stream = async function* () {
      await gate;
      yield "x";
    };
    setProviders([streamable]);
    reserveMock.mockClear();
    const first = generateAIStream(
      { task, messages: [] },
      { userId: "u1", dedupKey: "s2" },
    );
    const second = generateAIStream(
      { task, messages: [] },
      { userId: "u1", dedupKey: "s2" },
    );
    await expect(second).rejects.toThrow("already in progress");
    // Only the first reserved (duplicate rejected before budget).
    expect(reserveMock).toHaveBeenCalledTimes(1);
    release!();
    const it = await first;
    const chunks: string[] = [];
    for await (const c of it) chunks.push(c);
    expect(chunks).toEqual(["x"]);
  });

  it("rejects over-budget stream before dispatch (no provider call)", async () => {
    reserveMock.mockResolvedValue({ allowed: false, reason: "daily" });
    setProviders([fakeProvider("groq", 10, "ok")]);
    await expect(
      generateAIStream({ task, messages: [] }, { userId: "u1" }),
    ).rejects.toThrow("AI usage limit");
  });
});

// ---- Quota deprioritization + recovery ----------------------------
describe("quota-aware deprioritization", () => {
  it("puts a quota'd provider on cooldown so the next provider is used", async () => {
    setProviders([
      fakeProvider("groq", 10, "quota"),
      fakeProvider("gemini", 20, "ok"),
    ]);
    // First request: groq quota-fails → gemini succeeds.
    await expect(generateAIResponse({ task, messages: [] })).resolves.toBe("reply from gemini");
    // groq should now be in cooldown.
    expect(await isCooldown("groq")).toBe(true);
  });

  it("recovers after cooldown clears", async () => {
    setProviders([
      fakeProvider("groq", 10, "ok"),
      fakeProvider("gemini", 20, "ok"),
    ]);
    recordFailure("groq", "quota"); // e.g. 120s cooldown
    expect(await isCooldown("groq")).toBe(true);
    recordSuccess("groq", 150); // a later success marks recovery
    expect(await isCooldown("groq")).toBe(false);
    // Provider is routable again.
    await expect(generateAIResponse({ task, messages: [] })).resolves.toBe("reply from groq");
  });
});

// ---- Streaming fallback --------------------------------------------
describe("generateAIStream", () => {
  it("falls back to a non-streamed response when no provider streams", async () => {
    const streamless = fakeProvider("groq", 10, "ok");
    delete streamless.stream;
    setProviders([streamless]);
    const iterable = await generateAIStream({ task, messages: [] });
    const chunks: string[] = [];
    for await (const c of iterable) chunks.push(c);
    expect(chunks.join("")).toBe("reply from groq");
  });
});
