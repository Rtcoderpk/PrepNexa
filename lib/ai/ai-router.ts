import {
  AIError,
  isAIError,
  type AICapabilities,
  type AIProvider,
  type AITask,
  type ChatOptions,
} from "@/lib/ai/ai-types";
import { getTaskConfig, type ModelConfig } from "@/lib/ai/ai-config";
import { createProviders } from "@/lib/ai/providers";
import { withRetry, isRetryableKind } from "@/lib/ai/retry-manager";
import {
  recordFailure,
  recordSuccess,
  isCooldown,
} from "@/lib/ai/provider-health";
import { beginInFlight, endInFlight, recordRequest } from "@/lib/ai/usage-manager";
import { logAiUsage, reserveAiBudget, releaseAiBudget } from "@/lib/usage";

export interface RouteOptions {
  /** Optional dedup key — a concurrent identical request is not re-fired. */
  dedupKey?: string;
  /** Allow streaming (provider-dependent). */
  stream?: boolean;
  /** Optional user id — used for per-user AI budget guardrails when set. */
  userId?: string;
}

/**
 * Picks the ordered list of providers capable of this task, honoring health
 * cooldowns. Filtered for capabilities and task suitability.
 */
async function candidateProviders(
  task: AITask,
  capabilities: AICapabilities | undefined,
): Promise<AIProvider[]> {
  const providers = createProviders();
  const cooledDown = await Promise.all(
    providers.map((p) => isCooldown(p.id)),
  );
  return providers
    .filter((p, i) => {
      if (cooledDown[i]) return false;
      if (!p.supports(task, capabilities)) return false;
      return true;
    })
    // Deterministic priority ordering (lower `priority` tried first). Never
    // rely on array registration order.
    .sort((a, b) => a.priority - b.priority);
}

function resolveModel(task: AITask): ModelConfig[] {
  const config = getTaskConfig(task);
  return [config.primary, ...config.fallbacks];
}

/**
 * Intelligent AI router: selects the best available provider for a request,
 * retries transient failures, and fails over across providers. Never retries
 * endlessly and never exposes raw provider errors.
 */
export async function generateAIResponse(
  options: ChatOptions,
  routeOptions: RouteOptions = {},
): Promise<string> {
  const task = options.task;
  const capabilities = options.capabilities;

  const dedupStarted = routeOptions.dedupKey
    ? beginInFlight(task, routeOptions.dedupKey)
    : true;
  if (!dedupStarted) {
    throw new AIError("response", "A similar request is already in progress");
  }

  recordRequest(task);

  // Per-user AI budget reservation (server-side cost control). Atomic when
  // Redis is available; in-memory fallback otherwise. Best-effort. Declared at
  // function scope so the finally clause can read them.
  let budgetReserved = false;
  let succeeded = false;

  try {
    if (routeOptions.userId) {
      const budget = await reserveAiBudget(routeOptions.userId);
      if (!budget.allowed) {
        throw new AIError("response", "You've reached your AI usage limit for now. Please try again later.");
      }
      budgetReserved = true;
    }

    const models = resolveModel(task);
    const providers = await candidateProviders(task, capabilities);

    if (providers.length === 0) {
      throw new AIError(
        "config",
        "No AI provider is currently available. Please try again in a moment.",
      );
    }

    let lastError: unknown = null;

    // Attempt each (model) in order; for each, try every capable provider.
    for (const model of models) {
      const capable = providers.filter((p) =>
        p.supports(task, capabilities),
      );
      for (const provider of capable) {
        const started = Date.now();
        try {
          const result = await withRetry(
            () =>
              provider.chat({
                ...options,
                task,
                providerId: provider.id,
                model: model.model,
                maxOutputTokens: options.maxOutputTokens ?? model.maxTokens,
              }),
            {
              maxAttempts: options.task === "interview_feedback" ? 2 : 3,
              onRetryableError: (err) => {
                const kind = isAIError(err) ? err.kind : "response";
                // Record health on the FIRST retryable error (not after retries
                // exhaust) so cooldowns/counters are truthful.
                recordFailure(
                  provider.id,
                  kind,
                  isAIError(err) ? err.retryAfterSec : undefined,
                );
                void logAiUsage({
                  task,
                  provider: provider.id,
                  model: model.model,
                  success: false,
                  errorKind: kind,
                  latencyMs: Date.now() - started,
                });
              },
            },
          );
          recordSuccess(provider.id, Date.now() - started);
          void logAiUsage({
            task,
            provider: provider.id,
            model: model.model,
            success: true,
            latencyMs: Date.now() - started,
          });
          succeeded = true;
          return result;
        } catch (error) {
          lastError = error;
          // Non-retryable errors (config/invalid_response) were NOT health-
          // recorded by withRetry — record them here once.
          if (!isAIError(error) || !isRetryableKind(error.kind)) {
            const kind = isAIError(error) ? error.kind : "response";
            recordFailure(provider.id, kind, isAIError(error) ? error.retryAfterSec : undefined);
            void logAiUsage({
              task,
              provider: provider.id,
              model: model.model,
              success: false,
              errorKind: kind,
              latencyMs: Date.now() - started,
            });
          }

          // Config/invalid-response are not worth failing over for — propagate.
          if (isAIError(error) && (error.kind === "config" || error.kind === "invalid_response")) {
            throw error;
          }
          // Continue to the next provider.
        }
      }
    }

    // All providers failed. Preserve the real internal reason for telemetry
    // (it stays in lastError/logAiUsage), but surface a stable, non-sensitive
    // error to the caller. Config errors indicate misconfiguration and are
    // propagated as-is so ops can see the real cause.
    if (lastError instanceof AIError && lastError.kind === "config") {
      throw lastError;
    }
    throw new AIError("response", "All AI providers are temporarily unavailable", {
      providerId: isAIError(lastError) ? lastError.providerId : undefined,
    });
  } finally {
    // Release the budget reservation ONLY when the request did not succeed —
    // a failed attempt should not permanently consume a slot.
    if (budgetReserved && !succeeded) {
      void releaseAiBudget(routeOptions.userId);
    }
    // Guarantee in-flight state is released even on early throws.
    if (routeOptions.dedupKey) endInFlight(task, routeOptions.dedupKey);
  }
}

export async function generateAIStream(
  options: ChatOptions,
  routeOptions: RouteOptions = {},
): Promise<AsyncIterable<string>> {
  const task = options.task;
  const capabilities = options.capabilities;

  const providers = await candidateProviders(task, capabilities);

  if (providers.length === 0) {
    throw new AIError("config", "No AI provider is currently available. Please try again in a moment.");
  }

  for (const provider of providers) {
    if (!provider.stream) continue;
    try {
      const model = resolveModel(task)[0];
      const stream = provider.stream({
        ...options,
        task,
        providerId: provider.id,
        model: model.model,
      });
      recordRequest(task);
      return stream;
    } catch (error) {
      recordFailure(provider.id, isAIError(error) ? error.kind : "response");
      // Try the next streaming provider.
    }
  }

  // No streaming-capable provider — fall back to a single non-streamed response.
  // The budget reservation is handled inside generateAIResponse.
  const text = await generateAIResponse(options, routeOptions);
  return (async function* () {
    yield text;
  })();
}
