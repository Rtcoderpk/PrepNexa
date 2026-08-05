import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainFeedbackQueue } from "@/lib/feedback-queue";
import { generateFeedback, saveFeedback } from "@/services/feedback";

export const runtime = "nodejs";
export const maxDuration = 60;

const WORKER_SECRET = process.env.FEEDBACK_WORKER_SECRET;

/**
 * Drains the feedback queue one job at a time. Invoke as a cron/interval
 * (Vercel Cron, a container loop, or PM2) so feedback generation runs
 * off the request path. Protected by FEEDBACK_WORKER_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!WORKER_SECRET || request.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cron/worker context: no user session, so writes must bypass RLS via the
  // service-role client. saveFeedback scopes rows by interview ownership on its own.
  const admin = createAdminClient();
  const processed = await drainFeedbackQueue(async (job) => {
    const report = await generateFeedback({
      role: job.role ?? undefined,
      resumeContext: job.resumeContext,
      history: job.history,
      telemetry: job.telemetry,
    });
    await saveFeedback(
      {
        interviewId: job.interviewId,
        userId: job.userId,
        report,
      },
      admin,
    );
  });

  return NextResponse.json({ processed });
}
