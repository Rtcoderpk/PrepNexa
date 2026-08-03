import { createClient } from "@/lib/supabase/server";

export interface ResultsData {
  interview: {
    id: string;
    job_role: string | null;
    status: "in_progress" | "completed";
    overall_score: number | null;
    summary: string | null;
    strengths: string[] | null;
    areas_to_improve: string[] | null;
    created_at: string;
    completed_at: string | null;
  };
  questions: Array<{
    id: string;
    question: string;
    answer: string | null;
    score: number | null;
    feedback: string | null;
    category: string;
    is_follow_up: boolean;
    created_at: string;
  }>;
}

export async function getResults(interviewId: string): Promise<ResultsData | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: interview, error } = await supabase
    .from("interviews")
    .select(
      "id, job_role, status, overall_score, summary, strengths, areas_to_improve, created_at, completed_at",
    )
    .eq("id", interviewId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !interview) return null;

  const { data: questions } = await supabase
    .from("interview_questions")
    .select(
      "id, question, answer, score, feedback, category, is_follow_up, created_at",
    )
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  return {
    interview,
    questions: questions ?? [],
  };
}
