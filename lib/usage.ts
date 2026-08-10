import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, PRO_FAIR_USE_LIMIT } from "@/lib/pricing";

/**
 * Server-side usage + entitlement enforcement. The source of truth is the
 * database — never localStorage, cookies, or frontend state. All usage checks
 * and increments run here so a client cannot forge its own quota.
 *
 * Reads/writes use the cookie-authenticated server client so enforcement works
 * without a service-role key (RLS policies grant owners read/update on their
 * own profiles/subscriptions). A service-role client is used only when one is
 * explicitly configured (e.g. the feedback worker), never required.
 */

const MAX_RESUME_CHECKS_FREE = PLANS.free.freeResumeChecks;

export interface UsageStatus {
  isPremium: boolean;
  freeInterviewUsed: boolean;
  resumeAnalysisCount: number;
  resumeChecksRemaining: number;
  canStartInterview: boolean;
  freeInterviewLimit: number;
  resumeCheckLimit: number;
  subscriptionStatus?: string;
  subscriptionExpiry?: string | null;
}

function tryGetAdmin(): ReturnType<typeof createAdminClient> | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * Loads the user's usage + premium status. Reads via the session-authenticated
 * client (owner RLS) so no service-role key is required. Falls back to the
 * admin client when one is configured. Returns a safe default for a fresh
 * account (missing row).
 */
