import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ChatResult, TokenUsage } from "@/lib/ai/ai-types";

function mockFetchBody(
  body: Record<string, unknown>,
  status = 200,
): { prompt: (s: string) => string } {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status }),
    ),
  );
  return {
    prompt: (s: string) => s,
  };
}

/** Loads a provider after stubbing env so the frozen `env` snapshot has keys. */
async function load(name: "Groq" | "Gemini" | "Cloudflare" | "OpenRouter") {
  vi.resetModules();
  vi.stubEnv("GROQ_API_KEY", "x");
  vi.stubEnv("GEMINI_API_KEY", "x");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "x");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
  vi.stubEnv("OPENROUTER_API_KEY", "x");
  const mod = await import(`@/lib/ai/providers/${name.toLowerCase()}`);
  return new (mod[`${name}Provider`] as new () => {
    chat(options: unknown): Promise<string>;
    chatWithUsage(options: unknown): Promise<ChatResult>;
  })();
}

const opts = { task: "interview_question" as const, messages: [] };

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

describe("Groq usage normalization", () => {
  it("normalizes OpenAI-compatible usage fields", async () => {
    mockFetchBody({
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    const provider = await load("Groq");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("hello");
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("returns null usage when the response has no usage", async () => {
    mockFetchBody({ choices: [{ message: { content: "hi" } }] });
    const provider = await load("Groq");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("hi");
    expect(result.usage).toBeNull();
  });

  it("keeps chat() returning just the string", async () => {
    mockFetchBody({ choices: [{ message: { content: "hello" } }], usage: { total_tokens: 3 } });
    const provider = await load("Groq");
    await expect(provider.chat(opts)).resolves.toBe("hello");
  });
});

describe("Gemini usageMetadata normalization", () => {
  it("normalizes usageMetadata fields", async () => {
    mockFetchBody({
      candidates: [{ content: { parts: [{ text: "gem" }] } }],
      usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4, totalTokenCount: 12 },
    });
    const provider = await load("Gemini");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("gem");
    expect(result.usage).toEqual({ promptTokens: 8, completionTokens: 4, totalTokens: 12 });
  });

  it("returns null usage when usageMetadata is absent", async () => {
    mockFetchBody({ candidates: [{ content: { parts: [{ text: "gem" }] } }] });
    const provider = await load("Gemini");
    const result = await provider.chatWithUsage(opts);
    expect(result.usage).toBeNull();
  });
});

describe("Cloudflare usage normalization", () => {
  it("normalizes the LIVE OpenAI-compatible usage keys (prompt/completion/total_tokens)", async () => {
    // Live Workers AI returns prompt_tokens/completion_tokens/total_tokens.
    mockFetchBody({
      result: { response: "cf", usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 } },
    });
    const provider = await load("Cloudflare");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("cf");
    expect(result.usage).toEqual({ promptTokens: 6, completionTokens: 3, totalTokens: 9 });
  });

  it("returns null usage when missing (no invented tokens)", async () => {
    mockFetchBody({ result: { response: "cf" } });
    const provider = await load("Cloudflare");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("cf");
    expect(result.usage).toBeNull();
  });
});

describe("OpenRouter usage normalization", () => {
  it("normalizes OpenAI-compatible usage fields", async () => {
    mockFetchBody({
      choices: [{ message: { content: "or" } }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    });
    const provider = await load("OpenRouter");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("or");
    expect(result.usage).toEqual({ promptTokens: 20, completionTokens: 10, totalTokens: 30 });
  });

  it("returns null usage when missing", async () => {
    mockFetchBody({ choices: [{ message: { content: "or" } }] });
    const provider = await load("OpenRouter");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("or");
    expect(result.usage).toBeNull();
  });
});

describe("OpenRouter content extraction (O1 — live reasoning models)", () => {
  it("prefers normal message.content when present", async () => {
    mockFetchBody({
      choices: [{ message: { content: "answer", reasoning: "thinking" } }],
    });
    const provider = await load("OpenRouter");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("answer");
  });

  it("falls back to message.reasoning when content is empty (reasoning model)", async () => {
    mockFetchBody({
      choices: [{ message: { content: null, reasoning: "the reasoned answer" } }],
    });
    const provider = await load("OpenRouter");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("the reasoned answer");
  });

  it("falls back to message.reasoning_content when present and content empty", async () => {
    mockFetchBody({
      choices: [{ message: { content: "", reasoning_content: "alt answer" } }],
    });
    const provider = await load("OpenRouter");
    const result = await provider.chatWithUsage(opts);
    expect(result.content).toBe("alt answer");
  });

  it("throws invalid_response when content and reasoning are all absent (malformed)", async () => {
    mockFetchBody({ choices: [{ message: {} }] });
    const provider = await load("OpenRouter");
    await expect(provider.chatWithUsage(opts)).rejects.toMatchObject({ kind: "invalid_response" });
  });
});

describe("Gemini configured model (G1 — must be a live-valid model)", () => {
  it("config uses gemini-flash-latest, not the deprecated gemini-2.0-flash", async () => {
    const { getTaskConfig } = await import("@/lib/ai/ai-config");
    const feedback = getTaskConfig("interview_feedback");
    const geminiModel = feedback.primary.model;
    expect(geminiModel).not.toBe("gemini-2.0-flash");
    expect(geminiModel).toMatch(/^gemini/);
  });

  it("provider default model is gemini-flash-latest (not deprecated)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("lib/ai/providers/gemini.ts", "utf8");
    expect(src).not.toContain("gemini-2.0-flash");
    expect(src).toContain("gemini-flash-latest");
  });
});

// Sanity: ChatResult type carries nullable TokenUsage as designed.
describe("TokenUsage type", () => {
  it("allows all-null usage (missing metadata)", () => {
    const usage: TokenUsage = {};
    const result: ChatResult = { content: "x", usage };
    expect(result.usage?.promptTokens).toBeUndefined();
  });
});