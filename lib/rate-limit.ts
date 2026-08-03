/**
 * Lightweight in-memory sliding-window rate limiter.
 * In a multi-instance deployment, replace with a shared store (Redis/Upstash).
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export function rateLimit(key: string, max: number = MAX_REQUESTS): boolean {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= max) {
    return false;
  }

  bucket.count += 1;
  return true;
}
