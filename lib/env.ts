/**
 * Boot-time environment validation.
 * Fails fast (throws) when required configuration is missing or malformed
 * so the app never runs in a broken state. Optional values are normalised
 * to safe defaults.
 */

export interface Env {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  pythonaiUrl: string;
  pythonaiTimeoutMs: number;
  rateLimitStore: "memory" | "redis";
  redisUrl: string | null;
  feedbackQueue: "off" | "redis";
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

  const ollamaUrl = parseUrl(
    optional("OLLAMA_URL", "http://localhost:11434"),
    "OLLAMA_URL",
  );
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
    ollamaUrl,
    ollamaModel: optional("OLLAMA_MODEL", "qwen3:8b"),
    ollamaEmbeddingModel: optional("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
    pythonaiUrl,
    pythonaiTimeoutMs: parseIntRange("PYTHONAI_TIMEOUT_MS", 60_000, 1_000, 300_000),
    rateLimitStore: store,
    redisUrl,
    feedbackQueue,
  };
}

export const env = getEnv();
