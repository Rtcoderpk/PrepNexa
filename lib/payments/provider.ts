import { PRO_MONTHLY_PRICE_PKR } from "@/lib/pricing";
import { createSafepayCheckout } from "@/lib/payments/safepay";

/**
 * Provider-independent payment architecture. No UI component or business
 * logic calls a payment SDK directly — everything goes through this seam, so
 * the payment provider can be swapped (Safepay primary, JazzCash, easypaisa,
 * Stripe, etc.) without touching the rest of the app.
 *
 * Current providers:
 *  - safepay (PRIMARY) — Pakistani + international card payments. See lib/payments/safepay.ts.
 *  - stripe   — parity path for international-first setups.
 *  - manual   — offline/closed-beta activation via a shared secret.
 *  - jazzcash / easypaisa — future additive providers via this same interface.
 */

export interface CreateCheckoutParams {
  userId: string;
  email: string;
  plan: "pro";
  /** Price in PKR — sourced centrally from lib/pricing. */
  amountPkr: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Provider-side checkout session/order id. */
  sessionId: string;
  /** URL the user is redirected to in order to pay. */
  checkoutUrl: string;
  provider: string;
}

/**
 * Creates a checkout session on the configured provider.
 * The provider is chosen from env (PAYMENT_PROVIDER). When no real provider is
 * configured, a "manual" mode returns a placeholder URL — useful for closed
 * beta / manual onboarding until a gateway is connected.
 *
 * IMPORTANT: Payment success must ALWAYS be verified server-side via the
 * webhook handler (lib/payments/webhook.ts). Never trust the frontend.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<CheckoutSession> {
  const provider = process.env.PAYMENT_PROVIDER ?? "manual";

  switch (provider) {
    case "stripe": {
      return createStripeCheckout(params);
    }
    case "safepay": {
      const session = await createSafepayCheckout({
        userId: params.userId,
        amountPkr: params.amountPkr,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      });
      return session;
    }
    case "manual":
    default: {
      // Manual mode — simulate a session so the flow is testable end-to-end.
      return {
        sessionId: `manual_${crypto.randomUUID()}`,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/checkout/manual/${params.userId}?plan=${params.plan}&amount=${params.amountPkr}`,
        provider: "manual",
      };
    }
  }
}

async function createStripeCheckout(
  params: CreateCheckoutParams,
): Promise<CheckoutSession> {
  const StripeModule = await import("stripe");
  const Stripe = StripeModule.default;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.email,
    line_items: [
      {
        price_data: {
          currency: "pkr",
          product_data: { name: "PrepNexa Pro" },
          unit_amount: params.amountPkr * 100,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: { userId: params.userId, plan: params.plan },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url ?? params.successUrl,
    provider: "stripe",
  };
}

export function getPaymentProvider(): string {
  return process.env.PAYMENT_PROVIDER ?? "manual";
}

export { PRO_MONTHLY_PRICE_PKR };