import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  canUserStartInterview,
  consumeFreeInterview,
  getUsageStatus,
} from "@/lib/usage";
import { PRO_FAIR_USE_LIMIT } from "@/lib/pricing";

// In-memory stand-in for Postgres, keyed by the same columns the real RLS
// policies expose to the owner: profiles (read+update own row), subscriptions
// (read own), interviews (read own). Modeled as a small fluent query builder so
// the functions under test exercise their real chaining (select/eq/maybeSingle/
// update/order/count).
const state = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  class Store {
    rows = new Map<string, Row>();
  }
  const stores: Record<string, Store> = {
    profiles: new Store(),
    subscriptions: new Store(),
    interviews: new Store(),
    other: new Store(),
  };
  const table = (name: string) => (stores[name] ? name : "other");

  const builder = (name: string) => {
    const store = stores[table(name)];
    let filters: Array<(r: Row) => boolean> = [];
    let headMode = false;
    let pendingUpdate: Row | null = null;

    const matched = () =>
      [...store.rows.values()].filter((r) => filters.every((f) => f(r)));

    const chain = {
      select(_cols?: unknown, opts?: { head?: boolean }): any {
        headMode = opts?.head === true;
        return chain;
      },
      eq(col: string, val: unknown): any {
        // `.update(vals).eq(...)` resolves the mutation at the final .eq().
        if (pendingUpdate) {
          for (const r of matched()) Object.assign(r, pendingUpdate);
          pendingUpdate = null;
          return Promise.resolve({ data: null, error: null });
        }
        filters.push((r) => r[col] === val);
        return chain;
      },
      order(): any {
        return chain;
      },
      limit(): any {
        return chain;
      },
      update(values: Row): any {
        pendingUpdate = values;
        return chain;
      },
      insert(): any {
        return { eq: () => Promise.resolve({ error: null }) };
      },
      async maybeSingle() {
        const rows = matched();
        return { data: rows[0] ?? null, error: null };
      },
      async single() {
        const rows = matched();
        return { data: rows[0] ?? null, error: null };
      },
      // Thenable so `await .select("id", { head: true }).eq().eq()` yields
      // `{ count }` without requiring a separate count() method.
      async then(resolve: (v: unknown) => void) {
        resolve(headMode ? { count: matched().length } : { data: null, error: null });
      },
    };
    return chain;
  };

  const createFakeClient = () => ({ from: (name: string) => builder(name) });
  const clear = () => {
    for (const s of Object.values(stores)) s.rows.clear();
  };
  return { stores, createFakeClient, clear };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.createFakeClient(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client never used without SUPABASE_SERVICE_ROLE_KEY");
  },
}));
vi.mock("@/lib/redis", () => ({ getRedis: async () => null }));

const seedProfile = (userId: string, row: Record<string, unknown>) => {
  state.stores.profiles.rows.set(userId, row);
};
const seedSubscription = (userId: string, row: Record<string, unknown>) => {
  state.stores.subscriptions.rows.set(userId, row);
};
const seedInterview = (id: string, row: Record<string, unknown>) => {
  state.stores.interviews.rows.set(id, row);
};

beforeEach(() => {
  state.clear();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  state.clear();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("getUsageStatus — free quota (3 interviews)", () => {
  it("fresh account: 0 used, 3 remaining, can start", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 0 });
    const s = await getUsageStatus("u1");
    expect(s.freeInterviewsUsed).toBe(0);
    expect(s.freeInterviewsRemaining).toBe(3);
    expect(s.freeInterviewLimit).toBe(3);
    expect(s.canStartInterview).toBe(true);
  });

  it("legacy boolean true maps to 1 used credit (2 remaining)", async () => {
    seedProfile("u1", { id: "u1", free_interview_used: true });
    const s = await getUsageStatus("u1");
    expect(s.freeInterviewsUsed).toBe(1);
    expect(s.freeInterviewsRemaining).toBe(2);
    expect(s.canStartInterview).toBe(true);
  });

  it("all 3 used: cannot start another free interview", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 3 });
    const s = await getUsageStatus("u1");
    expect(s.freeInterviewsUsed).toBe(3);
    expect(s.freeInterviewsRemaining).toBe(0);
    expect(s.canStartInterview).toBe(false);
  });

  it("premium can start regardless of free quota", async () => {
    seedProfile("u1", {
      id: "u1",
      free_interviews_used: 3,
      is_premium: true,
    });
    const s = await getUsageStatus("u1");
    expect(s.isPremium).toBe(true);
    expect(s.canStartInterview).toBe(true);
  });
});

