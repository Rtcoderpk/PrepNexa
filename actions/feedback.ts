"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseFeedbackJson } from "@/lib/feedback";
import { generateFeedback } from "@/services/gemini";
import type { InterviewFeedback } from "@/types/interview";
import { MAX_QUESTIONS } from "@/lib/validations";

export interface FeedbackResult {
  interviewId: string;
  feedback: InterviewFeedback;
}

export async function generateInterviewFeedbackAction(params: {
  interviewId: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<FeedbackResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!rateLimit(`feedback:${user.id}`, 5)) {
    throw new Error("Too many requests. Please try again later.");
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, status")
    .eq("id", params.interviewId)
    .maybeSingle();

  if (interviewError || !interview) {
    throw new Error("Interview not found");
  }
  if (interview.user_id !== user.id) {
    throw new Error("You do not have access to this interview");
  }

  const role = interview.job_role ?? "Senior Software Engineer";

  const conversationHistory = params.history.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    content: m.content,
  }));

  // Try up to 2 attempts to get valid JSON.
  let feedback: InterviewFeedback | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateFeedback({
        role,
        history: conversationHistory,
      });
      feedback = parseFeedbackJson(raw);
      if (feedback) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Feedback failed");
    }
  }

  if (!feedback) {
    throw lastError ?? new Error("Failed to generate feedback");
  }

  const perQuestionNotes = feedback.per_question_notes ?? [];

  // Persist per-question notes onto the stored questions.
  const { data: storedQuestions } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  if (storedQuestions) {
    for (const note of perQuestionNotes) {
      const match = storedQuestions.find(
        (q) =>
          q.question.trim().toLowerCase() ===
            note.question.trim().toLowerCase() && note.score !== undefined,
      );
      if (match) {
        await supabase
          .from("interview_questions")
          .update({
            score: note.score,
            feedback: note.feedback,
          })
          .eq("id", match.id);
      }
    }
  }

  await supabase
    .from("interviews")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      overall_score: Math.min(10, Math.max(0, Math.round(feedback.overall_score))),
      summary: feedback.summary,
      strengths: feedback.strengths,
      areas_to_improve: feedback.areas_to_improve,
    })
    .eq("id", interview.id);

  return {
    interviewId: interview.id,
    feedback,
  };
}

export const MAX_FEEDBACK_QUESTIONS = MAX_QUESTIONS;
