import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/payments/provider";
import { PRO_MONTHLY_PRICE_PKR } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Creates a payment checkout session for PrepNexa Pro.
 * Returns a redirect URL the client navigates to. Actual premium activation
 * is confirmed ONLY via the webhook (POST /api/payments/webhook).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? "",
      plan: "pro",
      amountPkr: PRO_MONTHLY_PRICE_PKR,
      successUrl: `${appUrl}/dashboard?upgraded=true`,
      cancelUrl: `${appUrl}/pricing`,
    });
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start checkout. Please try again.",
      },
      { status: 500 },
    );
  }
}