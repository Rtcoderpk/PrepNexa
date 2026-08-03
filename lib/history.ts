import { createClient } from "@/lib/supabase/server";

export interface HistoryItem {
  id: string;
  job_role: string | null;
  status: "in_progress" | "completed";
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export async function getInterviewHistory(): Promise<HistoryItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("interviews")
    .select(
      "id, job_role, status, overall_score, created_at, completed_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];

  return data as HistoryItem[];
}
