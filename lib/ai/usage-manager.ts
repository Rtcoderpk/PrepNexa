import type { AITask } from "@/lib/ai/ai-types";

/**
 * In-memory AI request usage + dedup. Coarse counters are kept per-instance;
 * durable server-side usage enforcement lives in lib/usage.ts (DB-backed).
 * This layer exists to avoid duplicate simultaneous requests for the same key.
 */

interface UsageEntry {
  count: number;
  lastRequestAt: number;
  /** In-flight dedup keys, so the same request isn't fired twice concurrently. */
  inFlight: Set<string>;
}

const usageByTask = new Map<AITask, UsageEntry>();

function entry(task: AITask): UsageEntry {
  let e = usageByTask.get(task);
  if (!e) {
    e = { count: 0, lastRequestAt: 0, inFlight: new Set() };
    usageByTask.set(task, e);
  }
  return e;
}

export function recordRequest(task: AITask): void {
  const e = entry(task);
  e.count += 1;
  e.lastRequestAt = Date.now();
}

export function getRequestCount(task: AITask): number {
  return entry(task).count;
}

export function getUsageSnapshot(): Record<string, { count: number; lastRequestAt: number }> {
  const out: Record<string, { count: number; lastRequestAt: number }> = {};
  for (const [task, e] of usageByTask) {
    out[task] = { count: e.count, lastRequestAt: e.lastRequestAt };
  }
  return out;
}

/** Returns false when a request with the same key is already in flight for this task. */
export function beginInFlight(task: AITask, key: string): boolean {
  const e = entry(task);
  if (e.inFlight.has(key)) return false;
  e.inFlight.add(key);
  return true;
}

export function endInFlight(task: AITask, key: string): void {
  entry(task).inFlight.delete(key);
}
