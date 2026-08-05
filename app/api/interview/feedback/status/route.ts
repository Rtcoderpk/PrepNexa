import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFeedbackJobDone } from "@/lib/feedback-queue";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  jobId: z.string().min(1).max(128),
});

/**
 * Polled by the interview chat when feedback was enqueued (FEEDBACK_QUEUE=redis).
 * Returns { done: boolean } once the worker has persisted the report.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
  const parsed = querySchema.safeParse({ jobId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  const done = await isFeedbackJobDone(parsed.data.jobId);

  // Jobs that only exist in memory fall through to "done" (fallback path).
  return NextResponse.json({ done });
}