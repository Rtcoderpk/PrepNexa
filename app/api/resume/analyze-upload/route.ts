import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { parseResumePdf } from "@/services/resume";
import { analyzeResume } from "@/services/resume-analysis";
import { consumeResumeAnalysis, getUsageStatus } from "@/lib/usage";
import { PRO_FAIR_USE_LIMIT } from "@/lib/pricing";
import { friendlyAIErrorMessage } from "@/lib/ai/friendly-errors";

export const runtime = "nodejs";

/**
 * Server-side resume upload + analysis. Parses the PDF (server-side, where
 * pdf-parse can access Node APIs), runs the cloud AI analysis, enforces the
 * free-trial quota, and persists a report record.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`analyze:${user.id}`, 10)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  // Enforce the free-trial quota server-side.
  const status = await getUsageStatus(user.id);
  if (!status.isPremium && status.resumeAnalysisCount >= status.resumeCheckLimit) {
    return NextResponse.json(
      {
        error:
          "You've used all your free resume checks. Upgrade to PrepNexa Pro to keep analyzing.",
        limitReached: true,
      },
      { status: 403 },
    );
  }

  try {
    const parsed = await parseResumePdf(file);
    const result = await analyzeResume(parsed.text, user.id);

    const { count } = await consumeResumeAnalysis(user.id);

    try {
      const admin = createAdminClient();
      await admin.from("resume_analyses").insert({
        user_id: user.id,
        ats_score: result.atsScore,
        quality_score: result.qualityScore,
        has_job_description: false,
        report: result.raw as unknown as Record<string, unknown>,
      });
    } catch {
      // Non-critical persistence.
    }

    return NextResponse.json({
      ...result,
      fileName: parsed.fileName,
      remainingChecks: status.isPremium
        ? PRO_FAIR_USE_LIMIT
        : Math.max(0, status.resumeCheckLimit - count),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: friendlyAIErrorMessage(error),
      },
      { status: 500 },
    );
  }
}