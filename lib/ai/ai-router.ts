import {
  AIError,
  isAIError,
  AI_BUDGET_LIMIT_MESSAGE,
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
        throw new AIError("budget_limit", AI_BUDGET_LIMIT_MESSAGE);
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
    // Observability: total attempts and which providers were tried in order.
    let attempts = 0;
    const attemptedProviders: string[] = [];

    // Attempt each (model) in order; for each, try every capable provider.
    for (const model of models) {
      const capable = providers.filter((p) =>
        p.supports(task, capabilities),
      );
      for (const provider of capable) {
        const started = Date.now();
        try {
          const result = await withRetry(
            async () => {
              const chatResult = provider.chatWithUsage
                ? await provider.chatWithUsage({
                    ...options,
                    task,
                    providerId: provider.id,
                    model: model.model,
                    maxOutputTokens: options.maxOutputTokens ?? model.maxTokens,
                  })
                : { content: await provider.chat({
                    ...options,
                    task,
                    providerId: provider.id,
                    model: model.model,
                    maxOutputTokens: options.maxOutputTokens ?? model.maxTokens,
                  }), usage: null };
              return chatResult;
            },
            {
              maxAttempts: options.task === "interview_feedback" ? 2 : 3,
              onRetryableError: (err) => {
                const kind = isAIError(err) ? err.kind : "response";
                attempts += 1;
                if (attemptedProviders[attemptedProviders.length - 1] !== provider.id) {
                  attemptedProviders.push(provider.id);
                }
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
                  attempts,
                  fallbackFrom: attemptedProviders.at(-2),
                  fallbackTo: provider.id,
                });
              },
            },
          );
          attempts += 1;
          recordSuccess(provider.id, Date.now() - started);
          void logAiUsage({
            task,
            provider: provider.id,
            model: model.model,
            success: true,
            latencyMs: Date.now() - started,
            attempts,
            fallbackFrom: attemptedProviders.at(-1) !== provider.id ? attemptedProviders.at(-1) : undefined,
            fallbackTo: provider.id,
            promptTokens: result.usage?.promptTokens ?? null,
            completionTokens: result.usage?.completionTokens ?? null,
            totalTokens: result.usage?.totalTokens ?? null,
          });
          succeeded = true;
          return result.content;
        } catch (error) {
          lastError = error;
          attempts += 1;
          if (attemptedProviders[attemptedProviders.length - 1] !== provider.id) {
            attemptedProviders.push(provider.id);
          }
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
              attempts,
              fallbackFrom: attemptedProviders.at(-2),
              fallbackTo: provider.id,
            });
          }

          // Invalid-response from a provider is not worth failing over for —
          // it indicates a broken response from that engine, so propagate.
          if (isAIError(error) && error.kind === "invalid_response") {
            throw error;
          }
          // A single provider's config error (e.g. one bad key) should NOT abort
          // the whole request while other providers may be healthy — fail over,
          // and only propagate config if EVERY provider fails with it (below).
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

  // Per-user AI budget reservation + dedup, mirroring generateAIResponse so a
  // streaming request is just as gated as a non-streaming one. Declared here so
  // the wrapped generator's finally can release them. The non-stream fallback
  // path does NOT reserve here (generateAIResponse reserves itself) to avoid
  // double-reservation.
  let budgetReserved = false;
  let streamSucceeded = false;
  let dedupStarted = false;

  if (routeOptions.dedupKey) {
    dedupStarted = beginInFlight(task, routeOptions.dedupKey);
    if (!dedupStarted) {
      throw new AIError("response", "A similar request is already in progress");
    }
  }
  if (routeOptions.userId) {
    const budget = await reserveAiBudget(routeOptions.userId);
    if (!budget.allowed) {
      if (dedupStarted) endInFlight(task, routeOptions.dedupKey!);
      throw new AIError("budget_limit", AI_BUDGET_LIMIT_MESSAGE);
    }
    budgetReserved = true;
  }

  const providers = await candidateProviders(task, capabilities);

  if (providers.length === 0) {
    if (budgetReserved) void releaseAiBudget(routeOptions.userId);
    if (dedupStarted) endInFlight(task, routeOptions.dedupKey!);
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
      // Wrap so budget/dedup are released when the stream errors or is
      // abandoned — a streaming request must not leak its reservation. Mirrors
      // generateAIResponse: on SUCCESS the slot is kept (consumed), so a
      // streaming call counts against the budget the same way a non-streaming
      // one does.
      return (async function* () {
        try {
          yield* stream;
          streamSucceeded = true;
        } finally {
          if (budgetReserved && !streamSucceeded) {
            void releaseAiBudget(routeOptions.userId);
          }
          if (dedupStarted) endInFlight(task, routeOptions.dedupKey!);
        }
      })();
    } catch (error) {
      recordFailure(provider.id, isAIError(error) ? error.kind : "response");
      // Try the next streaming provider.
    }
  }

  // No streaming-capable provider — fall back to a single non-streamed response.
  // generateAIResponse handles its own reservation/dedup; release ours first so
  // the fallback reserves exactly once.
  if (budgetReserved) void releaseAiBudget(routeOptions.userId);
  if (dedupStarted) endInFlight(task, routeOptions.dedupKey!);
  const text = await generateAIResponse(options, routeOptions);
  return (async function* () {
    yield text;
  })();
}
