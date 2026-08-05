import { env } from "@/lib/env";
import { type ILLMProvider } from "@/services/llm/types";
import { OllamaProvider } from "@/services/llm/ollama/ollama-provider";
import { OllamaEmbeddingProvider } from "@/services/llm/ollama/ollama-embedding-provider";

/**
 * Provider factory — the ONLY place the app decides which engine backs the
 * ILLMProvider interface. Today that's Ollama. Future engines (vLLM, LM Studio)
 * implement ILLMProvider and are returned here based on an env var, with zero
 * changes to business logic.
 */
export function createLLMProvider(): ILLMProvider {
  return new OllamaProvider();
}

export function createEmbeddingProvider(): Pick<ILLMProvider, "embed" | "ping"> {
  return new OllamaEmbeddingProvider();
}

/** Convenience health check used by setup pages / a /api/health endpoint. */
export async function isOllamaReady(): Promise<boolean> {
  return createLLMProvider().ping();
}

export { env as llmEnv };