import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseFeedbackJson } from "@/lib/feedback";
import { generateFeedback } from "@/services/gemini";
import { feedbackSchema } from "@/lib/validations";
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
    .select("id, user_id, job_role, status")
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

  const conversationHistory = parsed.data.history.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    content: m.content,
  }));

  let result: unknown = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateFeedback({
        role,
        history: conversationHistory,
      });
      const feedback = parseFeedbackJson(raw);
      const validated = feedbackSchema.safeParse(feedback);
      if (validated.success) {
        result = validated.data;
        break;
      }
      lastError = new Error("Feedback failed validation");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Feedback failed");
    }
  }

  if (!result) {
    return NextResponse.json(
      { error: lastError?.message ?? "Failed to generate feedback" },
      { status: 500 },
    );
  }

  const feedback = result as z.infer<typeof feedbackSchema>;

  const { data: storedQuestions } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  if (storedQuestions) {
    for (const note of feedback.per_question_notes) {
      const match = storedQuestions.find(
        (q) =>
          q.question.trim().toLowerCase() ===
            note.question.trim().toLowerCase() && note.score !== undefined,
      );
      if (match) {
        await supabase
          .from("interview_questions")
          .update({ score: note.score, feedback: note.feedback })
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

  return NextResponse.json({ feedback });
}
