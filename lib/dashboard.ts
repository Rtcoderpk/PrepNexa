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
  skillAverages: {
    technical: number | null;
    communication: number | null;
    confidence: number | null;
    grammar: number | null;
    speakingSpeed: number | null;
    eyeContact: number | null;
    bodyLanguage: number | null;
  };
  confidenceTrend: Array<{
    label: string;
    score: number | null;
  }>;
  weeklyTrend: Array<{
    label: string;
    interviews: number;
    averageScore: number | null;
  }>;
  monthlyTrend: Array<{
    label: string;
    interviews: number;
    averageScore: number | null;
  }>;
  resumeHistory: Array<{
    id: string;
    file_name: string;
    created_at: string;
    interview_count: number;
  }>;
}

const SKILL_COLUMNS = [
  "technical_score",
  "communication_score",
  "confidence_score",
  "grammar_score",
  "speaking_speed_score",
  "eye_contact_score",
  "body_language_score",
] as const;

type SkillRow = Record<(typeof SKILL_COLUMNS)[number], number | null>;

export function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((s, v) => s + v, 0) / present.length) * 10) / 10;
}

function averageScoreOf(rows: Array<{ overall_score: number | null }>): number | null {
  return average(rows.map((r) => r.overall_score));
}

function bucketLabel(intervalStart: Date, intervalUnit: "week" | "month"): string {
  return intervalStart.toLocaleDateString("en-US", {
    ...(intervalUnit === "week" ? { month: "short", day: "numeric" } : { month: "short", year: "numeric" }),
  });
}

/** Starting point of the week/month an ISO timestamp belongs to. */
export function intervalStart(iso: string, unit: "week" | "month"): Date {
  const d = new Date(iso);
  if (unit === "week") {
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
  } else {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Build a contiguous date-axis series (oldest first) of interviews per interval. */
export function buildSeries(
  rows: Array<{ created_at: string; overall_score: number | null }>,
  unit: "week" | "month",
  buckets: number,
  now = new Date(),
): Array<{ label: string; interviews: number; averageScore: number | null }> {
  const start = new Date(now);
  if (unit === "week") start.setDate(start.getDate() - (buckets - 1) * 7);
  else start.setMonth(start.getMonth() - (buckets - 1));

  const series = new Map<string, Array<{ overall_score: number | null }>>();
  const cursor = intervalStart(start.toISOString(), unit);
  for (let i = 0; i < buckets; i++) {
    series.set(cursor.toISOString(), []);
    if (unit === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const row of rows) {
    const key = intervalStart(row.created_at, unit).toISOString();
    const bucket = series.get(key);
    if (bucket) bucket.push(row);
  }

  return Array.from(series.entries()).map(([key, bucketRows]) => ({
    label: bucketLabel(new Date(key), unit),
    interviews: bucketRows.length,
    averageScore: averageScoreOf(bucketRows),
  }));
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
    .select(
      "id, job_role, status, overall_score, created_at, technical_score, communication_score, confidence_score, grammar_score, speaking_speed_score, eye_contact_score, body_language_score, resume_file_id",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

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

  const skillAverages = {
    technical: average(completed.map((i) => (i as SkillRow).technical_score)),
    communication: average(completed.map((i) => (i as SkillRow).communication_score)),
    confidence: average(completed.map((i) => (i as SkillRow).confidence_score)),
    grammar: average(completed.map((i) => (i as SkillRow).grammar_score)),
    speakingSpeed: average(completed.map((i) => (i as SkillRow).speaking_speed_score)),
    eyeContact: average(completed.map((i) => (i as SkillRow).eye_contact_score)),
    bodyLanguage: average(completed.map((i) => (i as SkillRow).body_language_score)),
  };

  const confidenceTrend = [...interviews]
    .reverse()
    .filter((i) => i.status === "completed")
    .slice(-10)
    .map((i) => ({
      label: new Date(i.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: (i as SkillRow).confidence_score,
    }));

  const weeklyTrend = buildSeries(completed, "week", 12);
  const monthlyTrend = buildSeries(completed, "month", 6);

  const resumeRows = await fetchResumeHistory(supabase, user.id, interviews);

  return {
    totalInterviews: interviews.length,
    completedInterviews: completed.length,
    averageScore,
    inProgressCount: interviews.length - completed.length,
    recentActivity: interviews.slice(0, 8),
    scoreTrend,
    skillAverages,
    confidenceTrend,
    weeklyTrend,
    monthlyTrend,
    resumeHistory: resumeRows,
  };
}

async function fetchResumeHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  interviews: Array<{ resume_file_id: string | null }>,
): Promise<DashboardStats["resumeHistory"]> {
  const { data: resumes, error } = await supabase
    .from("resume_files")
    .select("id, file_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !resumes) return [];

  const usage = new Map<string, number>();
  for (const interview of interviews) {
    if (interview.resume_file_id) {
      usage.set(interview.resume_file_id, (usage.get(interview.resume_file_id) ?? 0) + 1);
    }
  }

  return resumes.map((r) => ({
    id: r.id,
    file_name: r.file_name,
    created_at: r.created_at,
    interview_count: usage.get(r.id) ?? 0,
  }));
}
