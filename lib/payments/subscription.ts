import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionConfirmation } from "@/lib/payments/webhook";

/**
 * Subscription persistence + entitlement updates. Uses the RLS-bypassing admin
 * client because these run from webhooks (no user session).
 *
 * Idempotency: each confirmed webhook event is recorded in payment_transactions
 * ON CONFLICT DO NOTHING. If the event was already processed (a replay or a
 * duplicate delivery), the insert is a no-op and the subscription/entitlement is
 * NOT touched again — so one payment can never grant two months of premium.
 */

type PaymentTransactionStatus =
  | "succeeded"
  | "failed"
  | "pending"
  | "cancelled"
  | "expired";

const EVENT_STATUS: Record<string, PaymentTransactionStatus> = {
  "payment.succeeded": "succeeded",
  "payment.failed": "failed",
};

function isUniqueViolation(error: { message?: string } | null): boolean {
  const msg = error?.message ?? "";
  // PostgREST reports a unique-constraint violation like this; catching it is
  // what makes webhook processing idempotent against concurrent replays.
  return /duplicate key value violates unique constraint/i.test(msg);
}

function recordTransaction(
  admin: ReturnType<typeof createAdminClient>,
  confirmation: SubscriptionConfirmation,
  eventType: string,
  payload?: Record<string, unknown>,
) {
  return admin.from("payment_transactions").insert(
    {
      user_id: confirmation.userId,
      provider: confirmation.provider,
      transaction_id: confirmation.transactionId ?? `tx_${crypto.randomUUID()}`,
      event_type: eventType,
      status: EVENT_STATUS[eventType] ?? "pending",
      amount: null,
      currency: null,
      payload: payload ?? null,
    },
  );
}

export async function activateSubscription(
  confirmation: SubscriptionConfirmation,
): Promise<void> {
  const admin = createAdminClient();

  const eventType = "payment.succeeded";
  const tx = await recordTransaction(admin, confirmation, eventType);

  // A unique-constraint violation means this (provider, transaction_id,
  // event_type) was already recorded — the webhook is a replay or duplicate
  // delivery. Never re-grant premium for an already-processed event.
  if (isUniqueViolation(tx.error)) {
    return;
  }

  if (tx.error) {
    throw new Error(`Failed to record payment transaction: ${tx.error.message}`);
  }

  // Upsert the subscription record (one active subscription per user).
  await admin.from("subscriptions").upsert(
    {
      user_id: confirmation.userId,
      plan: confirmation.plan,
      status: confirmation.status,
      provider: confirmation.provider,
      transaction_id: confirmation.transactionId ?? null,
      start_date: confirmation.startDate,
      expiry_date: confirmation.expiryDate ?? null,
    },
    { onConflict: "user_id" },
  );

  // Flag the profile as premium.
  await admin
    .from("profiles")
    .update({ is_premium: true })
    .eq("id", confirmation.userId);
}

export async function deactivateSubscription(userId: string): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("user_id", userId);

  await admin.from("profiles").update({ is_premium: false }).eq("id", userId);
}

/** Expire premium for every user whose subscription has lapsed. Idempotent. */
export async function expireOverdueSubscriptions(): Promise<number> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .lt("expiry_date", new Date().toISOString());

  const userIds = rows?.map((r) => r.user_id) ?? [];
  if (userIds.length === 0) return 0;

  for (const userId of userIds) {
    await deactivateSubscription(userId);
  }
  return userIds.length;
}
