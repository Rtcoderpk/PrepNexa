import { env } from "@/lib/env";
import {
  AIError,
  type AICapabilities,
  type AIProvider,
  type AITask,
  type ChatOptions,
  type ChatResult,
} from "@/lib/ai/ai-types";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * OpenRouter provider. Used as a final fallback when primary providers are
 * exhausted/rate-limited and the free-tier limits make sense for the request.
 *
 * Model strategy: `openrouter/auto` lets OpenRouter pick the cheapest capable
 * model per request (good for cost) at the price of non-deterministic model
 * choice. It is retained deliberately — no task here requires a pinned model,
 * and pinning would sacrifice cost flexibility. If output consistency becomes
 * important for a specific task, pin a concrete model for that task only.
 */
export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly priority = 40;

  supports(task: AITask, capabilities?: AICapabilities): boolean {
    if (capabilities?.vision) return false;
    return true;
  }

  async chat(options: ChatOptions): Promise<string> {
    return (await this.chatWithUsage(options)).content;
  }

  async chatWithUsage(options: ChatOptions): Promise<ChatResult> {
    if (!env.openrouterApiKey) throw new AIError("config", "OpenRouter API key not configured", { providerId: this.id });

    const model = options.model ?? "openrouter/auto";

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openrouterApiKey}`,
        "HTTP-Referer": env.appUrl,
        "X-Title": "PrepNexa",
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        messages: [
          ...(options.system ? [{ role: "system", content: options.system }] : []),
          ...options.messages,
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxOutputTokens,
        ...(options.format === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw this.mapError(response.status, body);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string; reasoning?: string; reasoning_content?: string };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const message = data.choices?.[0]?.message;
    // Prefer normal assistant content; some auto-routed reasoning models put the
    // output in `reasoning`/`reasoning_content` with an empty `content`. Fall back
    // to those so the response is usable rather than treated as malformed.
    const content =
      message?.content?.trim() ||
      message?.reasoning?.trim() ||
      message?.reasoning_content?.trim() ||
      "";
    if (!content) throw new AIError("invalid_response", "OpenRouter returned an empty response", { providerId: this.id });
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : null;
    return { content, usage };
  }

  async ping(): Promise<boolean> {
    return Boolean(env.openrouterApiKey);
  }

  private mapError(status: number, body: string): AIError {
    if (status === 429) {
      return new AIError("rate_limited", "OpenRouter rate limit hit", {
        providerId: this.id,
        retryAfterSec: parseRetryAfter(body),
      });
    }
    // 401/403 = invalid/forbidden credentials — a configuration problem, not a
    // transient provider availability issue. Do not fail over to another provider.
    if (status === 401 || status === 403) {
      return new AIError("config", `OpenRouter credentials rejected (${status})`, { providerId: this.id });
    }
    if (status >= 500) {
      return new AIError("server_error", `OpenRouter server error (${status})`, { providerId: this.id });
    }
    return new AIError("response", `OpenRouter request failed (${status}): ${body.slice(0, 300)}`, {
      providerId: this.id,
    });
  }
}

/** Parses Retry-After (seconds) from an OpenRouter error body when present. */
function parseRetryAfter(body: string): number | undefined {
  const match = body.match(/"retry-after"\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
