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

function scoringClient(cosine: number) {
  return {
    semanticScore: vi.fn().mockResolvedValue({ cosine, semanticScore: cosine }),
  };
}

describe("evaluateAnswer", () => {
  beforeEach(() => {
    chatMock.mockReset();
    chatMock.mockResolvedValue(
      JSON.stringify({ score: 0.8, reason: "Clear and technically correct." }),
    );
  });

  it("blends cosine and LLM judgment when pythonai is online", async () => {
    const client = scoringClient(0.9);
    const result = await evaluateAnswer(
      { question: "Explain SQL joins", answer: "A join combines rows..." },
      client,
    );

    expect(client.semanticScore).toHaveBeenCalledTimes(1);
    expect(result.cosineScore).toBe(0.9);
    expect(result.llmScore).toBe(0.8);
    // 0.35 * 0.9 + 0.65 * 0.8 = 0.315 + 0.52 = 0.835
    expect(result.blendedScore).toBeCloseTo(0.835, 3);
    expect(result.offline).toBe(false);
  });

  it("falls back to LLM-only when pythonai is offline", async () => {
    const client = {
      semanticScore: vi.fn().mockRejectedValue(new Error("down")),
    };
    const result = await evaluateAnswer(
      { question: "Q", answer: "A" },
      client,
    );

    expect(result.offline).toBe(true);
    expect(result.cosineScore).toBe(0);
    expect(result.blendedScore).toBe(result.llmScore);
  });

  it("parses LLM output wrapped in extra text", async () => {
    chatMock.mockResolvedValue(
      'Here you go:\n```json\n{"score": 0.6, "reason": "Solid answer."}\n```\nHope that helps!',
    );
    const result = await evaluateAnswer(
      { question: "Q", answer: "A" },
      scoringClient(0.5),
    );
    expect(result.llmScore).toBe(0.6);
    expect(result.feedback).toBe("Solid answer.");
  });

  it("clamps out-of-range LLM scores", async () => {
    chatMock.mockResolvedValue(JSON.stringify({ score: 5, reason: "bad range" }));
    const result = await evaluateAnswer(
      { question: "Q", answer: "A" },
      scoringClient(0.5),
    );
    expect(result.llmScore).toBe(1);
  });

  it("uses default feedback when the LLM omits a reason", async () => {
    chatMock.mockResolvedValue(JSON.stringify({ score: 0.5 }));
    const result = await evaluateAnswer(
      { question: "Q", answer: "A" },
      scoringClient(0.5),
    );
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
