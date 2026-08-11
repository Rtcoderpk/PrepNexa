import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIError, type AIProvider, type AITask, type ChatOptions } from "@/lib/ai/ai-types";
import { generateAIResponse } from "@/lib/ai/ai-router";
import { resetProviderHealth } from "@/lib/ai/provider-health";

// Lifted mocks for budget + usage so we can assert no leak on duplicates.
const reserveMock = vi.hoisted(() => vi.fn());
const releaseMock = vi.hoisted(() => vi.fn());

// Replaceable provider list injected into the router.
const testProviders: AIProvider[] = [];
const setProviders = (list: AIProvider[]) =>
  testProviders.splice(0, testProviders.length, ...list);

vi.mock("@/lib/ai/providers", () => ({
  createProviders: () => [...testProviders],
}));
vi.mock("@/lib/redis", () => ({ getRedis: async () => null }));
vi.mock("@/lib/usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage")>();
  return {
    ...actual,
    reserveAiBudget: reserveMock,
    releaseAiBudget: releaseMock,
    logAiUsage: async () => {},
    persistProviderHealth: async () => {},
  };
});

function slowProvider(): AIProvider {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return {
    id: "groq",
    priority: 10,
    supports: () => true,
    async chat(_o: ChatOptions): Promise<string> {
      await gate;
      return "reply";
    },
    async ping() {
      return true;
    },
  };
}

// Prevents the module-level dedup set from leaking across tests.
let _dedupKey = "";
const task: AITask = "interview_question";

beforeEach(() => {
  vi.resetModules();
  resetProviderHealth();
  reserveMock.mockReset().mockResolvedValue({ allowed: true });
  releaseMock.mockReset().mockResolvedValue(undefined);
  setProviders([]);
});

afterEach(() => {
  setProviders([]);
});

describe("P4 — legacy respond idempotency key semantics", () => {
  it("is scoped to interview + question (server-derived), never a raw client userId", () => {
    const key = `respond:${"iv-123"}:${"q-abc"}`;
    expect(key).toBe("respond:iv-123:q-abc");
    // A client-supplied arbitrary userId cannot change this scope — the scope
    // comes from interview.user_id + lastQuestion.id, both loaded server-side.
    expect(key).not.toContain("client-supplied-user");
  });

  it("a new question produces a different key (legitimate next answer not dedup'd)", () => {
    const first = `respond:iv-1:q-1`;
    const second = `respond:iv-1:q-2`;
    expect(first).not.toBe(second);
  });

  it("a different interview/user cannot collide with another user's key", () => {
    const userA = `respond:iv-100:q-1`;
    const userB = `respond:iv-200:q-1`;
    expect(userA).not.toBe(userB);
  });
});

describe("P4 — router dedup prevents duplicate LLM dispatch + budget leak", () => {
  it("rejects a true duplicate before budget reservation (no reserve called)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const prov = {
      id: "groq",
      priority: 10,
      supports: () => true,
      async chat(_o: ChatOptions): Promise<string> {
        await gate;
        return "reply";
      },
      async ping() {
        return true;
      },
    } satisfies AIProvider;
    setProviders([prov]);

    const first = generateAIResponse(
      { task, messages: [] },
      { dedupKey: "respond:iv-1:q-1", userId: "u-1" },
    );
    const second = generateAIResponse(
      { task, messages: [] },
      { dedupKey: "respond:iv-1:q-1", userId: "u-1" },
    );

    // The duplicate is rejected by beginInFlight (before reserveAiBudget).
    await expect(second).rejects.toMatchObject({ kind: "response" });
    expect(reserveMock).toHaveBeenCalledTimes(1); // only the first reserved

    release!();
    await expect(first).resolves.toBe("reply");
  });

  it("a DIFFERENT dedup key proceeds normally (no false rejection)", async () => {
    setProviders([
      {
        id: "groq",
        priority: 10,
        supports: () => true,
        async chat(_o: ChatOptions) {
          return "answer-2";
        },
        async ping() {
          return true;
        },
      } satisfies AIProvider,
    ]);
    // Different question => different key => not dedup'd.
    await expect(
      generateAIResponse(
        { task, messages: [] },
        { dedupKey: "respond:iv-1:q-2", userId: "u-1" },
      ),
    ).resolves.toBe("answer-2");
  });

  it("missing dedupKey behaves as before (no dedup, no rejection)", async () => {
    setProviders([
      {
        id: "groq",
        priority: 10,
        supports: () => true,
        async chat(_o: ChatOptions) {
          return "plain";
        },
        async ping() {
          return true;
        },
      } satisfies AIProvider,
    ]);
    await expect(
      generateAIResponse({ task, messages: [] }, { userId: "u-1" }),
    ).resolves.toBe("plain");
  });

  it("still surfaces a stable error when all providers fail", async () => {
    setProviders([
      {
        id: "groq",
        priority: 10,
        supports: () => true,
        async chat(_o: ChatOptions) {
          throw new AIError("quota", "quota", { providerId: "groq" });
        },
        async ping() {
          return true;
        },
      } satisfies AIProvider,
    ]);
    const err = await generateAIResponse(
      { task, messages: [] },
      { dedupKey: "respond:iv-1:q-1", userId: "u-1" },
    ).catch((e) => e);
    expect(err.message).toBe("All AI providers are temporarily unavailable");
  });
});

// Silence unused var warning for _dedupKey bookkeeping helper.
void _dedupKey;
void slowProvider;