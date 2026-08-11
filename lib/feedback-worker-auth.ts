/**
 * Feedback-worker authentication. The worker secret is accepted from the
 * `x-worker-secret` HEADER (self-hosted PM2/container drain) OR from a
 * `?secret=` QUERY param (Vercel Cron, which cannot set custom headers — bake
 * the secret into the cron path as documented by Vercel). Both compare against
 * the same server-side FEEDBACK_WORKER_SECRET in constant time; the secret is
 * never exposed to the browser.
 */
import type { NextRequest } from "next/server";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** True when the request carries the correct worker secret. */
export function verifyWorkerSecret(
  request: NextRequest,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const header = request.headers.get("x-worker-secret");
  const query = request.nextUrl.searchParams.get("secret");
  const candidate = header ?? query;
  if (!candidate) return false;
  return timingSafeEqual(candidate, secret);
}