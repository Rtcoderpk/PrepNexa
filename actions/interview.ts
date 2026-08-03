"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/security";
import { startInterviewSchema } from "@/lib/validations";
import { createInterview } from "@/services/interview";

export async function startInterviewAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!rateLimit(`start:${user.id}`)) {
    return { error: "Too many requests. Please try again later." };
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

  try {
    const interviewId = await createInterview({
      userId: user.id,
      setup: {
        jobRole: sanitizeInput(jobRole),
        jobDescription: sanitizeInput(jobDescription),
        resumeText: sanitizeInput(resumeText),
        resumeFileName,
      },
    });
    redirect(
      `/interview/${interviewId}?role=${encodeURIComponent(
        jobRole ||
          (hasJobDescription ? "the role described in the job description" : ""),
      )}`,
    );
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to start interview.",
    };
  }
}
