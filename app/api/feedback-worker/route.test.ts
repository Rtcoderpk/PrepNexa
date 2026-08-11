import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { verifyWorkerSecret } from "@/lib/feedback-worker-auth";

function makeRequest(header?: string | null, querySecret?: string | null) {
  return {
    headers: { get: (name: string) => (name === "x-worker-secret" ? header ?? null : null) },
    nextUrl: { searchParams: { get: (name: string) => (name === "secret" ? querySecret ?? null : null) } },
  } as unknown as NextRequest;
}

describe("feedback-worker auth", () => {
  const SECRET = "supersecret";

  it("authorizes a request with the correct header secret", () => {
    expect(verifyWorkerSecret(makeRequest(SECRET), SECRET)).toBe(true);
  });

  it("authorizes a request with the correct query `secret` param (Vercel cron path)", () => {
    expect(verifyWorkerSecret(makeRequest(null, SECRET), SECRET)).toBe(true);
  });

  it("rejects a request with no secret", () => {
    expect(verifyWorkerSecret(makeRequest(), SECRET)).toBe(false);
  });

  it("rejects a request with a wrong secret", () => {
    expect(verifyWorkerSecret(makeRequest("wrong", "wrong"), SECRET)).toBe(false);
  });

  it("rejects when FEEDBACK_WORKER_SECRET is not configured", () => {
    expect(verifyWorkerSecret(makeRequest(SECRET), undefined)).toBe(false);
  });

  it("is not vulnerable to trivial length/timing bypasses", () => {
    // A wrong secret of different length must not pass.
    expect(verifyWorkerSecret(makeRequest("short"), SECRET)).toBe(false);
  });
});