import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Control Redis availability/behaviour per test.
const redisConfigured = vi.hoisted(() => ({ value: false }));
const redisCounters = vi.hoisted(() => new Map<string, number>());
const redisCalls = vi.hoisted(() => ({ incr: vi.fn(), expire: vi.fn() }));

vi.mock("@/lib/redis", () => ({
  getRedis: async () =>
    redisConfigured.value
      ? { incr: redisCalls.incr, expire: redisCalls.expire }
      : null,
}));

// Re-import the rate-limit module after stubbing env so the frozen `env`
// singleton (lib/env.ts) picks up the store selection.
async function loadRateLimit() {
  return import("@/lib/rate-limit");
}

// Reset module state + env before each test.
beforeEach(() => {
  vi.resetModules();
  redisCounters.clear();
  redisConfigured.value = false;
  delete process.env.RATE_LIMIT_STORE;
  redisCalls.incr.mockReset();
  redisCalls.expire.mockReset().mockResolvedValue(undefined);
  redisCalls.incr.mockImplementation(async (key: string) => {
    const next = (redisCounters.get(key) ?? 0) + 1;
    redisCounters.set(key, next);
    return next;
  });
});

afterEach(() => {
  delete process.env.RATE_LIMIT_STORE;
  redisConfigured.value = false;
  vi.unstubAllEnvs();
});

describe("rateLimitAsync — memory store (default)", () => {
  it("allows within the limit", async () => {
    const { rateLimitAsync } = await loadRateLimit();
    for (let i = 0; i < 3; i++) {
      await expect(rateLimitAsync("k", 3)).resolves.toBe(true);
    }
  });

  it("rejects once the limit is reached", async () => {
    const { rateLimitAsync } = await loadRateLimit();
    for (let i = 0; i < 3; i++) {
      await rateLimitAsync("k", 3);
    }
    await expect(rateLimitAsync("k", 3)).resolves.toBe(false);
  });

  it("counts keys independently", async () => {
    const { rateLimitAsync } = await loadRateLimit();
    await rateLimitAsync("user-a", 1);
    await expect(rateLimitAsync("user-b", 1)).resolves.toBe(true);
  });

  it("does NOT call Redis when RATE_LIMIT_STORE is unset", async () => {
    const { rateLimitAsync } = await loadRateLimit();
    await rateLimitAsync("k", 5);
    expect(redisCalls.incr).not.toHaveBeenCalled();
  });
});

describe("rateLimitAsync — Redis-backed store", () => {
  function stubRedisEnv(): void {
    redisConfigured.value = true;
    vi.stubEnv("RATE_LIMIT_STORE", "redis");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  }

  it("selects Redis INCR when RATE_LIMIT_STORE=redis", async () => {
    stubRedisEnv();
    const { rateLimitAsync } = await loadRateLimit();
    await rateLimitAsync("k", 5);
    expect(redisCalls.incr).toHaveBeenCalled();
  });

  it("applies TTL on the first request", async () => {
    stubRedisEnv();
    const { rateLimitAsync } = await loadRateLimit();
    await rateLimitAsync("k", 5);
    expect(redisCalls.expire).toHaveBeenCalledWith(
      expect.stringContaining("rl:k"),
      expect.any(Number),
    );
  });

  it("rejects at the limit using the shared counter", async () => {
    stubRedisEnv();
    const { rateLimitAsync } = await loadRateLimit();
    for (let i = 0; i < 3; i++) await rateLimitAsync("k", 3);
    await expect(rateLimitAsync("k", 3)).resolves.toBe(false);
  });
});

describe("rateLimit — sync memory (unchanged)", () => {
  it("retains the synchronous memory path", async () => {
    const { rateLimit } = await loadRateLimit();
    expect(rateLimit("k", 2)).toBe(true);
    expect(rateLimit("k", 2)).toBe(true);
    expect(rateLimit("k", 2)).toBe(false);
  });
});

// ---- P7-F3: upload-resume uses rateLimitAsync (multi-instance consistent) ----
describe("upload-resume rate-limit consistency (P7-F3)", () => {
  it("upload-resume route uses rateLimitAsync, not the sync memory limiter", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/upload-resume/route.ts", "utf8");
    expect(src).toContain("rateLimitAsync");
    expect(src).not.toContain("rateLimit(");
    // Same per-user key + default limit preserved.
    expect(src).toContain("rateLimitAsync(`resume:${user.id}`)");
  });
});

// ---- P7-F4: resume routes expose the AI budget-limit signal ----
describe("resume budget-limit flag (P7-F4)", () => {
  it("analyze-upload returns a budgetLimit flag + sanitized error", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/resume/analyze-upload/route.ts", "utf8");
    expect(src).toContain("budgetLimit");
    expect(src).toContain("isAiBudgetLimitError");
    expect(src).toContain("friendlyAIErrorMessage");
  });

  it("job-match returns a budgetLimit flag + sanitized error", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/resume/job-match/route.ts", "utf8");
    expect(src).toContain("budgetLimit");
    expect(src).toContain("isAiBudgetLimitError");
    expect(src).toContain("friendlyAIErrorMessage");
  });
});

// ---- P8-B/C/D: interview routes surface the budget-limit signal ----
describe("interview routes budget-limit signal (P8)", () => {
  it("opening route uses aiErrorPayload (budgetLimit contract) and drops the masking call", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/interview/opening/route.ts", "utf8");
    expect(src).toContain("aiErrorPayload");
    // aiErrorPayload is what produces budgetLimit in the JSON response.
    expect(src).not.toContain("friendlyAIErrorMessage(");
  });

  it("respond route uses aiErrorPayload (budgetLimit contract)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/interview/respond/route.ts", "utf8");
    expect(src).toContain("aiErrorPayload");
    expect(src).not.toContain("friendlyAIErrorMessage(");
  });

  it("feedback route uses aiErrorPayload (budgetLimit contract)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/interview/feedback/route.ts", "utf8");
    expect(src).toContain("aiErrorPayload");
    expect(src).not.toContain("friendlyAIErrorMessage(");
  });
});

// ---- P8-E: the interview client recognizes the budget-limit signal ----
describe("interview client budget UX (P8-E)", () => {
  it("interview-chat detects AiResponseError.budgetLimit for the budget toast", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("components/interview/interview-chat.tsx", "utf8");
    expect(src).toContain("AiResponseError");
    expect(src).toContain("error.budgetLimit");
    expect(src).toContain("isBudgetLimitError(error)");
  });

  it("interview-chat feedback fetch surfaces a budgetLimit-specific toast", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("components/interview/interview-chat.tsx", "utf8");
    expect(src).toContain("data.budgetLimit");
  });
});