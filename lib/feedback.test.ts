import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseFeedbackReportJson } from "@/lib/feedback";
import { clampSpeech, clampVision } from "@/lib/validations";

const validReport = {
  overall_score: 8,
  summary: "Strong performance overall.",
  strengths: ["Clear communication", "Solid technical depth"],
  weaknesses: ["Occasionally rushed answers"],
  areas_to_improve: ["Structure responses with STAR"],
  technical_score: 8,
  communication_score: 8,
  confidence_score: 7,
  grammar_score: 9,
  speaking_speed_score: 7,
  eye_contact_score: 8,
  body_language_score: 7,
  star_evaluation: "Candidate described a clear situation and action.",
  hiring_recommendation: "Hire",
  improvement_roadmap: "1. Practice STAR...",
  per_question_notes: [
    {
      question: "Tell me about yourself",
      answer: "I am a backend engineer.",
      score: 8,
      feedback: "Concise and relevant.",
    },
  ],
};

describe("parseFeedbackReportJson", () => {
  it("parses a plain JSON object", () => {
    expect(parseFeedbackReportJson(JSON.stringify(validReport))).toEqual(validReport);
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    const raw = "```json\n" + JSON.stringify(validReport) + "\n```";
    expect(parseFeedbackReportJson(raw)).toEqual(validReport);
  });

  it("parses JSON with surrounding commentary", () => {
    const raw = "Here is the report:\n" + JSON.stringify(validReport) + "\nHope it helps!";
    expect(parseFeedbackReportJson(raw)).toEqual(validReport);
  });

  it("throws on unparseable content", () => {
    expect(() => parseFeedbackReportJson("not json at all")).toThrow("Invalid JSON");
  });

  it("throws when the object fails schema validation", () => {
    const bad = { ...validReport, overall_score: 99 };
    expect(() => parseFeedbackReportJson(JSON.stringify(bad))).toThrow("Invalid JSON");
  });
});

describe("clampSpeech", () => {
  it("clamps out-of-range numeric fields", () => {
    const out = clampSpeech({
      transcript: "hello",
      transcriptionSource: "web_speech",
      audioDurationSec: 900,
      wordsPerMinute: 1000,
      fillerDensity: 200,
      fluencyScore: 5,
    });
    expect(out.audioDurationSec).toBe(600);
    expect(out.wordsPerMinute).toBe(600);
    expect(out.fillerDensity).toBe(100);
    expect(out.fluencyScore).toBe(1);
  });

  it("leaves undefined fields undefined", () => {
    const out = clampSpeech({ transcript: "hi", transcriptionSource: "web_speech" });
    expect(out.audioDurationSec).toBeUndefined();
  });
});

describe("clampVision", () => {
  it("clamps out-of-range numeric fields", () => {
    const out = clampVision({
      eyeContactPct: 200,
      avgConfidence: 150,
      smilePct: 120,
      postureScore: 2,
      blinkRatePerMin: 900,
    });
    expect(out.eyeContactPct).toBe(100);
    expect(out.avgConfidence).toBe(100);
    expect(out.smilePct).toBe(100);
    expect(out.postureScore).toBe(1);
    expect(out.blinkRatePerMin).toBe(600);
  });
});

// ---- P7-F2: generateFeedback forwards userId (budget + telemetry attribution) --
const fbChatMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/llm/provider", () => ({
  createLLMProvider: () => ({
    chat: fbChatMock,
    embed: vi.fn(),
    ping: vi.fn(),
  }),
}));

describe("generateFeedback userId attribution (P7-F2)", () => {
  beforeEach(() => {
    fbChatMock.mockReset().mockResolvedValue(
      JSON.stringify({
        overall_score: 8,
        summary: "s",
        strengths: ["a"],
        weaknesses: ["b"],
        areas_to_improve: ["c"],
        technical_score: 8,
        communication_score: 8,
        confidence_score: 8,
        grammar_score: 8,
        speaking_speed_score: 8,
        eye_contact_score: 8,
        body_language_score: 8,
        hiring_recommendation: "yes",
        star_evaluation: "x",
        improvement_roadmap: "y",
        per_question_notes: [],
      }),
    );
  });

  it("passes userId through to the LLM so the router attributes budget/telemetry", async () => {
    const { generateFeedback } = await import("@/services/feedback");
    fbChatMock.mockClear();
    await generateFeedback({
      role: "engineer",
      history: [{ role: "user", content: "hello" }],
      userId: "user-42",
    });
    const opts = fbChatMock.mock.calls[0][0];
    expect(opts.userId).toBe("user-42");
  });

  it("handles a missing userId safely (no userId passed)", async () => {
    const { generateFeedback } = await import("@/services/feedback");
    fbChatMock.mockClear();
    await generateFeedback({
      role: "engineer",
      history: [{ role: "user", content: "hello" }],
    });
    const opts = fbChatMock.mock.calls[0][0];
    expect(opts.userId).toBeUndefined();
  });
});
