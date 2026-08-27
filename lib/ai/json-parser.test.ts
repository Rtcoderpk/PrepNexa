import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  safeParseJson,
  JSONParserError,
  isJSONParserError,
  summarizeJSONParseError,
} from "@/lib/ai/json-parser";

const feedbackSchema = z.object({
  overall_score: z.number().int().min(0).max(10),
  summary: z.string(),
  strengths: z.array(z.string().max(300)).max(20),
  per_question_notes: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      score: z.number().int().min(0).max(10),
      feedback: z.string(),
    }),
  ),
});

const validReport = {
  overall_score: 8,
  summary: "Strong performance.",
  strengths: ["Clear communication", "Solid tech depth"],
  per_question_notes: [
    {
      question: "Tell me about yourself",
      answer: "I am a backend engineer.",
      score: 8,
      feedback: "Concise and relevant.",
    },
  ],
};

const resumeSchema = z.object({
  ats_score: z.number().int().min(0).max(100),
  quality_score: z.number().int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).max(15),
  contact_analysis: z.string(),
});

describe("safeParseJson — extraction strategies", () => {
  it("1. parses valid raw JSON", () => {
    const result = safeParseJson(JSON.stringify(validReport), feedbackSchema, {
      task: "interview_feedback",
    });
    expect(result.data).toEqual(validReport);
    expect(result.diagnostics.strategy).toBe("raw");
    expect(result.diagnostics.repairPasses).toBe(0);
    expect(result.diagnostics.truncated).toBe(false);
  });

  it("2. parses JSON inside markdown fences (```json)", () => {
    const raw = "```json\n" + JSON.stringify(validReport) + "\n```";
    const result = safeParseJson(raw, feedbackSchema, {
      task: "interview_feedback",
    });
    expect(result.data).toEqual(validReport);
    expect(result.diagnostics.strategy).toBe("fenced_json");
  });

  it("2b. parses JSON inside bare markdown fences (```)", () => {
    const raw = "```\n" + JSON.stringify(validReport) + "\n```";
    const result = safeParseJson(raw, feedbackSchema, {
      task: "interview_feedback",
    });
    expect(result.data).toEqual(validReport);
    expect(result.diagnostics.strategy).toBe("fenced_any");
  });

  it("3. parses JSON with harmless surrounding text", () => {
    const raw =
      "Here is the analysis:\n" +
      JSON.stringify(validReport) +
      "\nBest regards, AI";
    const result = safeParseJson(raw, feedbackSchema, {
      task: "interview_feedback",
    });
    expect(result.data).toEqual(validReport);
    expect(result.diagnostics.strategy).toBe("balanced_brace");
  });

  it("3b. does NOT over-match when trailing text contains a brace", () => {
    // Greedy regex `\{[\s\S]*\}` would grab to the last `}` in "}".
    const raw = JSON.stringify(validReport) + "\nNote: see } for details";
    const result = safeParseJson(raw, feedbackSchema, {
      task: "interview_feedback",
    });
    expect(result.data).toEqual(validReport);
  });
});

describe("safeParseJson — truncation recovery", () => {
  it("4. recovers from a truncated object (missing closing braces)", () => {
    // Simulate the model cutting off mid-output: the JSON opens objects/arrays
    // but never closes them. We cut right after a complete per_question_notes
    // entry (the array + inner object are complete), so the repair step only
    // needs to close the remaining open structures.
    const full = JSON.stringify(validReport);
    // Find the end of the per_question_notes array's closing brace+bracket
    const notesEnd = full.indexOf('"feedback":"Concise and relevant."') + '"feedback":"Concise and relevant."'.length;
    const truncated = full.slice(0, notesEnd);
    const result = safeParseJson(truncated, feedbackSchema, {
      task: "interview_feedback",
    });
    expect(result.diagnostics.truncated).toBe(true);
    expect(result.diagnostics.repairPasses).toBeGreaterThanOrEqual(1);
    expect(result.data.overall_score).toBe(8);
    expect(result.data.summary).toBe("Strong performance.");
    expect(result.data.per_question_notes).toHaveLength(1);
  });

  it("4b. cannot repair truncation mid-string-value (fails gracefully)", () => {
    // A truncation that cuts inside a string value is unrepairable — the parser
    // must throw a JSONParserError rather than silently produce garbage data.
    const truncated = JSON.stringify(validReport).slice(0, -10);
    expect(() =>
      safeParseJson(truncated, feedbackSchema, { task: "interview_feedback" }),
    ).toThrow(JSONParserError);
  });

  it("5. recovers from a truncated array", () => {
    const schema = z.object({ items: z.array(z.string()) });
    const raw = '{"items": ["a", "b", "c"'; // truncated, missing ]
    const result = safeParseJson(raw, schema, { task: "test" });
    expect(result.diagnostics.truncated).toBe(true);
    expect(result.data.items).toEqual(["a", "b", "c"]);
  });

  it("6. gives up on malformed JSON that repair cannot fix", () => {
    expect(() =>
      safeParseJson("{not valid json at all", feedbackSchema, {
        task: "interview_feedback",
      }),
    ).toThrow(JSONParserError);
  });
});

