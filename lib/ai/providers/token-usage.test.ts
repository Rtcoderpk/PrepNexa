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
  it("normalizes result.usage when present", async () => {
    mockFetchBody({
      result: { response: "cf", usage: { input_tokens: 6, output_tokens: 3, total_tokens: 9 } },
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

// Sanity: ChatResult type carries nullable TokenUsage as designed.
describe("TokenUsage type", () => {
  it("allows all-null usage (missing metadata)", () => {
    const usage: TokenUsage = {};
    const result: ChatResult = { content: "x", usage };
    expect(result.usage?.promptTokens).toBeUndefined();
  });
});