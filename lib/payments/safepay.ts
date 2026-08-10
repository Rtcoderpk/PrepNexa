import crypto from "node:crypto";
import Safepay from "@sfpy/node-core";

/**
 * Safepay integration (primary payment provider for PrepNexa Pro).
 *
 * Flow: create a payment session, get a client auth token (passport), build the
 * hosted checkout URL, redirect the shopper. Premium is activated ONLY from the
 * webhook, verified with an HMAC-SHA512 signature (see verifySafepayWebhook).
 *
 * Covers the official "Express Checkout" flow. Reference:
 *   - Integration guide: https://safepay-docs.netlify.app/build-your-integration/express-checkout
 *   - SDK: @sfpy/node-core (secret key auth)
 *
 * Merchant credentials come from env — never from the client. Until a verified
 * Safepay merchant account is provisioned, code runs against the sandbox.
 */

export type SafepayEnv = "sandbox" | "production";

function getSafepayEnv(): SafepayEnv {
  return process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox";
}

function getSafepayHost(env: SafepayEnv): string {
  return env === "production"
    ? "https://api.getsafepay.com"
    : "https://sandbox.api.getsafepay.com";
}

function getClient() {
  const secretKey = process.env.SAFEPAY_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SAFEPAY_SECRET_KEY is not configured. Get it from the Safepay dashboard (Developers → API keys).",
    );
  }
  return new Safepay(secretKey, {
    authType: "secret",
    host: getSafepayHost(getSafepayEnv()),
    timeout: 30000,
  });
}

export interface SafepayCheckoutParams {
  userId: string;
  /** Price in PKR (whole rupees) — converted to lowest denomination by Safepay. */
  amountPkr: number;
  successUrl: string;
  cancelUrl: string;
}

export interface SafepayCheckout {
  /** The Safepay tracker — the payment session id. Used to match webhooks. */
  sessionId: string;
  trackerToken: string;
  checkoutUrl: string;
  provider: "safepay";
}

/**
 * Creates a Safepay checkout session (Express Checkout) and returns the hosted
 * checkout URL to redirect the shopper to. Server-side only.
 *
 * Reference implementation of the two documented API requests + checkout URL:
 *   1. POST /order/payments/v3/   (payment session)
 *   2. POST /client/passport/v1/token (client auth token)
 *   3. safepay.checkout.createCheckoutUrl(...)
 */
export async function createSafepayCheckout(
  params: SafepayCheckoutParams,
): Promise<SafepayCheckout> {
  const env = getSafepayEnv();
  const safepay = getClient();

  const session = await safepay.payments.session.setup({
    merchant_api_key: process.env.SAFEPAY_PUBLIC_KEY,
    intent: "CYBERSOURCE",
    mode: "payment",
    currency: "PKR",
    amount: params.amountPkr * 100,
    metadata: { userId: params.userId },
  });

  const trackerToken = session?.data?.tracker?.token as string | undefined;
  if (!trackerToken) {
    throw new Error(
      "Safepay did not return a payment tracker. Check SAFEPAY_PUBLIC_KEY / account status.",
    );
  }

  const passport = await safepay.client.passport.create();
  const authToken = passport?.data as string | undefined;
  if (!authToken) {
    throw new Error("Safepay did not return a client auth token.");
  }

  const checkoutUrl = safepay.checkout.createCheckoutUrl({
    env: env === "production" ? "production" : "sandbox",
    tbt: authToken,
    tracker: trackerToken,
    source: "hosted",
    user_id: params.userId,
    redirect_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return {
    sessionId: trackerToken,
    trackerToken,
    checkoutUrl,
    provider: "safepay",
  };
}

/**
 * Verifies a Safepay webhook event. Safepay signs the raw body with an HMAC-SHA512
 * using the endpoint's shared secret, and sends it in the `X-SFPY-SIGNATURE` header.
 * Returns the parsed event, or null when the signature does not verify.
 */
export interface SafepayWebhookEvent {
  type: string;
  /** The payment session id — used to dedupe / link to the checkout. */
  trackerToken?: string;
  userId?: string;
  /** Amount in lowest denomination (paise). */
  amount?: number;
  currency?: string;
}

function hmacEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifySafepayWebhook(
  rawBody: string,
  signature: string | null | undefined,
): SafepayWebhookEvent | null {
  const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return null;

  // Docs verify the signature against the JSON-stringified payload.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const digest = crypto.createHmac("sha512", secret).update(data).digest("hex");
  if (!hmacEqual(digest, signature)) return null;

  return parseSafepayEvent(payload);
}

/**
 * Parses a Safepay webhook payload into a normalized event (exported for tests).
 *
 * Verified payload shape (safepay-docs.netlify.app/developers/webhooks/webhook-types):
 *   { token, version, merchant_api_key, type, endpoint,
 *     data: { tracker, intent, state, net, fee, customer_email,
 *             amount, currency, metadata, charged_at }, created_at }
 * - `tracker` is a PLAIN STRING (the payment session id), not an object.
 * - Merchant metadata (our userId) is echoed inside `data.metadata`.
 * - `customer_email` is available as a fallback for resolving the user.
 */
export function parseSafepayEvent(payload: unknown): SafepayWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const event = payload as Record<string, unknown>;
  const type = typeof event.type === "string" ? event.type : "";

  const data = event.data as Record<string, unknown> | undefined;
  const dataObj = data && typeof data === "object" ? data : {};

  // tracker is a plain string session id.
  const tracker = dataObj.tracker ?? event.tracker;
  const amount = dataObj.amount ?? event.amount;
  const currency = dataObj.currency ?? event.currency;

  // userId comes from the metadata we attached at session creation.
  const metadata =
    dataObj.metadata && typeof dataObj.metadata === "object"
      ? (dataObj.metadata as Record<string, unknown>)
      : {};
  const customerEmail = dataObj.customer_email;

  return {
    type,
    trackerToken: typeof tracker === "string" ? tracker : undefined,
    userId:
      (typeof metadata.userId === "string" ? metadata.userId : undefined) ??
      (typeof dataObj.user_id === "string" ? dataObj.user_id : undefined) ??
      (typeof customerEmail === "string" ? customerEmail : undefined),
    amount: typeof amount === "number" ? amount : undefined,
    currency: typeof currency === "string" ? currency : undefined,
  };
}