export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  const client = tryGetAdmin() ?? (await createClient());

  const [profileRes, subRes] = await Promise.all([
    client
      .from("profiles")
      .select("free_interview_used, resume_analysis_count, is_premium")
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("subscriptions")
      .select("status, expiry_date")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const sub = subRes.data;

  const isPremium =
    profile?.is_premium === true ||
    (sub?.status === "active" &&
      (sub.expiry_date === null ||
        new Date(sub.expiry_date).getTime() > Date.now()));

  const freeInterviewUsed = profile?.free_interview_used === true;
  const resumeAnalysisCount = profile?.resume_analysis_count ?? 0;

  return {
    isPremium,
    freeInterviewUsed,
    resumeAnalysisCount,
    resumeChecksRemaining: Math.max(
      0,
      MAX_RESUME_CHECKS_FREE - resumeAnalysisCount,
    ),
    canStartInterview: isPremium || !freeInterviewUsed,
    freeInterviewLimit: 1,
    resumeCheckLimit: MAX_RESUME_CHECKS_FREE,
    subscriptionStatus: sub?.status,
    subscriptionExpiry: sub?.expiry_date,
  };
}

/**
 * Marks the user's free interview as used. Idempotent. Uses the session
 * client (owner RLS allows the profile update).
 */
export async function consumeFreeInterview(userId: string): Promise<void> {
  const client = await createClient();
  await client
    .from("profiles")
    .update({ free_interview_used: true })
    .eq("id", userId);
}

/**
 * Server-side gate for starting a new interview. A free user may start exactly
 * one interview; they may re-enter an in-progress interview, but once one has
 * been created (free_interview_used=true) a NEW interview is blocked.
 * Premium users are unlimited subject to fair-use limits.
 */
export async function canUserStartInterview(
  userId: string,
): Promise<{ allowed: boolean; reason?: string; interviewId?: string }> {
  const status = await getUsageStatus(userId);
  const client = await createClient();

  if (status.isPremium) {
    const { count } = await client
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    const completed = count ?? 0;
    if (completed >= PRO_FAIR_USE_LIMIT) {
      return { allowed: false, reason: "fair_use_limit" };
    }
    return { allowed: true };
  }

  // Free user: allowed until the free interview has been started.
  if (status.freeInterviewUsed) {
    // Allow re-entry into an existing in-progress interview only.
    const { data: inProgress } = await client
      .from("interviews")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .limit(1)
      .maybeSingle();
    if (inProgress) {
      return { allowed: false, reason: "has_in_progress", interviewId: inProgress.id };
    }
    return { allowed: false, reason: "free_interview_used" };
  }

  return { allowed: true };
}

/**
 * Increments the resume-analysis counter. Returns the new count. Free users are
 * limited to `MAX_RESUME_CHECKS_FREE`; premium users bypass the cap.
 */
export async function consumeResumeAnalysis(
  userId: string,
): Promise<{ count: number; allowed: boolean }> {
  const status = await getUsageStatus(userId);
  if (!status.isPremium && status.resumeAnalysisCount >= MAX_RESUME_CHECKS_FREE) {
    return { count: status.resumeAnalysisCount, allowed: false };
  }

  const client = await createClient();
  const newCount = status.resumeAnalysisCount + 1;
  await client
    .from("profiles")
    .update({ resume_analysis_count: newCount })
    .eq("id", userId);
  return { count: newCount, allowed: true };
}

export interface ProviderHealthSnapshot {
  providerId: string;
  successCount: number;
  failureCount: number;
  rateLimitedCount: number;
  averageLatencyMs: number | null;
  lastFailureAt: number | null;
}

/**
 * Persists a provider's health snapshot to the `provider_health` table.
 * Fire-and-forget: failures are swallowed so telemetry never breaks the request
 * path. Uses the admin client because the table is RLS-restricted to server
 * contexts (policy `using (false)` for end users).
 */
export async function persistProviderHealth(
  snapshot: ProviderHealthSnapshot,
): Promise<void> {
  try {
    const admin = tryGetAdmin();
    if (!admin) return; // No service-role key configured — telemetry is optional.
    await admin.from("provider_health").upsert(
      {
        provider: snapshot.providerId,
        success_count: snapshot.successCount,
        failure_count: snapshot.failureCount,
        rate_limited_count: snapshot.rateLimitedCount,
        average_latency_ms: snapshot.averageLatencyMs,
        last_failure_at: snapshot.lastFailureAt
          ? new Date(snapshot.lastFailureAt).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" },
    );
  } catch {
    // Non-critical telemetry — never fail the request.
  }
}

/**
 * Records an AI request for cost control + abuse monitoring. Fire-and-forget —
 * failures are swallowed so accounting never breaks the request path. Uses the
 * session client when no service-role key is set (owner insert allowed by RLS).
 */
export async function logAiUsage(params: {
  userId?: string;
  task: string;
  provider?: string;
  model?: string;
  success?: boolean;
  errorKind?: string;
  latencyMs?: number;
}): Promise<void> {
  try {
    const client = tryGetAdmin() ?? (await createClient());
    await client.from("ai_usage_logs").insert({
      user_id: params.userId ?? null,
      task: params.task,
      provider: params.provider ?? null,
      model: params.model ?? null,
      success: params.success ?? true,
      error_kind: params.errorKind ?? null,
      latency_ms: params.latencyMs ?? null,
    });
  } catch {
    // Non-critical accounting — never fail the request.
  }
}

export type AiBudgetCheck = { allowed: boolean; reason?: "daily" | "hourly" };

/**
 * Per-user AI usage budget guard. Counts the user's AI requests within rolling
 * daily/hourly windows from `ai_usage_logs` and blocks when a configured limit
 * is exceeded. Limits come from env (AI_DAILY_BUDGET / AI_HOURLY_BUDGET); 0
 * disables the guard. The check is best-effort — failures return allowed.
 * This protects the app's provider free-tier capacity from a single heavy user.
 */
export async function checkAiBudget(
  userId: string | undefined,
): Promise<AiBudgetCheck> {
  const { env } = await import("@/lib/env");
  const dailyLimit = env.aiDailyBudget;
  const hourlyLimit = env.aiHourlyBudget;
  if ((!dailyLimit || dailyLimit <= 0) && (!hourlyLimit || hourlyLimit <= 0)) {
    return { allowed: true };
  }
  if (!userId) return { allowed: true };

  try {
    const client = tryGetAdmin() ?? (await createClient());
    const now = Date.now();
    const [daily, hourly] = await Promise.all([
      dailyLimit > 0
        ? countAiRequests(client, userId, now - 24 * 60 * 60 * 1000)
        : Promise.resolve(0),
      hourlyLimit > 0
        ? countAiRequests(client, userId, now - 60 * 60 * 1000)
        : Promise.resolve(0),
    ]);
    if (dailyLimit > 0 && daily >= dailyLimit) return { allowed: false, reason: "daily" };
    if (hourlyLimit > 0 && hourly >= hourlyLimit) return { allowed: false, reason: "hourly" };
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

async function countAiRequests(
  client: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sinceMs: number,
): Promise<number> {
  const { count } = await client
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(sinceMs).toISOString());
  return count ?? 0;
}