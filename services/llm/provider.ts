import { env } from "@/lib/env";
import {
  generateAIResponse,
  generateAIStream,
} from "@/lib/ai/ai-router";
import { hasAnyAiProvider } from "@/lib/ai/ai-config";
import { AIError } from "@/lib/ai/ai-types";
import {
  type ChatOptions,
  type ILLMProvider,
} from "@/services/llm/types";

/**
 * Provider factory — the app never depends on a single AI engine. All cloud
 * providers (Groq, Gemini, Cloudflare, OpenRouter) are routed through
 * lib/ai/ai-router with automatic failover. This file adapts the legacy
 * ILLMProvider interface to the new router so business logic is untouched.
 */
export function createLLMProvider(): ILLMProvider {
  return new RoutedLLMProvider();
}

/** Health check: at least one cloud provider must be configured. */
export async function isLLMReady(): Promise<boolean> {
  return hasAnyAiProvider();
}

export { env as llmEnv };

/** ILLMProvider adapter over the intelligent AI router. */
class RoutedLLMProvider implements ILLMProvider {
  async chat(options: ChatOptions): Promise<string> {
    return generateAIResponse(
      {
        task: options.task ?? "interview_question",
        system: options.system,
        messages: options.messages,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        timeoutMs: options.timeoutMs,
        format: options.format,
      },
      { userId: options.userId, dedupKey: options.dedupKey },
    );
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    const iterable = await generateAIStream(
      {
        task: options.task ?? "interview_question",
        system: options.system,
        messages: options.messages,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        timeoutMs: options.timeoutMs,
        format: options.format,
      },
      { userId: options.userId, dedupKey: options.dedupKey },
    );
    for await (const chunk of iterable) {
      yield chunk;
    }
  }

  async embed(text: string): Promise<{ embedding: number[]; model: string }> {
    // Cloud providers used here are chat-oriented; embeddings are optional.
    // Callers that need real embeddings should use a dedicated embedding API.
    throw new AIError("config", "Embeddings are not available with cloud chat providers");
  }

  async ping(): Promise<boolean> {
    return isLLMReady();
  }
}
