import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  verifySafepayWebhook,
  parseSafepayEvent,
} from "@/lib/payments/safepay";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import { activateSubscription } from "@/lib/payments/subscription";
import { isPaymentProviderConfigured } from "@/lib/payments/webhook";

const WEBHOOK_SECRET = "test-webhook-secret";

function sign(rawBody: string, secret = WEBHOOK_SECRET): string {
  return crypto
    .createHmac("sha512", secret)
    .update(Buffer.from(JSON.stringify(JSON.parse(rawBody)), "utf8"))
    .digest("hex");
}

/**
 * Mirrors the verified Safepay webhook payload shape:
 * tracker is a plain string; merchant metadata (our userId) sits in data.metadata.
 */
function succeededPayload(tracker = "track_test_123", userId = "user-1") {
  return JSON.stringify({
    token: "evt_xyz",
    version: "2.0.0",
    merchant_api_key: "sk_test_abc",
    type: "payment.succeeded",
    endpoint: "https://example.com/api/payments/webhook",
    data: {
      tracker,
      intent: "CYBERSOURCE",
      state: "TRACKER_ENDED",
      net: 49900,
      fee: 0,
      customer_email: "customer@example.com",
      amount: 49900,
      currency: "PKR",
      metadata: { userId },
      charged_at: { seconds: 1750000000, nanos: 0 },
    },
    created_at: { seconds: 1750000000, nanos: 0 },
  });
}

describe("verifySafepayWebhook", () => {
  afterEach(() => {
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
  });

  it("accepts a valid HMAC-SHA512 signature", () => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const raw = succeededPayload();
    const event = verifySafepayWebhook(raw, sign(raw));
    expect(event?.type).toBe("payment.succeeded");
    expect(event?.trackerToken).toBe("track_test_123");
    expect(event?.userId).toBe("user-1");
    expect(event?.amount).toBe(49900);
  });

  it("rejects a tampered body", () => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const raw = succeededPayload();
    const tampered = succeededPayload("track_test_123", "other-user");
    expect(verifySafepayWebhook(tampered, sign(raw))).toBeNull();
  });

  it("rejects a signature made with the wrong secret", () => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const raw = succeededPayload();
    expect(verifySafepayWebhook(raw, sign(raw, "wrong-secret"))).toBeNull();
  });

  it("returns null when no secret is configured or signature missing", () => {
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
    expect(verifySafepayWebhook(succeededPayload(), sign(succeededPayload()))).toBeNull();
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    expect(verifySafepayWebhook(succeededPayload(), undefined)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    expect(verifySafepayWebhook("{not-json", "abc")).toBeNull();
  });
});

describe("parseSafepayEvent", () => {
  it("reads tracker as a plain string from data", () => {
    const e = parseSafepayEvent(
      JSON.parse(JSON.stringify({ type: "payment.succeeded", data: { tracker: "track_x" } })),
    );
    expect(e?.trackerToken).toBe("track_x");
  });

  it("reads userId from data.metadata (verified payload shape)", () => {
    const e = parseSafepayEvent(
      JSON.parse(succeededPayload("track_x", "u1")),
    );
    expect(e?.trackerToken).toBe("track_x");
    expect(e?.userId).toBe("u1");
    expect(e?.amount).toBe(49900);
    expect(e?.currency).toBe("PKR");
  });

  it("falls back to customer_email when metadata lacks userId", () => {
    const e = parseSafepayEvent(
      JSON.parse(
        JSON.stringify({
          type: "payment.succeeded",
          data: { tracker: "track_x", customer_email: "u2@example.com", metadata: {} },
        }),
      ),
    );
    expect(e?.userId).toBe("u2@example.com");
  });

  it("tolerates missing/unknown fields", () => {
    const e = parseSafepayEvent({ type: "payment.failed" });
    expect(e?.type).toBe("payment.failed");
    expect(e?.userId).toBeUndefined();
    expect(e?.trackerToken).toBeUndefined();
  });
});

