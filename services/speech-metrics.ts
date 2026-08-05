import type { SpeechMetricsData } from "@/lib/validations";

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "er",
  "ah",
  "like",
  "you know",
  "actually",
  "basically",
  "i mean",
  "sort of",
  "kind of",
  "right",
  "well",
  "so yeah",
  "hmm",
  "huh",
  "okay so",
  "yeah so",
  "i guess",
]);

/**
 * Pure-transcript speech metrics. Used as a lightweight fallback when the
 * Faster Whisper service is unavailable (Web Speech API path): the browser
 * supplies the transcript + duration, and we compute filler density and a
 * fluency heuristic locally. Full WPM/pause analysis still runs in pythonai
 * when audio is present.
 */
export function analyzeTranscriptMetrics(params: {
  transcript: string;
  audioDurationSec?: number;
}): Partial<SpeechMetricsData> {
  const { transcript, audioDurationSec } = params;
  if (!transcript.trim()) return {};

  const lower = transcript.toLowerCase();
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Count filler-word occurrences (token-level and common multi-word phrases).
  let fillerCount = 0;
  for (const filler of FILLER_WORDS) {
    if (filler.includes(" ")) {
      const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "g");
      fillerCount += (lower.match(re) ?? []).length;
    } else if (
      /^[a-z]+$/.test(filler) &&
      words.some((w) => w.replace(/[^a-z]/g, "") === filler)
    ) {
      fillerCount += words.filter((w) => w.replace(/[^a-z]/g, "") === filler)
        .length;
    }
  }

  const fillerDensity = wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;

  // Fluency heuristic: penalize excessive fillers; reward a reasonable length.
  // 0-1 score, higher is more fluent.
  let fluency = 1;
  fluency -= Math.min(0.6, fillerDensity / 40);
  if (wordCount < 10) fluency -= 0.2; // very short / clipped answer
  fluency = Math.min(1, Math.max(0, fluency));

  // Rough WPM when a duration is supplied.
  let wordsPerMinute: number | undefined;
  if (audioDurationSec && audioDurationSec > 1 && wordCount > 0) {
    wordsPerMinute = (wordCount / audioDurationSec) * 60;
  }

  return {
    transcript,
    audioDurationSec,
    wordsPerMinute,
    fillerWordCount: fillerCount,
    fillerDensity,
    fluencyScore: fluency,
  };
}