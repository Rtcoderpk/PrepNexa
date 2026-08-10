import { AIError, isAIError } from "@/lib/ai/ai-types";

const RETRYABLE_KINDS = new Set(["rate_limited", "server_error", "timeout", "unreachable"]);

/** True for error kinds that are safe to retry (transient provider failures). */
export function isRetryableKind(kind: string): boolean {
  return RETRYABLE_KINDS.has(kind);
}

/** Hard cap on total retry wait — never stall a request for long. */
const MAX_RETRY_WAIT_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bounded exponential backoff with jitter — avoids thundering the same provider
 * and never exceeds the attempt cap (no infinite retry / cost multiplication).
 * Only transient errors are retried; config/invalid-response fail fast.
 * Honors Retry-After when the provider supplies it (capped).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    /** Invoked on each retryable error BEFORE backing off (for health/telemetry). */
    onRetryableError?: (error: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const aiError = isAIError(error) ? error : new AIError("response", "AI call failed");
      if (!RETRYABLE_KINDS.has(aiError.kind)) throw error;

      options.onRetryableError?.(error, attempt);
      if (attempt >= maxAttempts) throw error;

      const retryAfterMs = aiError.retryAfterSec ? aiError.retryAfterSec * 1000 : 0;
      const backoffMs = baseDelayMs * 2 ** (attempt - 1);
      // Add up to 25% jitter to spread concurrent retries. Retry-After (when
      // supplied) dominates backoff so we respect the provider's own throttle;
      // the total wait is still capped to avoid long stalls.
      const jitter = Math.random() * backoffMs * 0.25;
      const base = Math.max(backoffMs + jitter, retryAfterMs);
      await sleep(Math.min(base, MAX_RETRY_WAIT_MS));
    }
  }

  throw lastError;
}
