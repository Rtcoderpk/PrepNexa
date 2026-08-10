import type { ProviderId } from "@/lib/ai/ai-config";
import { persistProviderHealth } from "@/lib/usage";

/**
 * In-memory provider health tracking. Cooldowns prevent routing traffic to a
 * provider that is failing/rate-limited. State is per-instance (fine for a
 * serverless or single-instance deployment; a shared store could be added later).
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

const COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 45_000;

const healthByProvider = new Map<string, ProviderHealth>();

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

export function recordSuccess(providerId: string, latencyMs: number): void {
  const entry = getEntry(providerId);
  entry.successCount += 1;
  if (entry.averageLatencyMs === null) entry.averageLatencyMs = latencyMs;
  else entry.averageLatencyMs = Math.round(
    (entry.averageLatencyMs + latencyMs) / 2,
  );
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

  if (kind === "rate_limited") {
    entry.rateLimitedCount += 1;
    const base = retryAfterSec ? retryAfterSec * 1000 : RATE_LIMIT_COOLDOWN_MS;
    entry.cooldownUntil = Date.now() + Math.max(base, 15_000);
  } else {
    // Transient failures put the provider on a short cooldown too.
    entry.cooldownUntil = Date.now() + COOLDOWN_MS;
  }
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

/** Whether a provider is currently cooled down. */
export function isCooldown(providerId: string): boolean {
  const entry = healthByProvider.get(providerId);
  if (!entry?.cooldownUntil) return false;
  return Date.now() < entry.cooldownUntil;
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
