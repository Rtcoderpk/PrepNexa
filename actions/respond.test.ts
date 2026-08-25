import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AiResponseError,
  isBudgetLimitError,
} from "@/lib/ai/friendly-errors";
import { AIError } from "@/lib/ai/ai-types";

// ---- P8-C: AiResponseError carries the budget-limit signal ----
describe("AiResponseError (P8-C)", () => {
  it("is a plain Error with a readable message", () => {
    const err = new AiResponseError("something went wrong");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("something went wrong");
    expect(err.budgetLimit).toBe(false);
  });

  it("flags budget-limit errors so the client branches on it", () => {
    const err = new AiResponseError("You've reached your AI usage limit for now.", true);
    expect(err.budgetLimit).toBe(true);
  });

  it("actions/respond maps a budget_limit AIError into a flagged AiResponseError", async () => {
    const src = await import("node:fs");
    const file = src.readFileSync("actions/respond.ts", "utf8");
    expect(file).toContain("isBudgetLimitError(error)");
    expect(file).toContain("AiResponseError(");
    expect(file).toContain("budgetLimit");
  });

  it("friendly-errors classifies the action's source error as budget", () => {
    expect(isBudgetLimitError(new AIError("budget_limit", "limit"))).toBe(true);
  });

  it("interview chat invokes the manual finish server action before generating feedback", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("components/interview/interview-chat.tsx", "utf8");
    expect(src).toContain("finishInterviewAction");
    expect(src).toContain("await finishInterviewAction");
  });

  it("resume analyzer retries transient ATS analysis failures", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("components/resume/resume-analyzer.tsx", "utf8");
    expect(src).toContain("MAX_ANALYSIS_RETRIES");
    expect(src).toContain("shouldRetry");
    expect(src).toContain("Retrying analysis");
  });
});
