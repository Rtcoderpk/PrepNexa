import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateFeedback } from "@/services/feedback";

// Shared fake provider — tests override chatMock to simulate provider responses.
const chatMock = vi.fn();

vi.mock("@/services/llm/provider", () => ({
  createLLMProvider: () => ({
    chat: chatMock,
    embed: vi.fn(),
    ping: vi.fn(),
  }),
}));

// Minimal valid feedback report matching feedbackReportSchema.
function validReport() {
  return {
    overall_score: 8,
    summary: "Strong performance.",
    strengths: ["Clear communication"],
    weaknesses: ["Rushed answers"],
    areas_to_improve: ["Practice STAR"],
    technical_score: 8,
    communication_score: 8,
    confidence_score: 7,
    grammar_score: 9,
    speaking_speed_score: 7,
    eye_contact_score: 8,
    body_language_score: 7,
    star_evaluation: "Good situation-action-detail.",
    hiring_recommendation: "Hire",
    improvement_roadmap: "Practice structuring answers.",
    per_question_notes: [
      {
        question: "Tell me about yourself",
        answer: "I am a backend engineer.",
        score: 8,
        feedback: "Clear and relevant.",
      },
    ],
  };
}

describe("generateFeedback — result parsing (Phase 9)", () => {
  beforeEach(() => {
    chatMock.mockReset();
  });

  it("1. parses valid raw JSON response", async () => {
    chatMock.mockResolvedValue(JSON.stringify(validReport()));
    const report = await generateFeedback({
      role: "Engineer",
      history: [{ role: "user", content: "hello" }],
    });
    expect(report.overall_score).toBe(8);
    expect(report.summary).toBe("Strong performance.");
    expect(report.per_question_notes).toHaveLength(1);
  });

  it("2. parses JSON inside markdown code fences", async () => {
    chatMock.mockResolvedValue("```json\n" + JSON.stringify(validReport()) + "\n```");
    const report = await generateFeedback({
      role: "Engineer",
      history: [{ role: "user", content: "hello" }],
    });
    expect(report.overall_score).toBe(8);
  });

  it("3. parses JSON with harmless surrounding text", async () => {
    chatMock.mockResolvedValue(
      "Here is the report:\n" + JSON.stringify(validReport()) + "\nHope it helps!",
    );
    const report = await generateFeedback({
      role: "Engineer",
      history: [{ role: "user", content: "hello" }],
    });
    expect(report.overall_score).toBe(8);
  });

  it("4. handles malformed JSON via retry (provider fallback)", async () => {
    chatMock
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValue(JSON.stringify(validReport()));
    const report = await generateFeedback({
      role: "Engineer",
      history: [{ role: "user", content: "hello" }],
    });
    expect(report.overall_score).toBe(8);
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("5. throws after exhausting retries on persistent malformed JSON", async () => {
    chatMock.mockResolvedValue("garbage output");
    await expect(
      generateFeedback({
        role: "Engineer",
        history: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow();
  });

  it("6. rejects missing required fields", async () => {
    const incomplete = JSON.stringify({
      overall_score: 5,
      summary: "s",
      // missing many required fields
    });
    chatMock.mockResolvedValue(incomplete);
    await expect(
      generateFeedback({ role: "Engineer", history: [] }),
    ).rejects.toThrow();
  });

  it("7. rejects wrong field types", async () => {
    const wrong = JSON.stringify({
      ...validReport(),
      overall_score: "eight", // string instead of number
    });
    chatMock.mockResolvedValue(wrong);
    await expect(
      generateFeedback({ role: "Engineer", history: [] }),
    ).rejects.toThrow();
  });

  it("8. handles truncated response (repair attempt then retry)", async () => {
    chatMock
      .mockResolvedValueOnce(JSON.stringify(validReport()).slice(0, -10))
      .mockResolvedValue(JSON.stringify(validReport()));
    const report = await generateFeedback({
      role: "Engineer",
      history: [{ role: "user", content: "hello" }],
    });
    expect(report.overall_score).toBe(8);
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("9. successful result generation renders all fields", async () => {
    chatMock.mockResolvedValue(JSON.stringify(validReport()));
    const report = await generateFeedback({
      role: "Senior Engineer",
      history: [{ role: "user", content: "hello" }],
    });
    expect(report.overall_score).toBe(8);
    expect(report.technical_score).toBe(8);
    expect(report.communication_score).toBe(8);
    expect(report.hiring_recommendation).toBe("Hire");
    expect(report.star_evaluation).toContain("situation");
    expect(report.improvement_roadmap).toBeTruthy();
    expect(report.per_question_notes[0].score).toBe(8);
  });

  it("10. propagates config errors without retrying", async () => {
    const cfgError = new Error("config") as Error & { kind?: string };
    cfgError.kind = "config";
    chatMock.mockRejectedValue(cfgError);
    await expect(
      generateFeedback({ role: "Engineer", history: [] }),
    ).rejects.toThrow("config");
    expect(chatMock).toHaveBeenCalledTimes(1);
  });
});
