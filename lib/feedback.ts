import { z } from "zod";
import {
  feedbackReportSchema,
  type InterviewFeedbackReportData,
} from "@/lib/validations";

/**
 * Parses raw LLM output into a validated feedback report.
 *
 * Local models (Qwen3) sometimes wrap JSON in markdown fences or emit trailing
 * commentary despite being asked not to. We try, in order:
 *   1. exact JSON.parse
 *   2. first fenced ```json block
 *   3. first braced JSON object anywhere in the text
 * Return the first candidate that validates against the report schema.
 */
export function parseFeedbackReportJson(raw: string): InterviewFeedbackReportData {
  const candidates: string[] = [];

  candidates.push(raw.trim());

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) candidates.push(fencedMatch[1].trim());

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const result = feedbackReportSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // try next candidate
    }
  }

  throw new Error("Invalid JSON in model response");
}
