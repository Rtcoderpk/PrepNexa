/**
 * Provider-independent AI abstractions. The rest of the application only ever
 * depends on these types — never on a provider SDK directly.
 */

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

/** What the request is for. Drives routing + capability/model selection. */
export type AITask =
  | "interview_question"
  | "interview_feedback"
  | "semantic_scoring"
  | "resume_analysis"
  | "job_match"
  | "resume_improvement";

/** Capabilities a request may require of a provider/model. */
export interface AICapabilities {
  /** Provider must support structured (JSON) output. */
  json?: boolean;
  /** Long context — used for resume analysis / feedback transcripts. */
  longContext?: boolean;
  /** Provider must support vision (image input). */
  vision?: boolean;
}

export interface ChatOptions {
  /** Task type — used by the router to pick providers/models. */
  task: AITask;
  /** Concrete provider id + model — set by the router before dispatch. */
  providerId?: string;
  model?: string;
  /** System prompt (persona, constraints). */
  system?: string;
  /** Full conversation so far, oldest → newest. */
  messages: LLMMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Hard timeout in ms. Throws AIError on expiry. */
  timeoutMs?: number;
  /** Optional structured-output hint (e.g. "json") for providers that support it. */
  format?: "json" | undefined;
  capabilities?: AICapabilities;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

/**
 * Token usage metadata normalized across providers. All fields nullable because
 * some providers/responses may not expose usage (observability-only in P3 —
 * never used for budget enforcement).
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Result of a chat call, optionally carrying normalized token usage. */
export interface ChatResult {
  content: string;
  usage: TokenUsage | null;
}

/**
 * A single provider engine. Implementations wrap a cloud provider REST/SDK.
 * `id` uniquely identifies the provider for health tracking.
 *
 * `chat` returns just the text (backward compatible). Providers that can expose
 * token usage implement `chatWithUsage`, which returns the same text plus a
 * normalized TokenUsage (or null when the response has no usage metadata).
 */
export interface AIProvider {
  readonly id: string;
  /** Priority order across providers (lower = tried first). */
  readonly priority: number;
  /** Whether this provider can handle the requested task. */
  supports(task: AITask, capabilities?: AICapabilities): boolean;
  chat(options: ChatOptions): Promise<string>;
  /** Optional: chat + normalized token usage. Callers fall back to `chat`. */
  chatWithUsage?(options: ChatOptions): Promise<ChatResult>;
  stream?(options: ChatOptions): AsyncIterable<string>;
  ping(): Promise<boolean>;
}

export type AIErrorKind =
  | "unreachable"
  | "timeout"
  | "rate_limited"
  | "server_error"
  | "invalid_response"
  | "quota"
  | "config"
  | "response";

export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly providerId?: string;
  /** Retry-After seconds provided by the provider, when available. */
  readonly retryAfterSec?: number;

  constructor(
    kind: AIErrorKind,
    message: string,
    options: { providerId?: string; retryAfterSec?: number } = {},
  ) {
    super(message);
    this.name = "AIError";
    this.kind = kind;
    this.providerId = options.providerId;
    this.retryAfterSec = options.retryAfterSec;
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

/** User-friendly copy — never expose raw provider errors. */
export function userFacingAIError(): string {
  return "AI is temporarily busy. We're automatically switching to another AI engine.";
}
