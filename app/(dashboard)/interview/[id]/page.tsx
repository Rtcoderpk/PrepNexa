import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InterviewChat } from "@/components/interview/interview-chat";
import { getMaxQuestions } from "@/services/interview";

export const metadata: Metadata = {
  title: "Live Interview",
};

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, user_id, job_role, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !interview || interview.user_id !== user.id) {
    notFound();
  }

  if (interview.status === "completed") {
    redirect(`/interview/${id}/results`);
  }

  // Load existing questions (in case of refresh)
  const { data: questions } = await supabase
    .from("interview_questions")
    .select("id, question, category, answer, is_follow_up, created_at")
    .eq("interview_id", id)
    .order("created_at", { ascending: true });

  const existingQuestions =
    questions?.map((q) => ({
      id: q.id,
      question: q.question,
      category: q.category,
      answer: q.answer,
      is_follow_up: q.is_follow_up,
      created_at: q.created_at,
    })) ?? [];

  return (
    <InterviewChat
      info={{
        id: interview.id,
        jobRole: interview.job_role,
      }}
      initialQuestions={existingQuestions}
      maxQuestions={getMaxQuestions()}
    />
  );
}
