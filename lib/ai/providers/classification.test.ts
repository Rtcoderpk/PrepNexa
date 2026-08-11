import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AIError, AIProvider } from "@/lib/ai/ai-types";

function mockFetch(status: number, body = "{}"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body, {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

const opts = { task: "interview_question" as const, messages: [] };

/**
 * Re-imports a provider module AFTER stubbing env, so the frozen `env`
 * singleton (lib/env.ts) snapshots the AI keys. `withKeys=false` omits the
 * key so the provider's missing-key `config` path is exercised.
 */
async function load(
  name: "Groq" | "Gemini" | "Cloudflare" | "OpenRouter",
  withKeys = true,
): Promise<AIProvider> {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (withKeys) {
    vi.stubEnv("GROQ_API_KEY", "x");
    vi.stubEnv("GEMINI_API_KEY", "x");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "x");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("OPENROUTER_API_KEY", "x");
  }
  const mod = await import(`@/lib/ai/providers/${name.toLowerCase()}`);
  return new (mod[`${name}Provider`] as new () => AIProvider)();
}

describe("Provider error classification", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "x");
    vi.stubEnv("GEMINI_API_KEY", "x");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "x");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("OPENROUTER_API_KEY", "x");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("Groq", () => {
    it("missing key → config", async () => {
      const provider = await load("Groq", false);
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("401 → config", async () => {
      mockFetch(401);
      const provider = await load("Groq");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("403 → config", async () => {
      mockFetch(403);
      const provider = await load("Groq");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("429 → rate_limited with retry-after", async () => {
      mockFetch(429, JSON.stringify({ "retry-after": 2 }));
      const provider = await load("Groq");
      const err = await provider.chat(opts).catch((e: AIError) => e);
      expect(err).toMatchObject({ kind: "rate_limited", retryAfterSec: 2 });
    });

    it("500 → server_error (transient, failover-eligible)", async () => {
      mockFetch(500);
      const provider = await load("Groq");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "server_error" });
    });
  });

  describe("Gemini", () => {
    it("missing key → config", async () => {
      const provider = await load("Gemini", false);
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("401 → config", async () => {
      mockFetch(401);
      const provider = await load("Gemini");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("quota 400 → quota", async () => {
      mockFetch(400, "quota exhausted");
      const provider = await load("Gemini");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "quota" });
    });

    it("500 → server_error", async () => {
      mockFetch(500);
      const provider = await load("Gemini");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "server_error" });
    });
  });

  describe("Cloudflare", () => {
    it("missing credentials → config", async () => {
      const provider = await load("Cloudflare", false);
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("401 → config", async () => {
      mockFetch(401);
      const provider = await load("Cloudflare");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("429 → rate_limited", async () => {
      mockFetch(429);
      const provider = await load("Cloudflare");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "rate_limited" });
    });
  });

  describe("OpenRouter", () => {
    it("missing key → config", async () => {
      const provider = await load("OpenRouter", false);
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("403 → config", async () => {
      mockFetch(403);
      const provider = await load("OpenRouter");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "config" });
    });

    it("500 → server_error", async () => {
      mockFetch(500);
      const provider = await load("OpenRouter");
      await expect(provider.chat(opts)).rejects.toMatchObject({ kind: "server_error" });
    });
  });
});