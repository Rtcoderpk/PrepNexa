import { AIError, isAIError } from "@/lib/ai/ai-types";

const RETRYABLE_KINDS = new Set(["rate_limited", "server_error", "timeout", "unreachable"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async AI call with exponential backoff. Only transient errors are
 * retried; config/invalid-response errors fail fast. Honors Retry-After when the
 * provider supplies it (capped to avoid long stalls).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
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

      if (attempt >= maxAttempts) throw error;

      const retryAfterMs = aiError.retryAfterSec ? aiError.retryAfterSec * 1000 : 0;
      const backoffMs = baseDelayMs * 2 ** (attempt - 1);
      await sleep(Math.min(Math.max(backoffMs, retryAfterMs), 8_000));
    }
  }

  throw lastError;
}