describe("safeParseJson — schema enforcement", () => {
  it("does NOT weaken schemas: rejects missing required fields", () => {
    const incomplete = { overall_score: 5, summary: "s" };
    expect(() =>
      safeParseJson(JSON.stringify(incomplete), feedbackSchema, {
        task: "interview_feedback",
      }),
    ).toThrow(JSONParserError);
  });

  it("rejects wrong field types", () => {
    const wrongType = { ...validReport, overall_score: "eight" };
    expect(() =>
      safeParseJson(JSON.stringify(wrongType), feedbackSchema, {
        task: "interview_feedback",
      }),
    ).toThrow(JSONParserError);
  });

  it("rejects out-of-range values", () => {
    const outOfRange = { ...validReport, overall_score: 99 };
    expect(() =>
      safeParseJson(JSON.stringify(outOfRange), feedbackSchema, {
        task: "interview_feedback",
      }),
    ).toThrow(JSONParserError);
  });

  it("rejects an array when an object is expected", () => {
    expect(() =>
      safeParseJson(JSON.stringify(["not", "an", "object"]), feedbackSchema, {
        task: "interview_feedback",
      }),
    ).toThrow(JSONParserError);
  });
});

describe("safeParseJson — empty / whitespace", () => {
  it("throws on empty response", () => {
    expect(() =>
      safeParseJson("", feedbackSchema, { task: "interview_feedback" }),
    ).toThrow(JSONParserError);
  });

  it("throws on whitespace-only response", () => {
    expect(() =>
      safeParseJson("   \n  ", feedbackSchema, { task: "interview_feedback" }),
    ).toThrow(JSONParserError);
  });
});

describe("safeParseJson — diagnostics & security", () => {
  it("carries provider/model in diagnostics", () => {
    const result = safeParseJson(JSON.stringify(validReport), feedbackSchema, {
      task: "interview_feedback",
      provider: "gemini",
      model: "gemini-flash-latest",
    });
    expect(result.diagnostics.provider).toBe("gemini");
    expect(result.diagnostics.model).toBe("gemini-flash-latest");
  });

  it("never exposes raw model output in the error object", () => {
    const sensitiveResume = "CONFIDENTIAL RESUME DATA john.doe@example.com SSN-123";
    let error: JSONParserError | null = null;
    try {
      safeParseJson(sensitiveResume, feedbackSchema, {
        task: "interview_feedback",
      });
    } catch (e) {
      if (isJSONParserError(e)) error = e;
    }
    expect(error).not.toBeNull();
    expect(error!.message).not.toContain("CONFIDENTIAL");
    expect(error!.message).not.toContain("john.doe");
    expect(error!.message).not.toContain("SSN");
    expect(error!.rawFingerprint).toMatch(/^[a-f0-9]+$/);
    expect(error!.rawLength).toBe(sensitiveResume.length);
  });

  it("summarizeJSONParseError produces a safe log summary", () => {
    try {
      // Use valid JSON that fails schema validation, so diagnostics include
      // a parseError string for telemetry.
      safeParseJson("[1, 2, 3]", feedbackSchema, {
        task: "resume_analysis",
        provider: "groq",
        model: "groq/compound-mini",
      });
    } catch (e) {
      const summary = summarizeJSONParseError(e, "gemini");
      expect(summary.task).toBe("resume_analysis");
      expect(summary.provider).toBe("groq");
      expect(summary.model).toBe("groq/compound-mini");
      expect(summary.fallback).toBe("gemini");
      expect(summary.rawFingerprint).toMatch(/^[a-f0-9]+$/);
      expect(summary.parseError).toBeDefined();
      // No raw content leaked:
      expect(JSON.stringify(summary)).not.toContain("garbage");
    }
  });
});

describe("safeParseJson — maxRepairPasses", () => {
  it("respects maxRepairPasses=0 (no repair, just extract)", () => {
    const truncated = JSON.stringify(validReport).replace("]", "");
    expect(() =>
      safeParseJson(truncated, feedbackSchema, {
        task: "interview_feedback",
        maxRepairPasses: 0,
      }),
    ).toThrow(JSONParserError);
  });
});

describe("safeParseJson — ATS schema (Phase 9)", () => {
  const validAts = {
    ats_score: 82,
    quality_score: 76,
    summary: "Well-structured resume with minor gaps.",
    strengths: ["Clear experience", "Quantified achievements"],
    contact_analysis: "Email and phone present.",
  };

  it("1. parses valid ATS JSON", () => {
    const result = safeParseJson(JSON.stringify(validAts), resumeSchema, {
      task: "resume_analysis",
    });
    expect(result.data.ats_score).toBe(82);
  });

  it("2. parses fenced ATS JSON", () => {
    const raw = "```json\n" + JSON.stringify(validAts) + "\n```";
    const result = safeParseJson(raw, resumeSchema, { task: "resume_analysis" });
    expect(result.data.ats_score).toBe(82);
  });

  it("3. parses ATS JSON with surrounding text", () => {
    const raw = "Here is my analysis:\n" + JSON.stringify(validAts) + "\n---";
    const result = safeParseJson(raw, resumeSchema, { task: "resume_analysis" });
    expect(result.data.ats_score).toBe(82);
  });

  it("4. throws on malformed ATS JSON", () => {
    expect(() =>
      safeParseJson("{not json", resumeSchema, { task: "resume_analysis" }),
    ).toThrow(JSONParserError);
  });

  it("5. throws on invalid ATS schema (missing field)", () => {
    const bad = { ats_score: 50, quality_score: 50 };
    expect(() =>
      safeParseJson(JSON.stringify(bad), resumeSchema, {
        task: "resume_analysis",
      }),
    ).toThrow(JSONParserError);
  });

  it("6. throws on truncated ATS response", () => {
    const truncated = JSON.stringify(validAts).slice(0, 30);
    expect(() =>
      safeParseJson(truncated, resumeSchema, { task: "resume_analysis" }),
    ).toThrow(JSONParserError);
  });

  it("7. throws on empty ATS response", () => {
    expect(() =>
      safeParseJson("", resumeSchema, { task: "resume_analysis" }),
    ).toThrow(JSONParserError);
  });
});
