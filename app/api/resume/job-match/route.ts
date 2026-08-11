import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/rate-limit";
import { z } from "zod";
import { matchResumeToJob } from "@/services/resume-analysis";
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
      const admin = createAdminClient();
      await admin.from("resume_analyses").insert({
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
        error:
          error instanceof Error
            ? error.message
            : "We couldn't match your resume right now. Please try again.",
      },
      { status: 500 },
    );
  }
}