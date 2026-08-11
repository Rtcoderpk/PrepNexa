import { env } from "@/lib/env";
import {
  AIError,
  type AICapabilities,
  type AIProvider,
  type AITask,
  type ChatOptions,
} from "@/lib/ai/ai-types";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

/** Cloudflare Workers AI provider (text models via REST). */
export class CloudflareProvider implements AIProvider {
  readonly id = "cloudflare";
  readonly priority = 30;

  supports(task: AITask, capabilities?: AICapabilities): boolean {
    if (capabilities?.vision) return false;
    // Small context window — not suitable for long resume/feedback passes.
    if (capabilities?.longContext) return false;
    return true;
  }

  async chat(options: ChatOptions): Promise<string> {
    if (!env.cloudflareApiToken || !env.cloudflareAccountId) {
      throw new AIError("config", "Cloudflare API credentials not configured", { providerId: this.id });
    }

    const model = options.model ?? DEFAULT_MODEL;
    const messages = [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      ...options.messages,
    ];

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.cloudflareApiToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        body: JSON.stringify({
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxOutputTokens,
          ...(options.format === "json" ? { response_format: { type: "json_object" } } : {}),
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw this.mapError(response.status, body);
    }

    const data = (await response.json()) as {
      result?: { response?: string };
      errors?: Array<{ message?: string }>;
    };

    if (data.errors?.length) {
      throw new AIError("response", `Cloudflare: ${data.errors[0].message ?? "unknown error"}`, {
        providerId: this.id,
      });
    }

    const content = data.result?.response?.trim();
    if (!content) throw new AIError("invalid_response", "Cloudflare returned an empty response", { providerId: this.id });
    return content;
  }

  async ping(): Promise<boolean> {
    return Boolean(env.cloudflareApiToken && env.cloudflareAccountId);
  }

  private mapError(status: number, body: string): AIError {
    if (status === 429) {
      return new AIError("rate_limited", "Cloudflare rate limit hit", {
        providerId: this.id,
        retryAfterSec: parseRetryAfter(body),
      });
    }
    // 401/403 = invalid/forbidden credentials — a configuration problem, not a
    // transient provider availability issue. Do not fail over to another provider.
    if (status === 401 || status === 403) {
      return new AIError("config", `Cloudflare credentials rejected (${status})`, { providerId: this.id });
    }
    if (status >= 500) {
      return new AIError("server_error", `Cloudflare server error (${status})`, { providerId: this.id });
    }
    return new AIError("response", `Cloudflare request failed (${status}): ${body.slice(0, 300)}`, {
      providerId: this.id,
    });
  }
}

/** Parses Retry-After (seconds) from a Cloudflare error body when present. */
function parseRetryAfter(body: string): number | undefined {
  const match = body.match(/"retry-after"\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
