import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/security";
import { startInterviewSchema } from "@/lib/validations";
import { createInterview } from "@/services/interview";
import { canUserStartInterview, consumeFreeInterview } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`start:${user.id}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  // Server-side usage enforcement.
  const gate = await canUserStartInterview(user.id);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error:
          gate.reason === "has_in_progress"
            ? "You already have an interview in progress."
            : "You've used your free interview. Upgrade to PrepNexa Pro to keep practicing.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startInterviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.errors[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  try {
    const jobRole = parsed.data.jobRole ?? "";
    const jobDescription = parsed.data.jobDescription ?? "";
    const resumeText = parsed.data.resumeText ?? "";
    const resumeFileName = parsed.data.resumeFileName ?? "";

    const interviewId = await createInterview({
      userId: user.id,
      setup: {
        jobRole: sanitizeInput(jobRole),
        jobDescription: sanitizeInput(jobDescription),
        resumeText: sanitizeInput(resumeText),
        resumeFileName,
      },
    });

    try {
      await consumeFreeInterview(user.id);
    } catch {
      // Never block interview start on quota bookkeeping.
    }

    return NextResponse.json({ interviewId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start interview.",
      },
      { status: 500 },
    );
  }
}
