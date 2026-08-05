import { env } from "@/lib/env";

/**
 * Redis client factory. Uses dynamic import so the `ioredis` dependency is only
 * loaded when Redis is actually configured (RATE_LIMIT_STORE=redis or REDIS_URL
 * set). Returns null otherwise.
 */
type RedisInstance = {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  del(key: string): Promise<void>;
  rpush(key: string, value: string): Promise<number>;
  lpop(key: string): Promise<string | null>;
  quit(): Promise<void>;
};

let singleton: Promise<RedisInstance | null> | null = null;

export type { RedisInstance };

export async function getRedis(): Promise<RedisInstance | null> {
  const redisEnabled =
    env.rateLimitStore === "redis" ||
    env.feedbackQueue === "redis" ||
    Boolean(env.redisUrl);
  if (!redisEnabled) return null;

  if (!singleton) {
    singleton = (async () => {
      const IORedis = (await import("ioredis")).default;
      const client = new IORedis(env.redisUrl!, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      const RedisWrapper: RedisInstance = {
        async get(key) {
          const v = await client.get(key);
          return v ?? null;
        },
        async setex(key, seconds, value) {
          await client.setex(key, seconds, value);
        },
        async incr(key) {
          return client.incr(key);
        },
        async pttl(key) {
          return client.pttl(key);
        },
        async expire(key, seconds) {
          await client.expire(key, seconds);
        },
        async del(key) {
          await client.del(key);
        },
        async rpush(key, value) {
          return client.rpush(key, value);
        },
        async lpop(key) {
          const value = await client.lpop(key);
          return value ?? null;
        },
        async quit() {
          await client.quit();
        },
      };
      return RedisWrapper;
    })();
  }

  try {
    return await singleton;
  } catch {
    return null;
  }
}