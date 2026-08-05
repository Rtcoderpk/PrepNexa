import { env } from "@/lib/env";
import { LLMError, type ChatOptions, type ILLMProvider, type LLMMessage } from "@/services/llm/types";
import { OllamaClient } from "@/services/llm/ollama/ollama-client";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Ollama-backed provider. Default model is qwen3:8b; override with OLLAMA_MODEL.
 * There is deliberately no cloud fallback — if Ollama is down the caller sees
 * a clear setup error (LLMError.kind === "unreachable").
 */
export class OllamaProvider implements ILLMProvider {
  readonly model: string;
  private readonly client: OllamaClient;

  constructor(
    options: { baseUrl?: string; model?: string } = {},
  ) {
    this.model = options.model ?? env.ollamaModel;
    this.client = new OllamaClient(
      options.baseUrl ?? env.ollamaUrl,
      this.model,
    );
  }

  async chat(options: ChatOptions): Promise<string> {
    const messages: LLMMessage[] = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    for (const message of options.messages) {
      messages.push({ role: message.role, content: message.content });
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.client.chat(
        this.model,
        messages,
        {
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          format: options.format,
          options: options.maxOutputTokens
            ? { num_predict: options.maxOutputTokens }
            : undefined,
        },
        { timeoutMs },
      );
    } catch (error) {
      if (error instanceof LLMError) throw error;
      throw new LLMError("response", "Ollama chat failed unexpectedly");
    }
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    const messages: LLMMessage[] = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    for (const message of options.messages) {
      messages.push({ role: message.role, content: message.content });
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${env.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        }),
      });

      if (!response.ok || !response.body) {
        throw new LLMError(
          "response",
          `Ollama stream failed (${response.status})`,
        );
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
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { message?: { content?: string } };
            if (chunk.message?.content) yield chunk.message.content;
          } catch {
            // Ignore malformed NDJSON lines; Ollama occasionally emits partial frames.
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("timeout", "Ollama stream timed out");
      }
      if (error instanceof LLMError) throw error;
      throw new LLMError("unreachable", "Ollama stream failed unexpectedly");
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(text: string) {
    const embedding = await this.client.embed(
      env.ollamaEmbeddingModel,
      text,
      { timeoutMs: DEFAULT_TIMEOUT_MS },
    );
    return { embedding, model: env.ollamaEmbeddingModel };
  }

  async ping(): Promise<boolean> {
    return this.client.ping(5_000);
  }
}
