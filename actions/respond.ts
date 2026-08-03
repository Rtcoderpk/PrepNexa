"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeAnswer } from "@/lib/security";
import { respondInterviewSchema } from "@/lib/validations";
import { generateNextQuestion, isCompletionMessage } from "@/services/interview";
import type { ChatMessage, QuestionCategory } from "@/types/interview";

export interface RespondResult {
  message: string;
  category: string;
  isFollowUp: boolean;
  isComplete: boolean;
  questionId: string;
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
    .select("id")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastQuestion) {
    await supabase
      .from("interview_questions")
      .update({ answer })
      .eq("id", lastQuestion.id);
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

  const generated = await generateNextQuestion({
    role: interview.job_role ?? undefined,
    resumeContext,
    history,
    latestAnswer: answer,
    isFollowUp,
  });

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
