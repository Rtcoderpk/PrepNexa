/**
 * LLM provider contract. The entire application depends on this interface,
 * never on an inference engine directly. Swap engines by changing the factory
 * in provider.ts — business logic stays untouched.
 */

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface ChatOptions {
  /** System prompt (persona, constraints). */
  system?: string;
  /** Full conversation so far, oldest → newest. */
  messages: LLMMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Hard timeout in ms. Throws LLMError on expiry. */
  timeoutMs?: number;
  /** Optional structured-output hint (e.g. "json") for providers that support it. */
  format?: "json" | undefined;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface ILLMProvider {
  /** Single round-trip completion. */
  chat(options: ChatOptions): Promise<string>;
  /** Streaming completion (optional; interview UI can adopt later). */
  stream?(options: ChatOptions): AsyncIterable<string>;
  /** Embed a single text string. */
  embed(text: string): Promise<EmbeddingResult>;
  /** Health check — returns false when the engine is unreachable. */
  ping(): Promise<boolean>;
}

export class LLMError extends Error {
  readonly kind: "unreachable" | "timeout" | "response" | "config";
  constructor(kind: LLMError["kind"], message: string) {
    super(message);
    this.name = "LLMError";
    this.kind = kind;
  }
}

export function isLLMError(error: unknown): error is LLMError {
  return error instanceof LLMError;
}
