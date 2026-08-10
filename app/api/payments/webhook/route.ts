import { NextRequest, NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import { activateSubscription } from "@/lib/payments/subscription";

export const runtime = "nodejs";

/**
 * Payment webhook — the ONLY place premium is activated. Never trust the
 * frontend's "payment successful" state. Stripe signs the request; manual mode
 * requires a shared secret header.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // For manual mode the "provider" is inferred from the header/query.
  const providerHeader = request.headers.get("x-payment-provider") ?? process.env.PAYMENT_PROVIDER ?? "manual";
  const signature =
    request.headers.get("x-sfpy-signature") ??
    request.headers.get("stripe-signature");
  const manualSecret = request.headers.get("x-manual-secret");

  try {
    const confirmation = await handlePaymentWebhook({
      provider: providerHeader,
      rawBody,
      signature: signature ?? undefined,
      manualSecret: manualSecret ?? undefined,
    });

    if (!confirmation) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Manual mode confirmation needs a real userId — it's derived separately
    // by confirmSubscriptionManually; the webhook here requires a userId.
    if (providerHeader === "manual") {
      const body = rawBody ? JSON.parse(rawBody).userId : null;
      if (!body) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }
      confirmation.userId = body;
    }

    await activateSubscription(confirmation);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}