import { describe, expect, it, vi, beforeEach } from "vitest";
import { evaluateAnswer, toTenScale } from "@/services/semantic-eval";

// Shared fake provider returned by every createLLMProvider() call so tests can
// inspect/override the response evaluateAnswer receives.
const chatMock = vi.fn().mockResolvedValue(
  JSON.stringify({ score: 0.8, reason: "Clear and technically correct." }),
);

vi.mock("@/services/llm/provider", () => ({
  createLLMProvider: () => ({
    chat: chatMock,
    embed: vi.fn(),
    ping: vi.fn(),
  }),
}));

describe("evaluateAnswer", () => {
  beforeEach(() => {
    chatMock.mockReset();
    chatMock.mockResolvedValue(
      JSON.stringify({ score: 0.8, reason: "Clear and technically correct." }),
    );
  });

  it("returns the LLM judgment as the blended score", async () => {
    const result = await evaluateAnswer({
      question: "Explain SQL joins",
      answer: "A join combines rows...",
    });

    expect(result.llmScore).toBe(0.8);
    expect(result.blendedScore).toBe(0.8);
    expect(result.offline).toBe(false);
  });

  it("degrades gracefully (offline) when the LLM call fails", async () => {
    chatMock.mockRejectedValue(new Error("provider down"));
    const result = await evaluateAnswer({ question: "Q", answer: "A" });

    expect(result.offline).toBe(true);
    expect(result.llmScore).toBe(0);
    expect(result.blendedScore).toBe(0);
  });

  it("parses LLM output wrapped in extra text", async () => {
    chatMock.mockResolvedValue(
      'Here you go:\n```json\n{"score": 0.6, "reason": "Solid answer."}\n```\nHope that helps!',
    );
    const result = await evaluateAnswer({ question: "Q", answer: "A" });
    expect(result.llmScore).toBe(0.6);
    expect(result.feedback).toBe("Solid answer.");
  });

  it("clamps out-of-range LLM scores", async () => {
    chatMock.mockResolvedValue(JSON.stringify({ score: 5, reason: "bad range" }));
    const result = await evaluateAnswer({ question: "Q", answer: "A" });
    expect(result.llmScore).toBe(1);
  });

  it("uses default feedback when the LLM omits a reason", async () => {
    chatMock.mockResolvedValue(JSON.stringify({ score: 0.5 }));
    const result = await evaluateAnswer({ question: "Q", answer: "A" });
    expect(result.feedback).toBe("No detailed feedback available.");
  });
});

describe("toTenScale", () => {
  it("maps 0-1 score to 0-10 integer", () => {
    expect(toTenScale(0.8)).toBe(8);
    expect(toTenScale(0.0)).toBe(0);
    expect(toTenScale(1.0)).toBe(10);
    expect(toTenScale(0.95)).toBe(10); // rounds up
  });
});
