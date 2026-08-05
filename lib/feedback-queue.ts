import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import type { RedisInstance } from "@/lib/redis";

/**
 * Feedback queue seam. Feedback generation is expensive (multi-shot LLM). With
 * FEEDBACK_QUEUE=redis, requests are enqueued to a Redis list and a worker
 * drains them asynchronously; the client is told "queued" and polls the results
 * page. With FEEDBACK_QUEUE=off (default) feedback runs inline, synchronously.
 */

const QUEUE_KEY = "feedback:queue";
const RESULT_TTL_SECONDS = 3600;

export interface FeedbackQueueRequest {
  interviewId: string;
  userId: string;
  role: string | null;
  resumeContext?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface FeedbackQueueResult {
  queued: boolean;
  jobId?: string;
}

export function isFeedbackQueued(): boolean {
  return env.feedbackQueue === "redis";
}

/** Push a feedback job onto the Redis list. Returns null when unavailable. */
export async function enqueueFeedback(
  request: FeedbackQueueRequest,
): Promise<FeedbackQueueResult> {
  const redis = await getRedis();
  if (!redis) return { queued: false };

  const jobId = crypto.randomUUID();
  const payload = JSON.stringify({ id: jobId, ...request });

  try {
    await redis.rpush(QUEUE_KEY, payload);
    return { queued: true, jobId };
  } catch {
    return { queued: false };
  }
}

/**
 * Non-blocking worker drain: pop one job and process it, storing the report in
 * Redis keyed by jobId so the poller can pick it up. Designed to be invoked from
 * a cron/interval in the same process (or a separate worker container).
 */
export async function drainFeedbackQueue(processJob: (job: FeedbackQueueRequest) => Promise<void>): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;

  let processed = 0;
  for (;;) {
    const raw = await redis.lpop(QUEUE_KEY);
    if (raw === null) break;

    try {
      const job = JSON.parse(raw) as FeedbackQueueRequest & { id: string };
      await processJob(job);
      if (job.id) {
        await redis.setex(`feedback:done:${job.id}`, RESULT_TTL_SECONDS, "ok");
      }
      processed += 1;
    } catch {
      // Malformed or failed job — skip so the queue never blocks.
    }
  }
  return processed;
}

/** Poll API: has the job finished? */
export async function isFeedbackJobDone(jobId: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return true;
  const value = await redis.get(`feedback:done:${jobId}`);
  return value !== null;
}

export { RedisInstance };
