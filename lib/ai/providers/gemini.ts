import { env } from "@/lib/env";
import {
  AIError,
  type AICapabilities,
  type AIProvider,
  type AITask,
  type ChatOptions,
} from "@/lib/ai/ai-types";

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Builds the Gemini generateContent URL with the API key in the query string
 * (Gemini's documented auth). The key is NEVER logged or surfaced: this helper
 * is the only place the key touches a URL, and `redactedUrl()` exists so any
 * telemetry/error path can log a sanitized version.
 */
function apiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${env.geminiApiKey}`;
}

/** Sanitized URL for logging/telemetry — API key redacted. */
export function redactedUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=<REDACTED>`;
}

/** Google Gemini provider. Text-only generateContent. */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly priority = 20;

  supports(task: AITask, capabilities?: AICapabilities): boolean {
    // Gemini flash is a text model via this integration; vision-capable
    // requests would need a multimodal model — not wired here.
    if (capabilities?.vision) return false;
    return true;
  }

  async chat(options: ChatOptions): Promise<string> {
    if (!env.geminiApiKey) throw new AIError("config", "Gemini API key not configured", { providerId: this.id });

    const model = options.model ?? "gemini-2.0-flash";
    const contents = [
      ...(options.system
        ? [{ role: "user", parts: [{ text: options.system }] }]
        : []),
      ...options.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(apiUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens,
          ...(options.format === "json" ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw this.mapError(response.status, body);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) throw new AIError("invalid_response", "Gemini returned an empty response", { providerId: this.id });
    return text;
  }

  async ping(): Promise<boolean> {
    return Boolean(env.geminiApiKey);
  }

  private mapError(status: number, body: string): AIError {
    // Never include the request body verbatim — it can echo the API key or
    // other sensitive fields. Truncate and strip key-like tokens.
    const safeBody = sanitizeBody(body);
    if (status === 429) {
      return new AIError("rate_limited", "Gemini rate limit hit", {
        providerId: this.id,
        retryAfterSec: parseRetryAfter(body),
      });
    }
    // 401/403 = invalid/forbidden credentials — a configuration problem, not a
    // transient provider availability issue. Do not fail over to another provider.
    if (status === 401 || status === 403) {
      return new AIError("config", `Gemini credentials rejected (${status})`, { providerId: this.id });
    }
    // 400 with a quota/limit message → treat as temporary quota exhaustion.
    if (status === 400 && /quota|limit|exhausted/i.test(body)) {
      return new AIError("quota", "Gemini quota exhausted", { providerId: this.id });
    }
    if (status >= 500) {
      return new AIError("server_error", `Gemini server error (${status})`, { providerId: this.id });
    }
    return new AIError("response", `Gemini request failed (${status}): ${safeBody}`, {
      providerId: this.id,
    });
  }
}

/** Strips anything that looks like an API key/token from a response body. */
function sanitizeBody(body: string): string {
  return body
    .replace(/AIza[A-Za-z0-9_\-]{30,}/g, "<REDACTED>")
    .slice(0, 300);
}

/** Parses Retry-After (seconds) from a Gemini error body when present. */
function parseRetryAfter(body: string): number | undefined {
  const match = body.match(/"retry-after"\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
