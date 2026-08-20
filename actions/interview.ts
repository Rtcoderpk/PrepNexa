"use server";

import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/security";
import { startInterviewSchema } from "@/lib/validations";
import { createInterview } from "@/services/interview";
import { canUserStartInterview } from "@/lib/usage";

export async function startInterviewAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await rateLimitAsync(`start:${user.id}`))) {
    return { error: "Too many requests. Please try again later." };
  }

  // Server-side usage enforcement: free users get up to 3 complete interviews.
  const gate = await canUserStartInterview(user.id);
  if (!gate.allowed) {
    return {
      error: gate.reason === "has_in_progress"
        ? "You already have an interview in progress. Resume it from your dashboard."
        : "You've used all 3 free mock interviews. Upgrade your plan to continue practicing.",
      interviewId: gate.interviewId,
    };
  }

  const raw = {
    jobRole: String(formData.get("jobRole") ?? ""),
    jobDescription: String(formData.get("jobDescription") ?? ""),
    resumeText: String(formData.get("resumeText") ?? ""),
    resumeFileName: String(formData.get("resumeFileName") ?? ""),
  };

  const parsed = startInterviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const jobRole = parsed.data.jobRole ?? "";
  const jobDescription = parsed.data.jobDescription ?? "";
  const resumeText = parsed.data.resumeText ?? "";
  const resumeFileName = parsed.data.resumeFileName ?? "";
  const hasJobDescription = jobDescription.length > 0;

  let interviewId: string;
  try {
    interviewId = await createInterview({
      userId: user.id,
      setup: {
        jobRole: sanitizeInput(jobRole),
        jobDescription: sanitizeInput(jobDescription),
        resumeText: sanitizeInput(resumeText),
        resumeFileName,
      },
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to start interview.",
    };
  }

  // Free credit is consumed on COMPLETION (see respond + results paths), never
  // on start — so a failed/interrupted interview does not burn a free credit.

  const roleLabel =
    jobRole || (hasJobDescription ? "the role described in the job description" : "");

  return {
    success: true,
    interviewId,
    roleLabel,
  };
}
