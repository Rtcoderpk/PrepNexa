import { z } from "zod";
import {
  feedbackSchema,
  type InterviewFeedbackData,
} from "@/lib/validations";

/**
 * Parses raw Gemini output into a validated InterviewFeedback.
 * Attempts a strict JSON parse, then falls back to extracting the
 * first JSON object from the response (Gemini occasionally wraps
 * JSON in markdown fences).
 */
export function parseFeedbackJson(raw: string): InterviewFeedbackData {
  const candidates: string[] = [];

  candidates.push(raw.trim());

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) candidates.push(fencedMatch[1].trim());

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const result = feedbackSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // try next candidate
    }
  }

  throw new Error("Invalid JSON in feedback response");
}

export function validateFeedback(raw: unknown): InterviewFeedbackData {
  const result = z
    .object({
      overall_score: z.number().int().min(0).max(10),
      summary: z.string(),
      strengths: z.array(z.string()),
      areas_to_improve: z.array(z.string()),
      per_question_notes: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
          score: z.number().int().min(0).max(10),
          feedback: z.string(),
        }),
      ),
    })
    .safeParse(raw);

  if (!result.success) {
    throw new Error("Invalid feedback payload");
  }

  return result.data;
}
