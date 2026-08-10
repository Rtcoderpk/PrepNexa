import { NextRequest, NextResponse } from "next/server";
import { confirmSubscriptionManually } from "@/lib/payments/webhook";

export const runtime = "nodejs";

/**
 * Manual payment confirmation — used after an offline payment (bank transfer,
 * JazzCash/easypaisa on manual onboarding). Requires a server-side strong
 * secret so it cannot be called by an end user to self-unlock premium.
 *
 * Body: { userId, secret }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, secret } = (body ?? {}) as {
    userId?: string;
    secret?: string;
  };
  if (!userId || !secret) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ok = await confirmSubscriptionManually({ userId, secret });
  if (!ok) {
    return NextResponse.json({ error: "Invalid confirmation secret" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}