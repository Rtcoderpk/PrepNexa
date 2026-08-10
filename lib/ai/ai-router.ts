import {
  AIError,
  isAIError,
  type AICapabilities,
  type AITask,
  type ChatOptions,
} from "@/lib/ai/ai-types";
import { getTaskConfig, type ModelConfig } from "@/lib/ai/ai-config";
import { createProviders } from "@/lib/ai/providers";
import { withRetry } from "@/lib/ai/retry-manager";
import {
  recordFailure,
  recordSuccess,
  isCooldown,
} from "@/lib/ai/provider-health";
import { beginInFlight, endInFlight, recordRequest } from "@/lib/ai/usage-manager";
import { logAiUsage } from "@/lib/usage";

export interface RouteOptions {
  /** Optional dedup key — a concurrent identical request is not re-fired. */
  dedupKey?: string;
  /** Allow streaming (provider-dependent). */
  stream?: boolean;
}

/**
 * Picks the ordered list of providers capable of this task, honoring health
 * cooldowns. Filtered for capabilities and task suitability.
 */
function candidateProviders(task: AITask, capabilities: AICapabilities | undefined) {
  return createProviders().filter((p) => {
    if (isCooldown(p.id)) return false;
    if (!p.supports(task, capabilities)) return false;
    return true;
  });
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

  if (routeOptions.dedupKey) {
    if (!beginInFlight(task, routeOptions.dedupKey)) {
      throw new AIError("response", "A similar request is already in progress");
    }
  }

  recordRequest(task);

  const models = resolveModel(task);
  const providers = candidateProviders(task, capabilities);

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
          { maxAttempts: options.task === "interview_feedback" ? 2 : 3 },
        );
        recordSuccess(provider.id, Date.now() - started);
        void logAiUsage({
          task,
          provider: provider.id,
          model: model.model,
          success: true,
          latencyMs: Date.now() - started,
        });
        return result;
      } catch (error) {
        lastError = error;
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

        // Config/invalid-response are not worth failing over for — propagate.
        if (isAIError(error) && (error.kind === "config" || error.kind === "invalid_response")) {
          throw error;
        }
        // Continue to the next provider.
      }
    }
  }

  if (routeOptions.dedupKey) endInFlight(task, routeOptions.dedupKey);

  throw lastError instanceof AIError
    ? lastError
    : new AIError("response", "All AI providers are temporarily unavailable");
}

export async function generateAIStream(
  options: ChatOptions,
  routeOptions: RouteOptions = {},
): Promise<AsyncIterable<string>> {
  const task = options.task;
  const capabilities = options.capabilities;
  const providers = candidateProviders(task, capabilities);

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
  const text = await generateAIResponse(options, routeOptions);
  return (async function* () {
    yield text;
  })();
}
