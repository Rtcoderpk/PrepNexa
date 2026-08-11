import { describe, expect, it, vi, beforeEach } from "vitest";
import { AIError, AI_BUDGET_LIMIT_MESSAGE } from "@/lib/ai/ai-types";
import {
  friendlyAIErrorMessage,
  isBudgetLimitError,
  aiErrorPayload,
} from "@/lib/ai/friendly-errors";

// Lifted so vi.doMock can reference it from a top-level module scope.
const reserveMock = vi.hoisted(() => vi.fn());
const testProviders = vi.hoisted<Array<{ id: string; priority: number }>>(() => []);

// ---- P8-A: friendlyAIErrorMessage / central classification -------------
describe("friendlyAIErrorMessage (P8-A)", () => {
  it("keeps the budget-limit error identifiable (machine-readable kind)", () => {
    const err = new AIError("budget_limit", AI_BUDGET_LIMIT_MESSAGE);
    expect(isBudgetLimitError(err)).toBe(true);
    expect(err.kind).toBe("budget_limit");
  });

  it("returns the specific friendly budget message (not the generic busy copy)", () => {
    const err = new AIError("budget_limit", AI_BUDGET_LIMIT_MESSAGE);
    const msg = friendlyAIErrorMessage(err);
    expect(msg).toBe(AI_BUDGET_LIMIT_MESSAGE);
    expect(msg).not.toContain("temporarily busy");
    // Must stay stable so the client's string-match keeps working.
    expect(msg).toContain("AI usage limit");
  });

  it("never exposes raw provider details for a budget error", () => {
    const err = new AIError("budget_limit", AI_BUDGET_LIMIT_MESSAGE, {
      providerId: "secret-provider",
    });
    const msg = friendlyAIErrorMessage(err);
    expect(msg).not.toContain("secret-provider");
    expect(msg).not.toContain(err.name);
  });

  it("keeps OTHER provider errors on the generic busy message (no weakening)", () => {
    for (const kind of ["timeout", "rate_limited", "server_error", "quota", "unreachable"] as const) {
      const err = new AIError(kind, `raw ${kind}`);
      const msg = friendlyAIErrorMessage(err);
      expect(msg).toBe("AI is temporarily busy. We're automatically switching to another AI engine.");
      expect(msg).not.toContain("raw");
      expect(isBudgetLimitError(err)).toBe(false);
    }
  });

  it("does not treat config/auth/internal errors as budget errors", () => {
    const configErr = new AIError("config", "no key");
    expect(isBudgetLimitError(configErr)).toBe(false);
    expect(friendlyAIErrorMessage(configErr)).toBe("AI is temporarily busy. We're automatically switching to another AI engine.");
  });

  it("passes non-AI application errors through unchanged", () => {
    expect(friendlyAIErrorMessage(new Error("Interview not found"))).toBe("Interview not found");
    expect(isBudgetLimitError(new Error("Interview not found"))).toBe(false);
  });
});

// ---- P8: aiErrorPayload — the route-level server->client contract ------
describe("aiErrorPayload (P8)", () => {
  it("budget error => { error: friendly, budgetLimit: true }", () => {
    const err = new AIError("budget_limit", AI_BUDGET_LIMIT_MESSAGE);
    const payload = aiErrorPayload(err);
    expect(payload.budgetLimit).toBe(true);
    expect(payload.error).toBe(AI_BUDGET_LIMIT_MESSAGE);
  });

  it("generic provider error => { error: friendly, budgetLimit: undefined }", () => {
    const err = new AIError("timeout", "raw timeout");
    const payload = aiErrorPayload(err);
    expect(payload.budgetLimit).toBeUndefined();
    expect(payload.error).toContain("temporarily busy");
  });
});

// ---- P8-B/C/D: the router throws kind=budget_limit on budget rejection ----
describe("router budget rejection kind (P8-B/C/D)", () => {
  beforeEach(() => {
    vi.resetModules();
    testProviders.length = 0;
    reserveMock.mockReset().mockResolvedValue({ allowed: true });
  });

  it("generateAIResponse throws budget_limit when reserveAiBudget is denied", async () => {
    vi.doMock("@/lib/usage", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/usage")>();
      return {
        ...actual,
        reserveAiBudget: reserveMock,
        releaseAiBudget: async () => {},
        logAiUsage: async () => {},
        persistProviderHealth: async () => {},
      };
    });
    vi.doMock("@/lib/ai/providers", () => ({ createProviders: () => testProviders }));
    vi.doMock("@/lib/redis", () => ({ getRedis: async () => null }));

    const { generateAIResponse } = await import("@/lib/ai/ai-router");
    reserveMock.mockResolvedValue({ allowed: false, reason: "daily" });

    await expect(
      generateAIResponse({ task: "interview_question", messages: [] }, { userId: "u-1" }),
    ).rejects.toMatchObject({ kind: "budget_limit" });
  });

  it("generateAIStream throws budget_limit when reserveAiBudget is denied", async () => {
    vi.doMock("@/lib/usage", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/usage")>();
      return {
        ...actual,
        reserveAiBudget: reserveMock,
        releaseAiBudget: async () => {},
        logAiUsage: async () => {},
        persistProviderHealth: async () => {},
      };
    });
    vi.doMock("@/lib/ai/providers", () => ({ createProviders: () => testProviders }));
    vi.doMock("@/lib/redis", () => ({ getRedis: async () => null }));

    const { generateAIStream } = await import("@/lib/ai/ai-router");
    reserveMock.mockResolvedValue({ allowed: false, reason: "daily" });

    await expect(
      generateAIStream({ task: "interview_question", messages: [] }, { userId: "u-1" }),
    ).rejects.toMatchObject({ kind: "budget_limit" });
  });
});
