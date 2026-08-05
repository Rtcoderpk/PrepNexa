#!/usr/bin/env node
/**
 * PM2 cron worker: drains the Redis feedback queue by invoking the app's own
 * /api/feedback-worker endpoint (guarded by FEEDBACK_WORKER_SECRET). Run from
 * ecosystem.config.js via cron_restart. Safe to call repeatedly — a no-op when
 * the queue is empty.
 */

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const SECRET = process.env.FEEDBACK_WORKER_SECRET;

if (!SECRET) {
  console.error("[drain-feedback] FEEDBACK_WORKER_SECRET not set; skipping.");
  process.exit(0);
}

fetch(`${BASE_URL}/api/feedback-worker`, {
  headers: { "x-worker-secret": SECRET },
  signal: AbortSignal.timeout(60_000),
})
  .then(async (res) => {
    if (!res.ok) {
      console.error(`[drain-feedback] worker responded ${res.status}`);
      process.exit(0);
    }
    const data = await res.json();
    console.log(`[drain-feedback] processed ${data.processed} job(s)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[drain-feedback] failed: ${err.message}`);
    process.exit(0);
  });
