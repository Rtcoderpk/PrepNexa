"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { sanitizeAnswer } from "@/lib/security";
import { respondInterviewSchema, respondTelemetrySchema } from "@/lib/validations";
import {
  generateNextQuestion,
  isCompletionMessage,
  getMaxQuestions,
  COMPLETION_PHRASE,
} from "@/services/interview";
import { persistAnswerTelemetry, clampSpeech, clampVision } from "@/services/telemetry";
import { semanticEvaluator, toTenScale } from "@/services/semantic-eval";
import {
  friendlyAIErrorMessage,
  isBudgetLimitError,
  AiResponseError,
} from "@/lib/ai/friendly-errors";
import { consumeFreeInterview } from "@/lib/usage";
import type { ChatMessage, QuestionCategory } from "@/types/interview";
import { after } from "next/server";

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
  const isDev = process.env.NODE_ENV === "development";
  const startTime = Date.now();
  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: Request received at ${new Date().toISOString()}`);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: Authenticated in ${Date.now() - startTime}ms`);
  }

  if (!(await rateLimitAsync(`respond:${user.id}`, 30))) {
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

  const dbFetchStart = Date.now();
  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, job_description, resume_file_id, status")
    .eq("id", parsed.data.interviewId)
    .maybeSingle();

  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: Interview DB fetch in ${Date.now() - dbFetchStart}ms`);
  }

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
    const resumeLoadStart = Date.now();
    const { data: resumeFile } = await supabase
      .from("resume_files")
      .select("extracted_text")
      .eq("id", interview.resume_file_id)
      .maybeSingle();
    resumeContext = resumeFile?.extracted_text ?? undefined;
    if (isDev) {
      console.log(`[DEBUG TIMING] respondAction: Resume file context loaded in ${Date.now() - resumeLoadStart}ms`);
    }
  }

  // Persist the user's answer against the last asked question
  const lastQuestionStart = Date.now();
  const { data: lastQuestion } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: Last question fetched in ${Date.now() - lastQuestionStart}ms`);
  }

  if (lastQuestion) {
    const saveAnswerStart = Date.now();
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
    if (isDev) {
      console.log(`[DEBUG TIMING] respondAction: Answer + telemetry saved in ${Date.now() - saveAnswerStart}ms`);
    }
  }

  // The authoritative question count comes from the DATABASE — never trust the
  // client's previousMessages length alone (stale closures, refresh, or a racing
  // second request could inflate it). Count only MAIN questions (follow-ups
  // probe the same question and do not advance the interview).
  const countStart = Date.now();
  const maxQuestions = getMaxQuestions();
  const { count: dbQuestionCount } = await supabase
    .from("interview_questions")
    .select("id", { count: "exact", head: true })
    .eq("interview_id", interview.id)
    .eq("is_follow_up", false);

  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: DB question count query in ${Date.now() - countStart}ms, count=${dbQuestionCount}`);
  }

  const assistantCount = params.previousMessages.filter(
    (m) => m.role === "assistant",
  ).length;

  // Hard cap: once the 5th question has been answered, do NOT call the AI to
  // generate a 6th question. Transition straight to the completion state.
  if ((dbQuestionCount ?? 0) >= maxQuestions) {
    const completeStart = Date.now();
    // Persist the completion status + consume the free credit (only for a
    // genuinely completed interview, idempotently).
    await supabase
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interview.id);
    await consumeFreeInterview(user.id, interview.id).catch(() => {});

    if (isDev) {
      console.log(`[DEBUG TIMING] respondAction: Completed interview saved in ${Date.now() - completeStart}ms`);
      console.log(`[DEBUG TIMING] respondAction: Total execution time ${Date.now() - startTime}ms`);
    }

    return {
      message: COMPLETION_PHRASE,
      category: "problem_solving" as QuestionCategory,
      isFollowUp: false,
      isComplete: true,
      questionId: lastQuestion?.id ?? "",
    };
  }

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

  // Decoupled semantic scoring using next/server after() — runs in background, does not block response.
  if (lastQuestion) {
    after(async () => {
      const scoreStart = Date.now();
      if (isDev) {
        console.log(`[DEBUG TIMING] [BACKGROUND] scoreAnswerSemantically: Started for questionId=${lastQuestion.id}`);
      }
      try {
        await scoreAnswerSemantically({
          questionId: lastQuestion.id,
          question: lastQuestion.question,
          answer,
          role: interview.job_role ?? undefined,
          resumeContext,
          userId: user.id,
          dedupKey: respondDedupKey,
        });
        if (isDev) {
          console.log(`[DEBUG TIMING] [BACKGROUND] scoreAnswerSemantically: Completed in ${Date.now() - scoreStart}ms`);
        }
      } catch (err) {
        if (isDev) {
          console.error(`[DEBUG TIMING] [BACKGROUND] scoreAnswerSemantically: Failed:`, err);
        }
      }
    });
  }

  let generated: { content: string; category: QuestionCategory; isFollowUp: boolean };
  const aiStart = Date.now();
  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: AI request started`);
  }
  try {
    generated = await generateNextQuestion({
      role: interview.job_role ?? undefined,
      resumeContext,
      history,
      latestAnswer: answer,
      isFollowUp,
      userId: user.id,
      dedupKey: respondDedupKey,
    });
    if (isDev) {
      console.log(`[DEBUG TIMING] respondAction: AI response received in ${Date.now() - aiStart}ms`);
    }
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
  const insertStart = Date.now();
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

  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: New question saved in ${Date.now() - insertStart}ms`);
  }

  if (questionError || !questionRow) {
    throw new Error("Failed to save the question");
  }

  if (isComplete) {
    // Mark complete first so consumeFreeInterview's idempotency check
    // (status === "completed") sees a completed interview.
    const completeStart = Date.now();
    await supabase
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interview.id);
    await consumeFreeInterview(user.id, interview.id).catch(() => {});
    if (isDev) {
      console.log(`[DEBUG TIMING] respondAction: Completing interview saved in ${Date.now() - completeStart}ms`);
    }
  }

  if (isDev) {
    console.log(`[DEBUG TIMING] respondAction: Total execution time ${Date.now() - startTime}ms`);
  }

  return {
    message: generated.content,
    category: generated.category,
    isFollowUp: generated.isFollowUp,
    isComplete,
    questionId: questionRow.id,
  };
}

export async function finishInterviewAction(interviewId: string) {
  const isDev = process.env.NODE_ENV === "development";
  const startTime = Date.now();
  if (isDev) {
    console.log(`[DEBUG TIMING] finishInterviewAction: Request received at ${new Date().toISOString()} for interviewId=${interviewId}`);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, status")
    .eq("id", interviewId)
    .maybeSingle();

  if (interviewError || !interview) {
    throw new Error("Interview not found");
  }
  if (interview.user_id !== user.id) {
    throw new Error("You do not have access to this interview");
  }

  if (interview.status !== "completed") {
    await supabase
      .from("interviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interview.id);
    await consumeFreeInterview(user.id, interview.id).catch(() => {});
    if (isDev) {
      console.log(`[DEBUG TIMING] finishInterviewAction: Interview status marked completed in DB`);
    }
  }

  if (isDev) {
    console.log(`[DEBUG TIMING] finishInterviewAction: Completed in ${Date.now() - startTime}ms`);
  }

  return { success: true };
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
