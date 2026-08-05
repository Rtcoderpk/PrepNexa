import { createClient as createServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createLLMProvider } from "@/services/llm/provider";
import { buildFeedbackPrompt } from "@/services/llm/prompts/feedback";
import { parseFeedbackReportJson } from "@/lib/feedback";
import { feedbackReportSchema } from "@/lib/validations";
import type { InterviewFeedbackReport } from "@/types/feedback";

export interface FeedbackTelemetry {
  question: string;
  wordsPerMinute?: number;
  fillerDensity?: number;
  fluencyScore?: number;
  eyeContactPct?: number;
  avgConfidence?: number;
  blinkRatePerMin?: number;
  postureScore?: number;
}

const MAX_ATTEMPTS = 2;

function clampScore(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value)));
}

export async function generateFeedback(params: {
  role?: string;
  resumeContext?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  telemetry?: FeedbackTelemetry[];
}): Promise<InterviewFeedbackReport> {
  const provider = createLLMProvider();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await provider.chat({
        messages: [
          {
            role: "user",
            content: buildFeedbackPrompt({
              role: params.role,
              resumeContext: params.resumeContext,
              history: params.history,
              telemetry: params.telemetry,
            }),
          },
        ],
        system: "",
        temperature: 0.3,
        maxOutputTokens: 3000,
        format: "json",
      });

      const parsed = parseFeedbackReportJson(raw);
      const validated = feedbackReportSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      lastError = new Error("Feedback failed validation");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Feedback failed");
    }
  }

  throw lastError ?? new Error("Failed to generate feedback");
}

/**
 * Loads the per-question speech + vision metrics already persisted during the
 * interview (via respond's telemetry upserts) and maps them to the telemetry
 * shape the feedback prompt consumes. Best-effort: missing rows are skipped.
 * Runs two flat queries — the Database types don't model nested relationships.
 */
export async function loadInterviewTelemetry(
  interviewId: string,
  client?: SupabaseClient,
): Promise<FeedbackTelemetry[]> {
  const supabase = client ?? (await createServerClient());

  const { data: questions } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  if (!questions?.length) return [];

  const questionIds = questions.map((q) => q.id);

  const [{ data: speechRows }, { data: visionRows }] = await Promise.all([
    supabase
      .from("speech_metrics")
      .select("question_id, fluency_score, filler_density, words_per_minute")
      .in("question_id", questionIds),
    supabase
      .from("vision_metrics")
      .select("question_id, eye_contact_pct, avg_confidence, blink_rate_per_min, posture_score")
      .in("question_id", questionIds),
  ]);

  const speechByQuestion = new Map((speechRows ?? []).map((r) => [r.question_id, r]));
  const visionByQuestion = new Map((visionRows ?? []).map((r) => [r.question_id, r]));

  const telemetry: FeedbackTelemetry[] = [];
  for (const q of questions) {
    const speech = speechByQuestion.get(q.id);
    const vision = visionByQuestion.get(q.id);
    if (!speech && !vision) continue;

    telemetry.push({
      question: q.question,
      wordsPerMinute: speech?.words_per_minute ?? undefined,
      fillerDensity: speech?.filler_density ?? undefined,
      fluencyScore: speech?.fluency_score ?? undefined,
      eyeContactPct: vision?.eye_contact_pct ?? undefined,
      avgConfidence: vision?.avg_confidence ?? undefined,
      blinkRatePerMin: vision?.blink_rate_per_min ?? undefined,
      postureScore: vision?.posture_score ?? undefined,
    });
  }

  return telemetry;
}

/**
 * Persists the report: normalized score columns on interviews, per-question
 * notes, and the full report payload in feedback_reports. Marks completed.
 *
 * `client` is injectable so the feedback worker (no user session) can pass an
 * RLS-bypassing admin client. Defaults to the cookie-authed server client.
 */
export async function saveFeedback(
  params: {
    interviewId: string;
    userId: string;
    report: InterviewFeedbackReport;
  },
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createServerClient());
  const { interviewId, userId, report } = params;

  // Per-question notes → interview_questions (match by normalized question text).
  const { data: storedQuestions } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  if (storedQuestions) {
    for (const note of report.per_question_notes) {
      const match = storedQuestions.find(
        (q) =>
          q.question.trim().toLowerCase() === note.question.trim().toLowerCase(),
      );
      if (match) {
        await supabase
          .from("interview_questions")
          .update({
            score: clampScore(note.score),
            feedback: note.feedback,
          })
          .eq("id", match.id);
      }
    }
  }

  await supabase.from("feedback_reports").insert({
    interview_id: interviewId,
    user_id: userId,
    data: report as unknown as Record<string, unknown>,
  });

  await supabase
    .from("interviews")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      overall_score: clampScore(report.overall_score),
      summary: report.summary,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      areas_to_improve: report.areas_to_improve,
      star_evaluation: report.star_evaluation,
      hiring_recommendation: report.hiring_recommendation,
      improvement_roadmap: report.improvement_roadmap,
      technical_score: clampScore(report.technical_score),
      communication_score: clampScore(report.communication_score),
      confidence_score: clampScore(report.confidence_score),
      grammar_score: clampScore(report.grammar_score),
      speaking_speed_score: clampScore(report.speaking_speed_score),
      eye_contact_score: clampScore(report.eye_contact_score),
      body_language_score: clampScore(report.body_language_score),
    })
    .eq("id", interviewId);
}
