import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number | null;
  inProgressCount: number;
  recentActivity: Array<{
    id: string;
    job_role: string | null;
    status: "in_progress" | "completed";
    overall_score: number | null;
    created_at: string;
  }>;
  scoreTrend: Array<{
    label: string;
    score: number;
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: interviews, error } = await supabase
    .from("interviews")
    .select("id, job_role, status, overall_score, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error("Failed to load dashboard");
  }

  const completed = interviews.filter((i) => i.status === "completed");
  const withScores = completed.filter(
    (i) => i.overall_score !== null,
  ) as Array<{ overall_score: number }>;

  const averageScore =
    withScores.length > 0
      ? Math.round(
          (withScores.reduce((sum, i) => sum + i.overall_score, 0) /
            withScores.length) *
            10,
        ) / 10
      : null;

  const scoreTrend = [...interviews]
    .reverse()
    .filter((i) => i.status === "completed" && i.overall_score !== null)
    .slice(-10)
    .map((i) => ({
      label: new Date(i.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: i.overall_score as number,
    }));

  return {
    totalInterviews: interviews.length,
    completedInterviews: completed.length,
    averageScore,
    inProgressCount: interviews.length - completed.length,
    recentActivity: interviews.slice(0, 8),
    scoreTrend,
  };
}
