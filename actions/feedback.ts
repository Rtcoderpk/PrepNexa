"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { generateFeedback, saveFeedback, loadInterviewTelemetry } from "@/services/feedback";
import { friendlyAIErrorMessage } from "@/lib/ai/friendly-errors";
import type { InterviewFeedbackReport } from "@/types/feedback";

export interface FeedbackResult {
  interviewId: string;
  feedback: InterviewFeedbackReport;
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

  if (!(await rateLimitAsync(`feedback:${user.id}`, 5))) {
    throw new Error("Too many requests. Please try again later.");
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, resume_file_id, status")
    .eq("id", params.interviewId)
    .maybeSingle();

  if (interviewError || !interview) {
    throw new Error("Interview not found");
  }
  if (interview.user_id !== user.id) {
    throw new Error("You do not have access to this interview");
  }

  const role = interview.job_role ?? "Senior Software Engineer";

  let resumeContext: string | undefined;
  if (interview.resume_file_id) {
    const { data: resumeFile } = await supabase
      .from("resume_files")
      .select("extracted_text")
      .eq("id", interview.resume_file_id)
      .maybeSingle();
    resumeContext = resumeFile?.extracted_text ?? undefined;
  }

  const telemetry = await loadInterviewTelemetry(interview.id);

  let report: InterviewFeedbackReport;
  try {
    report = await generateFeedback({
      role,
      resumeContext,
      history: params.history,
      telemetry,
      userId: user.id,
    });
  } catch (error) {
    throw new Error(friendlyAIErrorMessage(error));
  }

  await saveFeedback({
    interviewId: interview.id,
    userId: user.id,
    report,
  });

  return {
    interviewId: interview.id,
    feedback: report,
  };
}
