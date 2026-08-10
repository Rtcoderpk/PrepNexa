/**
 * Boot-time environment validation.
 * Fails fast (throws) when required configuration is missing or malformed
 * so the app never runs in a broken state. Optional values are normalised
 * to safe defaults.
 *
 * AI keys are read server-side ONLY — never exposed to the browser.
 */

export interface Env {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
  // Cloud AI providers (server-side only). At least one must be configured.
  groqApiKey: string | null;
  geminiApiKey: string | null;
  cloudflareApiToken: string | null;
  cloudflareAccountId: string | null;
  openrouterApiKey: string | null;
  pythonaiUrl: string;
  pythonaiTimeoutMs: number;
  rateLimitStore: "memory" | "redis";
  redisUrl: string | null;
  feedbackQueue: "off" | "redis";
  /** Per-user AI budget guardrails (server-side, cost control). */
  aiDailyBudget: number;
  aiHourlyBudget: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See .env.example for the full list.`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) return fallback;
  return value.trim();
}

function optionalNullable(name: string): string | null {
  const value = process.env[name];
  if (!value || !value.trim()) return null;
  return value.trim();
}

function parseUrl(value: string, name: string): string {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new Error("not http(s)");
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL for ${name}: ${value}`);
  }
}

function parseIntRange(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid value for ${name}: expected integer ${min}-${max}`);
  }
  return value;
}

export function getEnv(): Env {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const pythonaiUrl = parseUrl(
    optional("PYTHONAI_URL", "http://localhost:8000"),
    "PYTHONAI_URL",
  );

  const store = optional("RATE_LIMIT_STORE", "memory");
  if (store !== "memory" && store !== "redis") {
    throw new Error(`Invalid RATE_LIMIT_STORE: ${store} (expected "memory"|"redis")`);
  }

  const redisUrl =
    store === "redis"
      ? required("REDIS_URL")
      : process.env.REDIS_URL?.trim() || null;

  const feedbackQueue = optional("FEEDBACK_QUEUE", "off");
  if (feedbackQueue !== "off" && feedbackQueue !== "redis") {
    throw new Error(
      `Invalid FEEDBACK_QUEUE: ${feedbackQueue} (expected "off"|"redis")`,
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    appUrl: parseUrl(
      optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
      "NEXT_PUBLIC_APP_URL",
    ),
    groqApiKey: optionalNullable("GROQ_API_KEY"),
    geminiApiKey: optionalNullable("GEMINI_API_KEY"),
    cloudflareApiToken: optionalNullable("CLOUDFLARE_API_TOKEN"),
    cloudflareAccountId: optionalNullable("CLOUDFLARE_ACCOUNT_ID"),
    openrouterApiKey: optionalNullable("OPENROUTER_API_KEY"),
    pythonaiUrl,
    pythonaiTimeoutMs: parseIntRange("PYTHONAI_TIMEOUT_MS", 60_000, 1_000, 300_000),
    rateLimitStore: store,
    redisUrl,
    feedbackQueue,
    // 0 disables the budget guard (set explicit limits to enable).
    aiDailyBudget: parseIntRange("AI_DAILY_BUDGET", 0, 0, 1_000_000),
    aiHourlyBudget: parseIntRange("AI_HOURLY_BUDGET", 0, 0, 100_000),
  };
}

export const env = getEnv();
