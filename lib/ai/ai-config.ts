import { env } from "@/lib/env";
import type { AITask, AICapabilities } from "@/lib/ai/ai-types";

/**
 * Central provider + model configuration. Models per task can be swapped
 * without touching business logic. All keys are read server-side only.
 */

export type ProviderId = "groq" | "gemini" | "cloudflare" | "openrouter";

export interface ProviderConfig {
  id: ProviderId;
  /** Lower priority number = tried first. */
  priority: number;
  /** Capabilities this provider supports. */
  capabilities: {
    json: boolean;
    longContext: boolean;
    vision: boolean;
  };
  enabled: boolean;
}

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  /** Approximate output-token ceiling used for maxOutputTokens defaults. */
  maxTokens: number;
}

export interface TaskConfig {
  /** Model tried first for this task. */
  primary: ModelConfig;
  /** Fallback models, in order. */
  fallbacks: ModelConfig[];
  /** Capabilities the task requires. */
  required: AICapabilities;
  /** Cheaper/smaller model used when a request is known to be trivial. */
  compact?: ModelConfig;
}

export function providerEnabled(id: ProviderId): boolean {
  switch (id) {
    case "groq":
      return Boolean(env.groqApiKey);
    case "gemini":
      return Boolean(env.geminiApiKey);
    case "cloudflare":
      return Boolean(env.cloudflareApiToken && env.cloudflareAccountId);
    case "openrouter":
      return Boolean(env.openrouterApiKey);
  }
}

export function getProviders(): ProviderConfig[] {
  const all: ProviderConfig[] = [
    { id: "groq", priority: 10, capabilities: { json: true, longContext: true, vision: false }, enabled: providerEnabled("groq") },
    { id: "gemini", priority: 20, capabilities: { json: true, longContext: true, vision: true }, enabled: providerEnabled("gemini") },
    { id: "cloudflare", priority: 30, capabilities: { json: true, longContext: false, vision: false }, enabled: providerEnabled("cloudflare") },
    { id: "openrouter", priority: 40, capabilities: { json: true, longContext: true, vision: true }, enabled: providerEnabled("openrouter") },
  ];
  return all.filter((p) => p.enabled);
}

const GROQ_MODELS = {
  fast: { provider: "groq" as ProviderId, model: "llama-3.3-70b-versatile", maxTokens: 4096 },
  feedback: { provider: "groq" as ProviderId, model: "llama-3.3-70b-versatile", maxTokens: 8192 },
};

const GEMINI_MODELS = {
  // gemini-2.0-flash is deprecated/shut down (verified live 404). gemini-flash-latest
  // is the current stable flash alias and is verified to return content + usageMetadata.
  flash: { provider: "gemini" as ProviderId, model: "gemini-flash-latest", maxTokens: 8192 },
};

const CLOUDFLARE_MODEL = {
  provider: "cloudflare" as ProviderId,
  model: "@cf/meta/llama-3.1-8b-instruct",
  maxTokens: 2048,
};

const OPENROUTER_MODEL = {
  provider: "openrouter" as ProviderId,
  model: "openrouter/auto",
  maxTokens: 8192,
};

/**
 * Task → model routing. Ordering reflects cost/speed and capability needs:
 * interviews + semantic scoring are latency-sensitive → Groq first; feedback
 * + resume analysis are long-context JSON-heavy → Gemini first.
 */
export function getTaskConfig(task: AITask): TaskConfig {
  switch (task) {
    case "interview_question":
    case "semantic_scoring":
      return {
        primary: GROQ_MODELS.fast,
        fallbacks: [GEMINI_MODELS.flash, CLOUDFLARE_MODEL, OPENROUTER_MODEL],
        required: {},
        compact: GROQ_MODELS.fast,
      };
    case "interview_feedback":
      return {
        primary: GEMINI_MODELS.flash,
        fallbacks: [GROQ_MODELS.feedback, CLOUDFLARE_MODEL, OPENROUTER_MODEL],
        required: { json: true, longContext: true },
        compact: GROQ_MODELS.fast,
      };
    case "resume_analysis":
    case "job_match":
      return {
        primary: GEMINI_MODELS.flash,
        fallbacks: [GROQ_MODELS.feedback, CLOUDFLARE_MODEL, OPENROUTER_MODEL],
        required: { json: true, longContext: true },
        compact: GROQ_MODELS.fast,
      };
    case "resume_improvement":
      return {
        primary: GEMINI_MODELS.flash,
        fallbacks: [GROQ_MODELS.fast, CLOUDFLARE_MODEL, OPENROUTER_MODEL],
        required: { json: true, longContext: true },
        compact: GROQ_MODELS.fast,
      };
  }
}

/** True when any cloud AI provider is configured. */
export function hasAnyAiProvider(): boolean {
  return getProviders().length > 0;
}
