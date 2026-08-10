import { env } from "@/lib/env";
import {
  AIError,
  type AICapabilities,
  type AIProvider,
  type AITask,
  type ChatOptions,
} from "@/lib/ai/ai-types";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * OpenRouter provider. Used as a final fallback when primary providers are
 * exhausted/rate-limited and the free-tier limits make sense for the request.
 */
export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly priority = 40;

  supports(task: AITask, capabilities?: AICapabilities): boolean {
    if (capabilities?.vision) return false;
    return true;
  }

  async chat(options: ChatOptions): Promise<string> {
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
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new AIError("invalid_response", "OpenRouter returned an empty response", { providerId: this.id });
    return content;
  }

  async ping(): Promise<boolean> {
    return Boolean(env.openrouterApiKey);
  }

  private mapError(status: number, body: string): AIError {
    if (status === 429) {
      return new AIError("rate_limited", "OpenRouter rate limit hit", { providerId: this.id });
    }
    if (status >= 500) {
      return new AIError("server_error", `OpenRouter server error (${status})`, { providerId: this.id });
    }
    return new AIError("response", `OpenRouter request failed (${status}): ${body.slice(0, 300)}`, {
      providerId: this.id,
    });
  }
}
