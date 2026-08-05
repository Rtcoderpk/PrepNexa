import { describe, expect, it } from "vitest";
import { analyzeTranscriptMetrics } from "@/services/speech-metrics";

describe("analyzeTranscriptMetrics", () => {
  it("counts sentence-initial capitalized fillers (regression: case-sensitive bug)", () => {
    const text =
      "Um, I have five years of experience. Like, I worked on scaling systems, you know, and basically led a team of four.";
    const result = analyzeTranscriptMetrics({ transcript: text, audioDurationSec: 60 });

    // Matches pythonai's speech_metrics for the same transcript (4 fillers).
    expect(result.fillerWordCount).toBe(4);
    expect(result.fillerDensity).toBeCloseTo(18.18, 1);
  });

  it("returns empty result for empty transcript", () => {
    expect(analyzeTranscriptMetrics({ transcript: "   " })).toEqual({});
  });

  it("returns empty result for whitespace-only input", () => {
    expect(analyzeTranscriptMetrics({ transcript: "\n\t " })).toEqual({});
  });

  it("penalizes fluency for clipped answers", () => {
    const result = analyzeTranscriptMetrics({ transcript: "Yes." });
    expect(result.fluencyScore).toBeLessThan(1);
    expect(result.fluencyScore).toBeGreaterThanOrEqual(0);
  });

  it("computes fluency with no penalty for a long clean answer", () => {
    const clean =
      "I led a team of four engineers building a payments platform that handled over a million transactions per day.";
    const result = analyzeTranscriptMetrics({ transcript: clean, audioDurationSec: 30 });
    expect(result.fluencyScore).toBe(1);
    expect(result.fillerWordCount).toBe(0);
  });

  it("computes words per minute from duration", () => {
    const result = analyzeTranscriptMetrics({
      transcript: "one two three four five",
      audioDurationSec: 15,
    });
    expect(result.wordsPerMinute).toBeCloseTo(20, 1); // 5 words / 15s * 60
  });

  it("omits words per minute when duration is absent or too short", () => {
    expect(analyzeTranscriptMetrics({ transcript: "hello world" }).wordsPerMinute).toBeUndefined();
    expect(
      analyzeTranscriptMetrics({ transcript: "hello world", audioDurationSec: 0.5 })
        .wordsPerMinute,
    ).toBeUndefined();
  });

  it("detects multi-word filler phrases", () => {
    const result = analyzeTranscriptMetrics({
      transcript: "you know, it was, you know, quite challenging",
    });
    expect(result.fillerWordCount).toBe(2);
  });
});
