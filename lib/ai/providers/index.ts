import type { AIProvider } from "@/lib/ai/ai-types";
import { getProviders, type ProviderConfig } from "@/lib/ai/ai-config";
import { GroqProvider } from "@/lib/ai/providers/groq";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { CloudflareProvider } from "@/lib/ai/providers/cloudflare";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";

/**
 * Instantiates the enabled providers, ordered by priority (lower first).
 * Returns an empty array when no cloud AI keys are configured — the router
 * then throws a config error that surfaces as a friendly message.
 */
export function createProviders(): AIProvider[] {
  const instances: Record<ProviderConfig["id"], AIProvider> = {
    groq: new GroqProvider(),
    gemini: new GeminiProvider(),
    cloudflare: new CloudflareProvider(),
    openrouter: new OpenRouterProvider(),
  };

  return getProviders()
    .sort((a, b) => a.priority - b.priority)
    .map((config) => instances[config.id]);
}
