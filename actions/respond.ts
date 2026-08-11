"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeAnswer } from "@/lib/security";
import { respondInterviewSchema, respondTelemetrySchema } from "@/lib/validations";
import { generateNextQuestion, isCompletionMessage } from "@/services/interview";
import { persistAnswerTelemetry, clampSpeech, clampVision } from "@/services/telemetry";
import { semanticEvaluator, toTenScale } from "@/services/semantic-eval";
import {
  friendlyAIErrorMessage,
  isBudgetLimitError,
  AiResponseError,
} from "@/lib/ai/friendly-errors";
import type { ChatMessage, QuestionCategory } from "@/types/interview";

export interface RespondResult {
  message: string;
  category: string;
  isFollowUp: boolean;
  isComplete: boolean;
  questionId: string;
  /** True when the AI per-user budget rejected the request. */
  budgetLimit?: boolean;
}

export async function respondAction(params: {
  interviewId: string;
  answer: string;
  previousMessages: Array<{
    role: "user" | "assistant";
    content: string;
    category?: string;
    isFollowUp?: boolean;
  }>;
  speech?: unknown;
  vision?: unknown;
}): Promise<RespondResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!rateLimit(`respond:${user.id}`, 30)) {
    throw new Error("You are sending messages too quickly. Please slow down.");
  }

  const parsed = respondInterviewSchema.safeParse({
    interviewId: params.interviewId,
    answer: params.answer,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid answer");
  }

  const telemetryParsed = respondTelemetrySchema.safeParse({
    speech: params.speech,
    vision: params.vision,
  });
  if (!telemetryParsed.success) {
    throw new Error("Invalid analysis payload");
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, job_description, resume_file_id, status")
    .eq("id", parsed.data.interviewId)
    .maybeSingle();

  if (interviewError || !interview) {
    throw new Error("Interview not found");
  }
  if (interview.user_id !== user.id) {
    throw new Error("You do not have access to this interview");
  }
  if (interview.status !== "in_progress") {
    throw new Error("This interview has already ended");
  }

  const answer = sanitizeAnswer(parsed.data.answer);

  // Load resume context if present
  let resumeContext: string | undefined;
  if (interview.resume_file_id) {
    const { data: resumeFile } = await supabase
      .from("resume_files")
      .select("extracted_text")
      .eq("id", interview.resume_file_id)
      .maybeSingle();
    resumeContext = resumeFile?.extracted_text ?? undefined;
  }

  // Persist the user's answer against the last asked question
  const { data: lastQuestion } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastQuestion) {
    await supabase
      .from("interview_questions")
      .update({ answer })
      .eq("id", lastQuestion.id);

    const { speech, vision } = telemetryParsed.data;
    if (speech || vision) {
      await persistAnswerTelemetry({
        questionId: lastQuestion.id,
        speech: speech ? clampSpeech(speech) : undefined,
        vision: vision ? clampVision(vision) : undefined,
      });
    }
  }

  const assistantCount = params.previousMessages.filter(
    (m) => m.role === "assistant",
  ).length;

  // Determine if the last exchange warrants a follow-up: Alex's prior
  // response was a question and the candidate's answer was short.
  const isFollowUp = decideFollowUp(params.previousMessages, answer, assistantCount);

  const history: ChatMessage[] = params.previousMessages.map((m, index) => ({
    id: `m-${index}`,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: new Date(),
    category: m.category as QuestionCategory | undefined,
  }));

  // Server-side idempotency key derived from trusted context (interview +
  // the question just answered). Blocks a concurrent duplicate respond from
  // firing two AI dispatches for the same answer.
  const respondDedupKey = lastQuestion
    ? `respond:${interview.id}:${lastQuestion.id}`
    : `respond:${interview.id}:${user.id}`;

  // Score the answer semantically in parallel with generating the next question.
  // Never blocks or fails the main flow — on any error we simply skip scoring.
  const semanticScorePromise = lastQuestion
    ? scoreAnswerSemantically({
        questionId: lastQuestion.id,
        question: lastQuestion.question,
        answer,
        role: interview.job_role ?? undefined,
        resumeContext,
        userId: user.id,
        dedupKey: respondDedupKey,
      })
    : Promise.resolve();

  let generated: { content: string; category: QuestionCategory; isFollowUp: boolean };
  try {
    const results = await Promise.all([
      generateNextQuestion({
        role: interview.job_role ?? undefined,
        resumeContext,
        history,
        latestAnswer: answer,
        isFollowUp,
        userId: user.id,
        dedupKey: respondDedupKey,
      }),
      semanticScorePromise,
    ]);
    generated = results[0];
  } catch (error) {
    // The answer + telemetry were already persisted above — the interview is
    // never destroyed by an AI failure. Surface a calm, friendly message and
    // carry the budget-limit signal so the client shows the specific UX.
    throw new AiResponseError(
      friendlyAIErrorMessage(error),
      isBudgetLimitError(error),
    );
  }

  const isComplete = isCompletionMessage(generated.content);

  // Persist Alex's question
  const { data: questionRow, error: questionError } = await supabase
    .from("interview_questions")
    .insert({
      interview_id: interview.id,
      user_id: user.id,
      category: generated.category,
      question: generated.content,
      is_follow_up: generated.isFollowUp,
    })
    .select("id")
    .single();

  if (questionError || !questionRow) {
    throw new Error("Failed to save the question");
  }

  if (isComplete) {
    await supabase
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interview.id);
  }

  return {
    message: generated.content,
    category: generated.category,
    isFollowUp: generated.isFollowUp,
    isComplete,
    questionId: questionRow.id,
  };
}

function decideFollowUp(
  messages: Array<{ role: "user" | "assistant"; content: string; category?: string; isFollowUp?: boolean }>,
  latestAnswer: string,
  assistantCount: number,
): boolean {
  // Only follow up on a weak answer, never on the final message, and never
  // when the previous message was already a follow-up.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.isFollowUp) return false;

  const wordCount = latestAnswer.trim().split(/\s+/).length;
  const isWeak =
    wordCount < 15 ||
    /^(yes|no|yep|nope|maybe|i don'?t know|i think so|not sure|ok|okay|alright)\b/i.test(
      latestAnswer.trim(),
    );

  return isWeak && assistantCount < 8;
}

/**
 * Best-effort semantic scoring of an answer against its question. Persists the
 * blended score + LLM feedback onto the answered question row. Never throws:
 * scoring is a live preview only — the authoritative feedback pass overwrites
 * per-question scores at interview end.
 */
async function scoreAnswerSemantically(params: {
  questionId: string;
  question: string;
  answer: string;
  role?: string;
  resumeContext?: string;
  userId?: string;
  dedupKey?: string;
}): Promise<void> {
  try {
    const evaluation = await semanticEvaluator.evaluate({
      question: params.question,
      answer: params.answer,
      role: params.role,
      resumeContext: params.resumeContext,
      userId: params.userId,
      dedupKey: params.dedupKey,
    });

    const feedbackText =
      evaluation.feedback ||
      (evaluation.offline
        ? "Scored from LLM reasoning (semantic analysis offline)."
        : "Semantic score.");

    const supabase = await createClient();
    await supabase
      .from("interview_questions")
      .update({
        score: toTenScale(evaluation.blendedScore),
        feedback: feedbackText.slice(0, 1000),
      })
      .eq("id", params.questionId);
  } catch {
    // Scoring is non-critical — the interview proceeds without it.
  }
}
