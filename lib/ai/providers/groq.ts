import { env } from "@/lib/env";
import {
  AIError,
  type AICapabilities,
  type AIProvider,
  type AITask,
  type ChatOptions,
  type ChatResult,
} from "@/lib/ai/ai-types";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Groq provider. OpenAI-compatible chat completions API. */
export class GroqProvider implements AIProvider {
  readonly id = "groq";
  readonly priority = 10;

  supports(task: AITask, capabilities?: AICapabilities): boolean {
    // Groq text models are not vision-capable; resume analysis currently uses
    // extracted text only, so Groq can serve it. Vision requests are rejected.
    if (capabilities?.vision) return false;
    return true;
  }

  async chat(options: ChatOptions): Promise<string> {
    return (await this.chatWithUsage(options)).content;
  }

  async chatWithUsage(options: ChatOptions): Promise<ChatResult> {
    if (!env.groqApiKey) throw new AIError("config", "Groq API key not configured", { providerId: this.id });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: JSON.stringify({
        model: options.model ?? "llama-3.3-70b-versatile",
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
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new AIError("invalid_response", "Groq returned an empty response", { providerId: this.id });
    // Normalize OpenAI-compatible usage into the common shape (nullable).
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : null;
    return { content, usage };
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    if (!env.groqApiKey) throw new AIError("config", "Groq API key not configured", { providerId: this.id });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: JSON.stringify({
        model: options.model ?? "llama-3.3-70b-versatile",
        messages: [
          ...(options.system ? [{ role: "system", content: options.system }] : []),
          ...options.messages,
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxOutputTokens,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw this.mapError(response.status, await response.text().catch(() => ""));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Malformed SSE frame — skip.
        }
      }
    }
  }

  async ping(): Promise<boolean> {
    if (!env.groqApiKey) return false;
    return true;
  }

  private mapError(status: number, body: string): AIError {
    const retryAfter = Number(
      body.match(/"retry-after"\s*:\s*(\d+)/i)?.[1] ??
        ("" as string),
    );
    if (status === 429) {
      return new AIError("rate_limited", "Groq rate limit hit", {
        providerId: this.id,
        retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : undefined,
      });
    }
    // 401/403 = invalid/forbidden credentials — a configuration problem, not a
    // transient provider availability issue. Do not fail over to another provider.
    if (status === 401 || status === 403) {
      return new AIError("config", `Groq credentials rejected (${status})`, { providerId: this.id });
    }
    if (status >= 500) {
      return new AIError("server_error", `Groq server error (${status})`, { providerId: this.id });
    }
    return new AIError("response", `Groq request failed (${status}): ${body.slice(0, 300)}`, {
      providerId: this.id,
    });
  }
}
