import { createAdminClient } from "@/lib/supabase/admin";
import { verifySafepayWebhook } from "@/lib/payments/safepay";

/**
 * Webhook verification for payment events. This is where payment success is
 * CONFIRMED server-side — the frontend can never unlock premium on its own.
 * Verification is provider-specific:
 *  - Safepay (primary): HMAC-SHA512 signature in the `X-SFPY-SIGNATURE` header.
 *  - Stripe: signature validation via the SDK.
 *  - Manual mode: a shared secret header shared between the provider and us.
 *
 * Each handler returns a normalized SubscriptionConfirmation that the
 * subscription service applies to the database.
 */

export interface SubscriptionConfirmation {
  userId: string;
  plan: "pro";
  status: "active" | "cancelled" | "expired" | "past_due" | "trialing";
  provider: string;
  transactionId?: string;
  startDate: string;
  expiryDate?: string;
}

/** Verifies a webhook payload and returns the subscription confirmation. */
export async function handlePaymentWebhook(params: {
  provider: string;
  /** Raw request body (stringified). */
  rawBody: string;
  /** Provider signature headers relevant to the provider. */
  signature?: string | null;
  /** For manual mode: the shared secret proving the payment was confirmed. */
  manualSecret?: string;
}): Promise<SubscriptionConfirmation | null> {
  if (params.provider === "safepay") {
    return verifySafepayWebhookFlow(
      params.rawBody,
      params.signature ?? undefined,
    );
  }

  if (params.provider === "stripe") {
    return verifyStripeWebhook(params.rawBody, params.signature ?? undefined);
  }

  if (params.provider === "manual") {
    return verifyManualWebhook(params.manualSecret);
  }

  return null;
}

/**
 * Verifies a Safepay webhook event and maps it to a SubscriptionConfirmation.
 * Only `payment.succeeded` activates premium; anything else returns null. The
 * tracker.token is used as the transaction id so replayed/duplicate events are
 * de-duplicated by the caller (activateSubscription) against payment_transactions.
 */
async function verifySafepayWebhookFlow(
  rawBody: string,
  signature: string | undefined,
): Promise<SubscriptionConfirmation | null> {
  const event = verifySafepayWebhook(rawBody, signature);
  if (!event) return null;

  if (event.type !== "payment.succeeded") return null;

  // The tracker token is our transaction id. Missing => can't tie to a checkout.
  const transactionId = event.trackerToken;
  if (!transactionId) return null;

  // userId comes from the metadata we attached at session creation. Without it
  // we cannot safely activate.
  if (!event.userId) return null;

  return {
    userId: event.userId,
    plan: "pro",
    status: "active",
    provider: "safepay",
    transactionId,
    startDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function verifyStripeWebhook(
  rawBody: string,
  signature: string | undefined,
): Promise<SubscriptionConfirmation | null> {
  const StripeModule = await import("stripe");
  const Stripe = StripeModule.default;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  let event: { type: string; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    ) as { type: string; data: { object: unknown } };
  } catch {
    // Invalid signature — not authenticated.
    return null;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { userId?: string; plan?: string };
      payment_intent?: string;
    };
    const userId = session.metadata?.userId;
    if (!userId) return null;

    return {
      userId,
      plan: "pro",
      status: "active",
      provider: "stripe",
      transactionId: session.payment_intent ?? undefined,
      startDate: new Date().toISOString(),
      // Stripe default: 30-day monthly cycle.
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  // Subscription cancellation / failure handling can be added here.
  return null;
}

async function verifyManualWebhook(
  manualSecret: string | undefined,
): Promise<SubscriptionConfirmation | null> {
  const expected = process.env.MANUAL_PAYMENT_SECRET;
  if (!expected || manualSecret !== expected) return null;

  return {
    userId: "pending-verification",
    plan: "pro",
    status: "active",
    provider: "manual",
    startDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Manual confirmation path used by a trusted admin callback (e.g. after an
 * offline payment). Requires a server-side strong secret — never callable from
 * the browser directly without it.
 */
export async function confirmSubscriptionManually(params: {
  userId: string;
  secret: string;
}): Promise<boolean> {
  const expected = process.env.MANUAL_PAYMENT_SECRET;
  if (!expected || params.secret !== expected) return false;

  const admin = createAdminClient();
  await admin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      plan: "pro",
      status: "active",
      provider: "manual",
      transaction_id: `manual_${crypto.randomUUID()}`,
      start_date: new Date().toISOString(),
      expiry_date: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    { onConflict: "user_id" },
  );
  await admin.from("profiles").update({ is_premium: true }).eq("id", params.userId);
  return true;
}

export function isPaymentProviderConfigured(): boolean {
  const provider = process.env.PAYMENT_PROVIDER ?? "manual";
  if (provider === "stripe") {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  }
  if (provider === "safepay") {
    return Boolean(
      process.env.SAFEPAY_SECRET_KEY &&
        process.env.SAFEPAY_PUBLIC_KEY &&
        process.env.SAFEPAY_WEBHOOK_SECRET,
    );
  }
  return true; // manual always "configured"
}