import { NextRequest, NextResponse } from "next/server";
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
import {
  persistAnswerTelemetry,
  clampSpeech,
  clampVision,
} from "@/services/telemetry";
import { aiErrorPayload } from "@/lib/ai/friendly-errors";
import { consumeFreeInterview } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const startTime = Date.now();
  if (isDev) {
    console.log(`[DEBUG TIMING] API respond: Request received at ${new Date().toISOString()}`);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDev) {
    console.log(`[DEBUG TIMING] API respond: Authenticated in ${Date.now() - startTime}ms`);
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

  const dbFetchStart = Date.now();
  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, job_description, resume_file_id, status")
    .eq("id", parsed.data.interviewId)
    .maybeSingle();

  if (isDev) {
    console.log(`[DEBUG TIMING] API respond: Interview DB fetch in ${Date.now() - dbFetchStart}ms`);
  }

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
    const resumeLoadStart = Date.now();
    const { data: resumeFile } = await supabase
      .from("resume_files")
      .select("extracted_text")
      .eq("id", interview.resume_file_id)
      .maybeSingle();
    resumeContext = resumeFile?.extracted_text ?? undefined;
    if (isDev) {
      console.log(`[DEBUG TIMING] API respond: Resume context loaded in ${Date.now() - resumeLoadStart}ms`);
    }
  }

  const lastQuestionStart = Date.now();
  const { data: lastQuestion } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isDev) {
    console.log(`[DEBUG TIMING] API respond: Last question fetched in ${Date.now() - lastQuestionStart}ms`);
  }

  // Server-side idempotency key derived from trusted context (interview + the
  // question just answered). Mirrors actions/respond.ts so concurrent duplicate
  // submissions are rejected by the router's beginInFlight before budget/AI
  // dispatch — no duplicate LLM call, no leaked budget reservation.
  const respondDedupKey = lastQuestion
    ? `respond:${interview.id}:${lastQuestion.id}`
    : `respond:${interview.id}:${user.id}`;

  if (lastQuestion) {
    const saveAnswerStart = Date.now();
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
    if (isDev) {
      console.log(`[DEBUG TIMING] API respond: Answer + telemetry saved in ${Date.now() - saveAnswerStart}ms`);
    }
  }

  // Authoritative question count from the DATABASE — never the client's message
  // array. Count only MAIN questions (follow-ups don't advance the interview).
  // Hard cap at max questions: after Qmax, transition straight to completion.
  const countStart = Date.now();
  const maxQuestions = getMaxQuestions();
  const { count: dbQuestionCount } = await supabase
    .from("interview_questions")
    .select("id", { count: "exact", head: true })
    .eq("interview_id", interview.id)
    .eq("is_follow_up", false);

  if (isDev) {
    console.log(`[DEBUG TIMING] API respond: DB question count query in ${Date.now() - countStart}ms, count=${dbQuestionCount}`);
  }

  if ((dbQuestionCount ?? 0) >= maxQuestions) {
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
      console.log(`[DEBUG TIMING] API respond: Completed interview saved in ${Date.now() - completeStart}ms`);
      console.log(`[DEBUG TIMING] API respond: Total execution time ${Date.now() - startTime}ms`);
    }

    return NextResponse.json({
      message: COMPLETION_PHRASE,
      category: "problem_solving",
      isFollowUp: false,
      isComplete: true,
      questionId: lastQuestion?.id ?? "",
    });
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

  const aiStart = Date.now();
  if (isDev) {
    console.log(`[DEBUG TIMING] API respond: AI request started`);
  }
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
      dedupKey: respondDedupKey,
    });

    if (isDev) {
      console.log(`[DEBUG TIMING] API respond: AI response received in ${Date.now() - aiStart}ms`);
    }

    const isComplete = isCompletionMessage(generated.content);

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
      console.log(`[DEBUG TIMING] API respond: New question saved in ${Date.now() - insertStart}ms`);
    }

    if (questionError || !questionRow) {
      return NextResponse.json(
        { error: "Failed to save the question" },
        { status: 500 },
      );
    }

    if (isComplete) {
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
        console.log(`[DEBUG TIMING] API respond: Completing interview saved in ${Date.now() - completeStart}ms`);
      }
    }

    if (isDev) {
      console.log(`[DEBUG TIMING] API respond: Total execution time ${Date.now() - startTime}ms`);
    }

    return NextResponse.json({
      message: generated.content,
      category: generated.category,
      isFollowUp: generated.isFollowUp,
      isComplete,
      questionId: questionRow.id,
    });
  } catch (error) {
    return NextResponse.json(aiErrorPayload(error), { status: 500 });
  }
}
