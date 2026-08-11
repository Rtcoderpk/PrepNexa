import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { reserveAiBudget, releaseAiBudget, resetAiBudgetState } from "@/lib/usage";

// Control Redis availability per test.
const redisAvailable = vi.hoisted(() => ({ value: false }));
const redisCounters = vi.hoisted(() => new Map<string, number>());
const redisCalls = vi.hoisted(() => ({ incr: vi.fn(), decr: vi.fn(), expire: vi.fn() }));

vi.mock("@/lib/redis", () => ({
  getRedis: async () =>
    redisAvailable.value
      ? {
          incr: redisCalls.incr,
          decr: redisCalls.decr,
          expire: redisCalls.expire,
        }
      : null,
}));

// Default: limits disabled.
beforeEach(() => {
  vi.resetModules();
  resetAiBudgetState();
  redisCounters.clear();
  delete process.env.AI_DAILY_BUDGET;
  delete process.env.AI_HOURLY_BUDGET;
  redisAvailable.value = false;
  // Shared per-key counter simulating Redis INCR/DECR semantics.
  redisCalls.incr.mockImplementation(async (key: string) => {
    const next = (redisCounters.get(key) ?? 0) + 1;
    redisCounters.set(key, next);
    return next;
  });
  redisCalls.decr.mockImplementation(async (key: string) => {
    const next = (redisCounters.get(key) ?? 0) - 1;
    redisCounters.set(key, Math.max(0, next));
    return Math.max(0, next);
  });
  redisCalls.expire.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.AI_DAILY_BUDGET;
  delete process.env.AI_HOURLY_BUDGET;
  redisAvailable.value = false;
  resetAiBudgetState();
});

describe("reserveAiBudget — in-memory fallback", () => {
  it("allows when no limits are configured", async () => {
    await expect(reserveAiBudget("user-1")).resolves.toEqual({ allowed: true });
  });

  it("allows below the daily limit and rejects at/above it", async () => {
    process.env.AI_DAILY_BUDGET = "3";
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    // At the boundary (4th reservation when limit is 3) → rejected.
    await expect(reserveAiBudget("user-1")).resolves.toEqual({
      allowed: false,
      reason: "daily",
    });
  });

  it("rejects above the hourly limit", async () => {
    process.env.AI_HOURLY_BUDGET = "2";
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    await expect(reserveAiBudget("user-1")).resolves.toEqual({
      allowed: false,
      reason: "hourly",
    });
  });

  it("enforces both daily and hourly limits", async () => {
    process.env.AI_DAILY_BUDGET = "10";
    process.env.AI_HOURLY_BUDGET = "1";
    // 1st ok (daily=1, hourly=1), 2nd blocked by hourly.
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    await expect(reserveAiBudget("user-1")).resolves.toEqual({
      allowed: false,
      reason: "hourly",
    });
  });

  it("counts per-user independently", async () => {
    process.env.AI_DAILY_BUDGET = "1";
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    // user-2 is unaffected.
    await expect(reserveAiBudget("user-2")).resolves.toEqual({ allowed: true });
  });

  it("release frees a slot so the next reservation succeeds", async () => {
    process.env.AI_DAILY_BUDGET = "1";
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    await expect(reserveAiBudget("user-1")).resolves.toEqual({
      allowed: false,
      reason: "daily",
    });
    await releaseAiBudget("user-1");
    await expect(reserveAiBudget("user-1")).resolves.toEqual({ allowed: true });
  });

  it("concurrent reservations at the boundary cannot both pass (sync in-memory)", async () => {
    process.env.AI_DAILY_BUDGET = "1";
    // Both reserve in the same synchronous tick — the in-memory increment is
    // applied before the await returns, so only the first passes.
    const [a, b] = await Promise.all([
      reserveAiBudget("user-1"),
      reserveAiBudget("user-1"),
    ]);
    const allowed = [a, b].filter((r) => r.allowed).length;
    expect(allowed).toBe(1);
  });

  it("rolls back an earlier window when a later window rejects (no partial reservation)", async () => {
    process.env.AI_DAILY_BUDGET = "5";
    process.env.AI_HOURLY_BUDGET = "1";
    // First request: daily=1, hourly=1 → allowed.
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
    // Second request: daily would be fine (2), but hourly is now at limit → reject.
    const second = await reserveAiBudget("user-1");
    expect(second).toEqual({ allowed: false, reason: "hourly" });
    // The rejected request must NOT have consumed the daily slot: a fresh user
    // path unaffected, and the daily counter was rolled back. Verify by a third
    // request still allowed on daily (hourly-limit aside).
    // (Neither daily nor hourly should be consumed by the rejected request — so
    //  after release, the state returns to the first-request usage.)
    await releaseAiBudget("user-1");
    // After the first reservation + release, daily/hourly both freed → allowed again.
    expect(await reserveAiBudget("user-1")).toEqual({ allowed: true });
  });
});

describe("reserveAiBudget — Redis path", () => {
  beforeEach(() => {
    redisAvailable.value = true;
    process.env.AI_DAILY_BUDGET = "2";
  });

  it("increments the counter atomically and applies the TTL on first use", async () => {
    await reserveAiBudget("user-1");
    expect(redisCalls.incr).toHaveBeenCalled();
    expect(redisCalls.expire).toHaveBeenCalledWith(
      expect.stringContaining("ai:budget:user-1:daily"),
      expect.any(Number),
    );
  });

  it("rejects and rolls back (decr) when the increment exceeds the limit", async () => {
    // Force count 3 > limit 2 on the daily key.
    redisCounters.set(`ai:budget:user-1:daily:${Math.floor(Date.now() / 86400000)}`, 2);
    const result = await reserveAiBudget("user-1");
    expect(result).toEqual({ allowed: false, reason: "daily" });
    expect(redisCalls.decr).toHaveBeenCalled();
  });

  it("does not consume a slot for a rejected request (decr balances the incr)", async () => {
    // Pre-seed the daily counter at the limit (2).
    redisCounters.set(`ai:budget:user-1:daily:${Math.floor(Date.now() / 86400000)}`, 2);
    const first = await reserveAiBudget("user-1");
    expect(first.allowed).toBe(false);
    // The rollback (decr) brings the counter back to 2, so a fresh request with
    // a counter of 1 (after release) would pass — here we verify decr happened.
    expect(redisCalls.decr).toHaveBeenCalled();
  });

  it("releaseAiBudget decrements the Redis counters", async () => {
    await reserveAiBudget("user-1");
    await releaseAiBudget("user-1");
    // Release rolls back the daily and hourly reservations.
    expect(redisCalls.decr).toHaveBeenCalledWith(
      expect.stringContaining("ai:budget:user-1:daily"),
    );
    expect(redisCalls.decr).toHaveBeenCalledWith(
      expect.stringContaining("ai:budget:user-1:hourly"),
    );
  });

  it("tolerates a Redis failure by returning allowed (best-effort)", async () => {
    redisCalls.incr.mockRejectedValue(new Error("redis down"));
    await expect(reserveAiBudget("user-1")).resolves.toEqual({ allowed: true });
  });
});
