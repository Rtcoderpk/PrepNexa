import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { generateOpeningQuestion } from "@/services/interview";
import { aiErrorPayload } from "@/lib/ai/friendly-errors";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  interviewId: z.string().uuid("Invalid interview"),
});

export async function POST(request: NextRequest) {
  // Whole-handler guard: ANY unexpected throw must still return JSON.
  try {
    return await handlePost(request);
  } catch (error) {
    return NextResponse.json(aiErrorPayload(error), { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await rateLimitAsync(`opening:${user.id}`, 10))) {
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
  if (interview.status !== "in_progress") {
    return NextResponse.json(
      { error: "This interview has already ended" },
      { status: 409 },
    );
  }

  // If an opening question already exists, return it instead of asking again.
  const { data: existing } = await supabase
    .from("interview_questions")
    .select("id, question, category")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      message: existing.question,
      category: existing.category,
      questionId: existing.id,
    });
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

  try {
    const { content, category } = await generateOpeningQuestion({
      role: interview.job_role ?? undefined,
      resumeContext,
      history: [],
      totalQuestions: 5,
      userId: user.id,
    });

    const { data: questionRow, error: questionError } = await supabase
      .from("interview_questions")
      .insert({
        interview_id: interview.id,
        user_id: user.id,
        category,
        question: content,
      })
      .select("id")
      .single();

    if (questionError || !questionRow) {
      return NextResponse.json(
        { error: "Failed to save the opening question" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: content,
      category,
      questionId: questionRow.id,
    });
  } catch (error) {
    return NextResponse.json(aiErrorPayload(error), { status: 500 });
  }
}
