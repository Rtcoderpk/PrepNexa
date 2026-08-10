import type { ProviderId } from "@/lib/ai/ai-config";
import { persistProviderHealth } from "@/lib/usage";
import { getRedis } from "@/lib/redis";

/**
 * Provider health + cooldown tracking.
 *
 * Cooldowns prevent routing traffic to a provider that is failing/rate-limited.
 * In-memory by default (single-instance). When Redis is available (RATE_LIMIT_STORE
 * or REDIS_URL configured) the cooldown deadline is shared across instances so a
 * multi-instance deployment does not re-hit a cooled-down provider.
 */

export interface ProviderHealth {
  providerId: string;
  successCount: number;
  failureCount: number;
  rateLimitedCount: number;
  averageLatencyMs: number | null;
  lastFailureAt: number | null;
  /** Epoch ms until which this provider is skipped. */
  cooldownUntil: number | null;
}

export const COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
/** Quota exhaustion gets a longer cooldown so the provider can recover. */
const QUOTA_COOLDOWN_MS = 120_000;
/** Minimum cooldown for any rate-limit, even when Retry-After is small. */
const MIN_RATE_LIMIT_COOLDOWN_MS = 15_000;

const healthByProvider = new Map<string, ProviderHealth>();

function redisKey(providerId: string): string {
  return `ai:provider:cooldown:${providerId}`;
}

function getEntry(providerId: string): ProviderHealth {
  let entry = healthByProvider.get(providerId);
  if (!entry) {
    entry = {
      providerId,
      successCount: 0,
      failureCount: 0,
      rateLimitedCount: 0,
      averageLatencyMs: null,
      lastFailureAt: null,
      cooldownUntil: null,
    };
    healthByProvider.set(providerId, entry);
  }
  return entry;
}

/** Reads the distributed cooldown deadline (epoch ms) if Redis is available. */
async function readDistributedCooldown(
  providerId: string,
): Promise<number | null> {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const raw = await redis.get(redisKey(providerId));
    if (!raw) return null;
    const deadline = Number(raw);
    return Number.isFinite(deadline) ? deadline : null;
  } catch {
    return null;
  }
}

/** Writes the distributed cooldown deadline (seconds TTL) when Redis is available. */
async function writeDistributedCooldown(
  providerId: string,
  cooldownUntil: number,
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    const ttlSec = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
    await redis.setex(redisKey(providerId), ttlSec, String(cooldownUntil));
  } catch {
    // Distributed cooldown is best-effort — never break routing.
  }
}

async function clearDistributedCooldown(providerId: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.del(redisKey(providerId));
  } catch {
    // Best-effort.
  }
}

export function recordSuccess(providerId: string, latencyMs: number): void {
  const entry = getEntry(providerId);
  entry.successCount += 1;
  if (entry.averageLatencyMs === null) entry.averageLatencyMs = latencyMs;
  else entry.averageLatencyMs = Math.round(
    (entry.averageLatencyMs + latencyMs) / 2,
  );
  // A success means the provider recovered — clear any cooldown (local + distributed).
  entry.cooldownUntil = null;
  void clearDistributedCooldown(providerId);
  void persistHealth(entry);
}

export function recordFailure(
  providerId: string,
  kind: string,
  retryAfterSec?: number,
): void {
  const entry = getEntry(providerId);
  entry.failureCount += 1;
  entry.lastFailureAt = Date.now();

  let cooldownMs: number;
  if (kind === "rate_limited") {
    entry.rateLimitedCount += 1;
    const base = retryAfterSec ? retryAfterSec * 1000 : RATE_LIMIT_COOLDOWN_MS;
    cooldownMs = Math.max(base, MIN_RATE_LIMIT_COOLDOWN_MS);
  } else if (kind === "quota") {
    cooldownMs = QUOTA_COOLDOWN_MS;
  } else {
    // Transient failures put the provider on a short cooldown too.
    cooldownMs = COOLDOWN_MS;
  }

  entry.cooldownUntil = Date.now() + cooldownMs;
  void writeDistributedCooldown(providerId, entry.cooldownUntil);
  void persistHealth(entry);
}

/** Fire-and-forget DB persistence of the in-memory health snapshot. */
function persistHealth(entry: ProviderHealth): void {
  void persistProviderHealth({
    providerId: entry.providerId,
    successCount: entry.successCount,
    failureCount: entry.failureCount,
    rateLimitedCount: entry.rateLimitedCount,
    averageLatencyMs: entry.averageLatencyMs,
    lastFailureAt: entry.lastFailureAt,
  });
}

/** Whether a provider is currently cooled down (checks memory + distributed). */
export async function isCooldown(providerId: string): Promise<boolean> {
  const entry = healthByProvider.get(providerId);
  if (entry?.cooldownUntil && Date.now() < entry.cooldownUntil) return true;

  // Fall back to the distributed deadline so other instances' cooldowns apply.
  const distributed = await readDistributedCooldown(providerId);
  if (distributed !== null && Date.now() < distributed) {
    // Mirror it in local memory so the polled path stays cheap.
    if (entry) entry.cooldownUntil = distributed;
    return true;
  }
  return false;
}

export function getHealth(providerId: string): ProviderHealth | undefined {
  return healthByProvider.get(providerId);
}

export function getAllHealth(): ProviderHealth[] {
  return Array.from(healthByProvider.values());
}

/** Clears all tracked health (used in tests). */
export function resetProviderHealth(): void {
  healthByProvider.clear();
}
