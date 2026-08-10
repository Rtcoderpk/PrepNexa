import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { generateFeedback, saveFeedback, loadInterviewTelemetry } from "@/services/feedback";
import {
  enqueueFeedback,
  isFeedbackQueued,
} from "@/lib/feedback-queue";
import { friendlyAIErrorMessage } from "@/lib/ai/friendly-errors";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  interviewId: z.string().uuid("Invalid interview"),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(5000),
    }),
  ),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`feedback:${user.id}`, 5)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, resume_file_id, status")
    .eq("id", parsed.data.interviewId)
    .maybeSingle();

  if (interviewError || !interview) {
    return NextResponse.json(
      { error: "Interview not found" },
      { status: 404 },
    );
  }
  if (interview.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const history: Array<{ role: "user" | "assistant"; content: string }> =
    parsed.data.history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  // Queue seam: when FEEDBACK_QUEUE=redis, enqueue and return immediately; the
  // worker drains the queue and the results page reflects completion.
  if (isFeedbackQueued()) {
    const telemetry = await loadInterviewTelemetry(interview.id);

    const result = await enqueueFeedback({
      interviewId: interview.id,
      userId: user.id,
      role,
      resumeContext,
      history,
      telemetry,
    });

    if (result.queued) {
      return NextResponse.json({
        queued: true,
        jobId: result.jobId,
      });
    }
    // Fall through to inline generation if Redis is unavailable.
  }

  try {
    const telemetry = await loadInterviewTelemetry(interview.id);
    const report = await generateFeedback({
      role,
      resumeContext,
      history,
      telemetry,
      userId: user.id,
    });

    await saveFeedback({
      interviewId: interview.id,
      userId: user.id,
      report,
    });

    return NextResponse.json({ feedback: report });
  } catch (error) {
    return NextResponse.json(
      {
        error: friendlyAIErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
