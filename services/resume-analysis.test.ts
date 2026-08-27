import { describe, expect, it, vi, beforeEach } from "vitest";
import { analyzeResume, matchResumeToJob } from "@/services/resume-analysis";
import { JSONParserError } from "@/lib/ai/json-parser";

// Shared fake provider — tests override chatMock to simulate provider responses.
const chatMock = vi.fn();

vi.mock("@/services/llm/provider", () => ({
  createLLMProvider: () => ({
    chat: chatMock,
    embed: vi.fn(),
    ping: vi.fn(),
  }),
}));

// Minimal valid ATS analysis response (matches the Zod schema in resume-analysis).
function validAtsJson() {
  return JSON.stringify({
    ats_score: 82,
    quality_score: 76,
    summary: "Well-structured resume with minor gaps.",
    strengths: ["Clear experience", "Quantified achievements"],
    weaknesses: ["Minor formatting issues"],
    top_improvements: ["Add metrics to bullet points"],
    keyword_analysis: {
      strong_keywords: ["React", "TypeScript"],
      missing_common_keywords: ["AWS", "CI/CD"],
      keyword_stuffing_risk: false,
      ats_compatibility_notes: "Standard format detected.",
    },
    section_analysis: [
      { section: "Experience", present: true, status: "good", feedback: "Strong" },
    ],
    contact_analysis: "Email and phone present.",
    action_verbs: "strong",
    measurable_achievements: "moderate",
    grammar: "good",
    readability: "moderate",
  });
}

describe("analyzeResume — ATS parsing (Phase 9)", () => {
  beforeEach(() => {
    chatMock.mockReset();
  });

  it("1. parses valid JSON response", async () => {
    chatMock.mockResolvedValue(validAtsJson());
    const result = await analyzeResume("Engineer with 5 years of experience");
    expect(result.atsScore).toBe(82);
    expect(result.qualityScore).toBe(76);
    expect(result.strengths).toContain("Clear experience");
  });

  it("2. parses JSON inside markdown fences", async () => {
    chatMock.mockResolvedValue("```json\n" + validAtsJson() + "\n```");
    const result = await analyzeResume("resume text");
    expect(result.atsScore).toBe(82);
  });

  it("3. parses JSON with surrounding text", async () => {
    chatMock.mockResolvedValue(
      "Here is the analysis:\n" + validAtsJson() + "\n--- end ---",
    );
    const result = await analyzeResume("resume text");
    expect(result.atsScore).toBe(82);
  });

  it("4. retries on malformed JSON and succeeds on second attempt (provider fallback)", async () => {
    // First attempt: resume_analysis returns garbage (triggers retry).
    // Second attempt: both requests return valid JSON.
    chatMock
      .mockResolvedValueOnce("not json at all") // resume_analysis attempt 1
      .mockResolvedValue(validAtsJson());        // resume_improvement + resume_analysis retry
    const result = await analyzeResume("resume text");
    expect(result.atsScore).toBe(82);
    // At least 2 calls to resume_analysis (initial + retry), plus 1 for bullets.
    expect(chatMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("5. throws on persistent malformed JSON after retries", async () => {
    chatMock.mockResolvedValue("completely broken");
    await expect(analyzeResume("resume text")).rejects.toThrow();
  });

  it("6. throws on schema-violating JSON", async () => {
    const bad = JSON.stringify({ ats_score: 50, quality_score: 50 });
    chatMock.mockResolvedValue(bad);
    await expect(analyzeResume("resume text")).rejects.toThrow();
  });

  it("7. handles truncated response (repair + retry)", async () => {
    // Truncated JSON + valid JSON on retry
    chatMock
      .mockResolvedValueOnce(JSON.stringify({ ats_score: 50 })) // truncated, missing fields
      .mockResolvedValue(validAtsJson());
    const result = await analyzeResume("resume text");
    expect(result.atsScore).toBe(82);
  });

  it("8. handles empty response from provider", async () => {
    chatMock.mockResolvedValue("");
    await expect(analyzeResume("resume text")).rejects.toThrow();
  });

  it("9. successful full analysis renders all fields", async () => {
    chatMock.mockResolvedValue(validAtsJson());
    const result = await analyzeResume("Senior engineer resume");
    expect(result.atsScore).toBe(82);
    expect(result.qualityScore).toBe(76);
    expect(result.summary).toContain("resume");
    expect(result.strengths).toHaveLength(2);
    expect(result.weaknesses).toHaveLength(1);
    expect(result.topImprovements).toHaveLength(1);
    expect(result.keywordAnalysis.strong_keywords).toContain("React");
    expect(result.actionVerbs).toBe("strong");
    expect(result.bulletImprovements).toEqual([]);
  });
});

describe("matchResumeToJob — job matching parsing", () => {
  beforeEach(() => {
    chatMock.mockReset();
  });

  const validMatch = JSON.stringify({
    match_score: 85,
    summary: "Good fit.",
    matched_keywords: ["React"],
    missing_keywords: ["GraphQL"],
    relevant_skills: ["TypeScript"],
    missing_skills: ["AWS"],
    experience_alignment: "Match.",
    recommended_changes: ["Add projects"],
    sections_to_improve: ["Skills"],
  });

  it("parses valid job-match JSON", async () => {
    chatMock.mockResolvedValue(validMatch);
    const result = await matchResumeToJob("resume", "job description");
    expect(result.match_score).toBe(85);
    expect(result.matched_keywords).toContain("React");
  });

  it("parses fenced job-match JSON", async () => {
    chatMock.mockResolvedValue("```json\n" + validMatch + "\n```");
    const result = await matchResumeToJob("resume", "job description");
    expect(result.match_score).toBe(85);
  });

  it("parses job-match JSON with surrounding commentary", async () => {
    chatMock.mockResolvedValue("Here you go:\n" + validMatch + "\nDone!");
    const result = await matchResumeToJob("resume", "job description");
    expect(result.match_score).toBe(85);
  });

  it("throws on malformed job-match JSON", async () => {
    chatMock.mockResolvedValue("{broken");
    await expect(matchResumeToJob("r", "j")).rejects.toThrow();
  });

  it("throws on invalid job-match schema", async () => {
    chatMock.mockResolvedValue(JSON.stringify({ match_score: 50 }));
    await expect(matchResumeToJob("r", "j")).rejects.toThrow();
  });

  it("throws on empty job-match response", async () => {
    chatMock.mockResolvedValue("");
    await expect(matchResumeToJob("r", "j")).rejects.toThrow();
  });
});
