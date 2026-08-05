import { env } from "@/lib/env";
import { type EmbeddingResult, type ILLMProvider } from "@/services/llm/types";
import { OllamaClient } from "@/services/llm/ollama/ollama-client";

/**
 * Embedding-only provider (default model nomic-embed-text).
 * Kept separate so conversation memory / resume search can embed without
 * depending on the chat model's availability.
 */
export class OllamaEmbeddingProvider implements Pick<ILLMProvider, "embed" | "ping"> {
  readonly model: string;
  private readonly client: OllamaClient;

  constructor(options: { baseUrl?: string; model?: string } = {}) {
    this.model = options.model ?? env.ollamaEmbeddingModel;
    this.client = new OllamaClient(
      options.baseUrl ?? env.ollamaUrl,
      this.model,
    );
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const embedding = await this.client.embed(this.model, text, {
      timeoutMs: 30_000,
    });
    return { embedding, model: this.model };
  }

  async ping(): Promise<boolean> {
    return this.client.ping(5_000);
  }
}