describe("handlePaymentWebhook — Safepay", () => {
  beforeEach(() => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });
  afterEach(() => {
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
  });

  it("maps payment.succeeded to an active subscription confirmation", async () => {
    const raw = succeededPayload();
    const confirmation = await handlePaymentWebhook({
      provider: "safepay",
      rawBody: raw,
      signature: sign(raw),
    });
    expect(confirmation).toMatchObject({
      userId: "user-1",
      plan: "pro",
      status: "active",
      provider: "safepay",
      transactionId: "track_test_123",
    });
  });

  it("returns null for a failed event", async () => {
    const raw = JSON.stringify({
      type: "payment.failed",
      data: {
        tracker: "track_f",
        intent: "CYBERSOURCE",
        state: "TRACKER_ENDED",
        customer_email: "customer@example.com",
        metadata: { userId: "user-1" },
      },
    });
    const confirmation = await handlePaymentWebhook({
      provider: "safepay",
      rawBody: raw,
      signature: sign(raw),
    });
    expect(confirmation).toBeNull();
  });

  it("returns null for an invalid signature", async () => {
    const raw = succeededPayload();
    const confirmation = await handlePaymentWebhook({
      provider: "safepay",
      rawBody: raw,
      signature: "invalid",
    });
    expect(confirmation).toBeNull();
  });

  it("returns null when the tracker token is missing", async () => {
    const raw = JSON.stringify({
      type: "payment.succeeded",
      data: { metadata: { userId: "user-1" } },
    });
    const confirmation = await handlePaymentWebhook({
      provider: "safepay",
      rawBody: raw,
      signature: sign(raw),
    });
    expect(confirmation).toBeNull();
  });
});

const idem = vi.hoisted(() => {
  const state = {
    adminMock: { from: vi.fn() },
    insertMock: vi.fn(),
    upsertMock: vi.fn(),
    updateMock: vi.fn(),
  };
  // Chainable query builder: update(...).eq(...) resolves to updateMock's value.
  state.updateMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  state.adminMock.from.mockReturnValue({
    insert: state.insertMock,
    upsert: state.upsertMock,
    update: state.updateMock,
  });
  return state;
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => idem.adminMock,
}));

describe("activateSubscription — idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
    idem.insertMock.mockReset().mockResolvedValue({ error: null, count: 1, data: [{}] });
    idem.upsertMock.mockReset().mockResolvedValue({ error: null });
    // mockReset clears the return value, so re-apply the chainable builder.
    idem.updateMock
      .mockReset()
      .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("records the transaction and activates when the event is new", async () => {
    const { activateSubscription } = await import(
      "@/lib/payments/subscription"
    );

    await activateSubscription({
      userId: "user-1",
      plan: "pro",
      status: "active",
      provider: "safepay",
      transactionId: "track_test_123",
      startDate: new Date().toISOString(),
      expiryDate: new Date().toISOString(),
    });

    expect(idem.insertMock).toHaveBeenCalledTimes(1);
    expect(idem.upsertMock).toHaveBeenCalledTimes(1);
    expect(idem.updateMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT re-activate when the event is a duplicate (replay)", async () => {
    idem.insertMock.mockResolvedValue({
      error: {
        message:
          "duplicate key value violates unique constraint \"payment_transactions_provider_transaction_id_event_type_key\"",
      },
      count: 0,
      data: [],
    });
    idem.upsertMock.mockClear();
    idem.updateMock.mockClear();

    const { activateSubscription } = await import(
      "@/lib/payments/subscription"
    );

    await activateSubscription({
      userId: "user-1",
      plan: "pro",
      status: "active",
      provider: "safepay",
      transactionId: "track_test_123",
      startDate: new Date().toISOString(),
      expiryDate: new Date().toISOString(),
    });

    expect(idem.insertMock).toHaveBeenCalledTimes(1);
    // Replay must not touch subscriptions or the profile entitlement.
    expect(idem.upsertMock).not.toHaveBeenCalled();
    expect(idem.updateMock).not.toHaveBeenCalled();
  });
});

describe("isPaymentProviderConfigured", () => {
  afterEach(() => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.SAFEPAY_SECRET_KEY;
    delete process.env.SAFEPAY_PUBLIC_KEY;
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
  });

  it("is true for safepay when all keys are present", () => {
    process.env.PAYMENT_PROVIDER = "safepay";
    process.env.SAFEPAY_SECRET_KEY = "sk";
    process.env.SAFEPAY_PUBLIC_KEY = "pk";
    process.env.SAFEPAY_WEBHOOK_SECRET = "wh";
    expect(isPaymentProviderConfigured()).toBe(true);
  });

  it("is false for safepay when keys are missing", () => {
    process.env.PAYMENT_PROVIDER = "safepay";
    delete process.env.SAFEPAY_SECRET_KEY;
    process.env.SAFEPAY_PUBLIC_KEY = "pk";
    process.env.SAFEPAY_WEBHOOK_SECRET = "wh";
    expect(isPaymentProviderConfigured()).toBe(false);
  });

  it("defaults to manual which is always configured", () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(isPaymentProviderConfigured()).toBe(true);
  });
});