describe("consumeFreeInterview — completion-only counter", () => {
  it("increments the counter for a completed interview", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 0 });
    seedInterview("i1", { id: "i1", status: "completed" });
    await consumeFreeInterview("u1", "i1");
    expect(state.stores.profiles.rows.get("u1")).toMatchObject({
      free_interviews_used: 1,
    });
  });

  it("does not count an interview that is not completed", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 0 });
    seedInterview("i1", { id: "i1", status: "in_progress" });
    await consumeFreeInterview("u1", "i1");
    expect(state.stores.profiles.rows.get("u1")).toMatchObject({
      free_interviews_used: 0,
    });
  });

  it("caps at the free limit (3) on repeated consumption", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 3 });
    seedInterview("i1", { id: "i1", status: "completed" });
    await consumeFreeInterview("u1", "i1");
    expect(state.stores.profiles.rows.get("u1")).toMatchObject({
      free_interviews_used: 3,
    });
  });

  it("migrates a legacy boolean account to 1 before counting", async () => {
    seedProfile("u1", { id: "u1", free_interview_used: true });
    seedInterview("i1", { id: "i1", status: "completed" });
    await consumeFreeInterview("u1", "i1");
    expect(state.stores.profiles.rows.get("u1")).toMatchObject({
      free_interviews_used: 2,
    });
  });

  it("counts two distinct completed interviews sequentially", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 0 });
    seedInterview("i1", { id: "i1", status: "completed" });
    seedInterview("i2", { id: "i2", status: "completed" });
    await consumeFreeInterview("u1", "i1");
    await consumeFreeInterview("u1", "i2");
    expect(state.stores.profiles.rows.get("u1")).toMatchObject({
      free_interviews_used: 2,
    });
  });
});

describe("canUserStartInterview", () => {
  it("free user with remaining credits can start", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 1 });
    expect(await canUserStartInterview("u1")).toEqual({ allowed: true });
  });

  it("free user at limit with no in-progress is blocked with reason", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 3 });
    const res = await canUserStartInterview("u1");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("free_interview_used");
  });

  it("free user at limit with an in-progress interview gets re-entry target", async () => {
    seedProfile("u1", { id: "u1", free_interviews_used: 3 });
    seedInterview("ip", {
      id: "ip",
      user_id: "u1",
      status: "in_progress",
    });
    const res = await canUserStartInterview("u1");
    expect(res).toEqual({
      allowed: false,
      reason: "has_in_progress",
      interviewId: "ip",
    });
  });

  it("premium user is allowed below fair-use", async () => {
    seedProfile("u1", {
      id: "u1",
      free_interviews_used: 3,
      is_premium: true,
    });
    expect(await canUserStartInterview("u1")).toEqual({ allowed: true });
  });

  it("premium user at PRO_FAIR_USE_LIMIT completed interviews is blocked", async () => {
    seedProfile("u1", {
      id: "u1",
      free_interviews_used: 3,
      is_premium: true,
    });
    for (let i = 0; i < PRO_FAIR_USE_LIMIT; i++) {
      seedInterview(`u1-c${i}`, {
        id: `u1-c${i}`,
        user_id: "u1",
        status: "completed",
      });
    }
    const res = await canUserStartInterview("u1");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("fair_use_limit");
  });
});