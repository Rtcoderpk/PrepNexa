/**
 * Minimal, typed HTTP client for the Ollama REST API.
 * See https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import { LLMError, type LLMMessage } from "@/services/llm/types";

export interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

interface RequestOptions {
  timeoutMs: number;
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new LLMError(
        "timeout",
        `Ollama request timed out after ${timeoutMs}ms`,
      );
    }
    throw new LLMError(
      "unreachable",
      `Ollama is unreachable at ${url}. Is the Ollama service running?`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(baseUrl: string, defaultModel: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultModel = defaultModel;
  }

  async chat(
    model: string,
    messages: LLMMessage[],
    opts: {
      temperature?: number;
      format?: "json";
      options?: Partial<{ num_predict: number }>;
    } = {},
    req: RequestOptions,
  ): Promise<string> {
    const response = await fetchWithTimeout(
      buildUrl(this.baseUrl, "/api/chat"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: opts.options,
          ...(opts.format ? { format: opts.format } : {}),
          temperature: opts.temperature,
        }),
      },
      req.timeoutMs,
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new LLMError(
        "response",
        `Ollama chat failed (${response.status}): ${detail.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content?.trim();
    if (!content) {
      throw new LLMError("response", "Ollama returned an empty response");
    }
    return content;
  }

  async embed(
    model: string,
    input: string,
    req: RequestOptions,
  ): Promise<number[]> {
    const response = await fetchWithTimeout(
      buildUrl(this.baseUrl, "/api/embed"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input }),
      },
      req.timeoutMs,
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new LLMError(
        "response",
        `Ollama embed failed (${response.status}): ${detail.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      embeddings?: number[][];
      embedding?: number[];
    };
    const embedding = data.embeddings?.[0] ?? data.embedding;
    if (!embedding || embedding.length === 0) {
      throw new LLMError("response", "Ollama returned an empty embedding");
    }
    return embedding;
  }

  async ping(timeoutMs: number): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        buildUrl(this.baseUrl, "/api/tags"),
        { method: "GET" },
        timeoutMs,
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
