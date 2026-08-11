import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { sanitizeAnswer } from "@/lib/security";
import { respondInterviewSchema, respondTelemetrySchema } from "@/lib/validations";
import { generateNextQuestion, isCompletionMessage } from "@/services/interview";
import {
  persistAnswerTelemetry,
  clampSpeech,
  clampVision,
} from "@/services/telemetry";
import { friendlyAIErrorMessage } from "@/lib/ai/friendly-errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await rateLimitAsync(`respond:${user.id}`, 30))) {
    return NextResponse.json(
      { error: "You are sending messages too quickly. Please slow down." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = respondInterviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Optional per-answer telemetry (vision + speech). Invalidly-shaped metrics
  // are rejected rather than silently dropped.
  const bodyObject = (body as Record<string, unknown>) ?? {};
  const telemetryParsed = respondTelemetrySchema.safeParse(
    bodyObject.telemetry ?? {},
  );
  if (!telemetryParsed.success) {
    return NextResponse.json(
      { error: "Invalid analysis payload" },
      { status: 400 },
    );
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, job_description, resume_file_id, status")
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
  if (interview.status !== "in_progress") {
    return NextResponse.json(
      { error: "This interview has already ended" },
      { status: 409 },
    );
  }

  let answer: string;
  try {
    answer = sanitizeAnswer(parsed.data.answer);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  let resumeContext: string | undefined;
  if (interview.resume_file_id) {
    const { data: resumeFile } = await supabase
      .from("resume_files")
      .select("extracted_text")
      .eq("id", interview.resume_file_id)
      .maybeSingle();
    resumeContext = resumeFile?.extracted_text ?? undefined;
  }

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

    // Persist the analysis for the question just answered.
    const { speech, vision } = telemetryParsed.data;
    if (speech || vision) {
      await persistAnswerTelemetry({
        questionId: lastQuestion.id,
        speech: speech ? clampSpeech(speech) : undefined,
        vision: vision ? clampVision(vision) : undefined,
      });
    }
  }

  const previousMessages = Array.isArray(body)
    ? []
    : ((body as any)?.messages ?? []);

  const assistantCount = previousMessages.filter(
    (m: any) => m.role === "assistant",
  ).length;

  const lastMessage = previousMessages[previousMessages.length - 1];
  const isFollowUp =
    !lastMessage?.isFollowUp &&
    (answer.trim().split(/\s+/).length < 15 ||
      /^(yes|no|yep|nope|maybe|i don'?t know|i think so|not sure|ok|okay|alright)\b/i.test(
        answer.trim(),
      )) &&
    assistantCount < 8;

  try {
    const generated = await generateNextQuestion({
      role: interview.job_role ?? undefined,
      resumeContext,
      history: previousMessages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        category: m.category,
      })),
      isFollowUp,
      userId: user.id,
    });

    const isComplete = isCompletionMessage(generated.content);

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
      return NextResponse.json(
        { error: "Failed to save the question" },
        { status: 500 },
      );
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

    return NextResponse.json({
      message: generated.content,
      category: generated.category,
      isFollowUp: generated.isFollowUp,
      isComplete,
      questionId: questionRow.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: friendlyAIErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
