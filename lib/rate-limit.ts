/**
 * Rate limiter with a pluggable store.
 * - Memory store: single-instance default (fast, no deps).
 * - Redis store: shared across instances (horizontal scaling).
 * The store is selected at runtime from env (RATE_LIMIT_STORE / REDIS_URL).
 */

import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, Bucket>();

function memoryCleanup(): void {
  const now = Date.now();
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt < now) memoryBuckets.delete(key);
  }
}

function memoryAllow(key: string, max: number): boolean {
  memoryCleanup();
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= max) return false;

  bucket.count += 1;
  return true;
}

async function redisAllow(key: string, max: number): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return memoryAllow(key, max);

  const countKey = `rl:${key}`;
  const current = await redis.incr(countKey);
  if (current === 1) {
    await redis.expire(countKey, Math.ceil(WINDOW_MS / 1000));
  }
  return current <= max;
}

/**
 * Memory-store rate limit (sync). When RATE_LIMIT_STORE=redis is configured,
 * prefer `rateLimitAsync` so limits are shared across instances.
 */
export function rateLimit(key: string, max: number = MAX_REQUESTS): boolean {
  return memoryAllow(key, max);
}

export async function rateLimitAsync(
  key: string,
  max: number = MAX_REQUESTS,
): Promise<boolean> {
  if (env.rateLimitStore === "redis") {
    return redisAllow(key, max);
  }
  return memoryAllow(key, max);
}
