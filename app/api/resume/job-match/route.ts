import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { z } from "zod";
import { matchResumeToJob } from "@/services/resume-analysis";
import { friendlyAIErrorMessage } from "@/lib/ai/friendly-errors";
import { getUsageStatus } from "@/lib/usage";

export const runtime = "nodejs";

const requestSchema = z.object({
  resumeText: z.string().trim().min(50).max(15000),
  jobDescription: z.string().trim().min(20).max(10000),
});

/**
 * Match a resume against a job description. Premium feature (free users get a
 * limited preview). Enforced server-side.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await rateLimitAsync(`jobmatch:${user.id}`, 10))) {
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

  const status = await getUsageStatus(user.id);
  if (!status.isPremium) {
    return NextResponse.json(
      {
        error:
          "Job description matching is a PrepNexa Pro feature. Upgrade to use it.",
      },
      { status: 403 },
    );
  }

  try {
    const result = await matchResumeToJob(
      parsed.data.resumeText,
      parsed.data.jobDescription,
      user.id,
    );

    try {
      // Session client — RLS allows the owner to insert resume_analyses, so no
      // service-role key is required and telemetry is not silently dropped.
      await supabase.from("resume_analyses").insert({
        user_id: user.id,
        job_match_score: result.match_score,
        has_job_description: true,
        report: result as unknown as Record<string, unknown>,
      });
    } catch {
      // Non-critical persistence.
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: friendlyAIErrorMessage(error),
        // Surface the AI budget-limit case so the client can show a specific
        // message instead of the generic "temporarily busy" text.
        budgetLimit: isAiBudgetLimitError(error),
      },
      { status: 500 },
    );
  }
}

/** True when the error is the per-user AI budget rejection. */
function isAiBudgetLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("AI usage limit");
}