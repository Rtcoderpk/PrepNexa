import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  const message = "PrepNexa Sentry smoke test: sample server error";
  Sentry.captureException(new Error(message));
  return NextResponse.json({
    ok: true,
    message,
    sentryEnabled: Boolean(process.env.SENTRY_DSN),
  });
}
