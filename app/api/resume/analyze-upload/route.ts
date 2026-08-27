import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { parseResumePdf } from "@/services/resume";
import { analyzeResume } from "@/services/resume-analysis";
import { consumeResumeAnalysis, getUsageStatus } from "@/lib/usage";
import { PRO_FAIR_USE_LIMIT } from "@/lib/pricing";
import { friendlyAIErrorMessage } from "@/lib/ai/friendly-errors";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  if (!(await rateLimitAsync(`analyze:${user.id}`, 10))) {
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

    // Persist via the authenticated session client — RLS grants the owner an
    // "insertable" policy on resume_analyses, so no service-role key is needed
    // and telemetry is not silently dropped when one is absent.
    try {
      await supabase.from("resume_analyses").insert({
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