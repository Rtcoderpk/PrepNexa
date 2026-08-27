import { describe, expect, it } from "vitest";
import { safeReadJson, httpStatusLabel } from "@/lib/api-json";

/**
 * Regression tests for the exact production failure:
 * `Unexpected token 'A', "An error o"... is not valid JSON`.
 *
 * The frontend previously called response.json() blindly. When a serverless
 * timeout or unhandled error returned plain text / HTML / empty body, that
 * threw a raw SyntaxError shown to the user. safeReadJson must never throw —
 * it returns a normalized { ok, status, data, error, notJson } shape.
 */
describe("safeReadJson", () => {
  it("parses a valid 2xx JSON success response", async () => {
    const res = new Response(JSON.stringify({ score: 80 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const result = await safeReadJson(res);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ score: 80 });
    expect(result.error).toBeNull();
    expect(result.notJson).toBe(false);
  });

  it("parses a valid 4xx JSON error response", async () => {
    const res = new Response(
      JSON.stringify({ error: "You've used all your free checks." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
    const result = await safeReadJson(res);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("free checks");
    expect(result.notJson).toBe(false);
  });

  it("handles a plain-text error body (CRITICAL: the 'An error' case)", async () => {
    // Simulates Vercel/serverless returning a text error instead of JSON.
    const res = new Response("An error occurred while processing your request.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
    const result = await safeReadJson(res);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.notJson).toBe(true);
    // Must NOT throw; must produce a friendly string (not 'Unexpected token').
    expect(result.error).toContain("server is temporarily unavailable");
  });

  it("handles an HTML error page (Vercel/Next error boundary)", async () => {
    const html = "<html><body>An error occurred while loading this section.</body></html>";
    const res = new Response(html, {
      status: 504,
      headers: { "Content-Type": "text/html" },
    });
    const result = await safeReadJson(res);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(504);
    expect(result.notJson).toBe(true);
    expect(result.error).toContain("server is temporarily unavailable");
    // Raw HTML never leaks to the user.
    expect(result.error).not.toContain("<html");
  });

  it("handles an empty response body", async () => {
    const res = new Response("", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const result = await safeReadJson(res);
    expect(result.ok).toBe(false);
    expect(result.notJson).toBe(true);
    expect(result.error).toContain("empty response");
  });

  it("handles a 2xx body that claims JSON but is malformed", async () => {
    const res = new Response("not json{", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const result = await safeReadJson(res);
    expect(result.ok).toBe(false);
    expect(result.notJson).toBe(true);
    // Must not throw 'Unexpected token' — a friendly error string instead.
    expect(result.error).toBeTruthy();
    expect((result.error ?? "").length).toBeGreaterThan(0);
  });

  it("maps HTTP status codes to friendly messages", async () => {
    expect(httpStatusLabel(401)).toBe("Please sign in to continue.");
    expect(httpStatusLabel(429)).toContain("Too many requests");
    expect(httpStatusLabel(500)).toContain("server is temporarily unavailable");
    expect(httpStatusLabel(502)).toContain("server is temporarily unavailable");
    expect(httpStatusLabel(504)).toContain("server is temporarily unavailable");
  });

  it("never exposes raw body content in the normalized error", async () => {
    const res = new Response("PRIVATE_RESUME_DATA", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
    const result = await safeReadJson(res);
    expect(result.error).not.toContain("PRIVATE_RESUME_DATA");
  });
});
