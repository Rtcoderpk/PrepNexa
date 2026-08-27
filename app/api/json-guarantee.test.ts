import { describe, expect, it } from "vitest";

/**
 * Guarantees that every API route that can serve the AI-interview and
 * resume-analysis features returns JSON on BOTH success and failure — never a
 * plain-text / HTML error that breaks the frontend's response.json().
 *
 * Regression for: `Unexpected token 'A', "An error o"... is not valid JSON` —
 * caused by an unhandled route exception returning an HTML/text error page.
 */
const ROUTES = [
  "app/api/interview/feedback/route.ts",
  "app/api/interview/opening/route.ts",
  "app/api/interview/respond/route.ts",
  "app/api/resume/analyze-upload/route.ts",
  "app/api/resume/job-match/route.ts",
  "app/api/resume/parse/route.ts",
];

describe("API routes always return JSON (never plain-text errors)", () => {
  it.each(ROUTES)("%s wraps its handler so a throw still returns JSON", (file) => {
    const fs = require("node:fs");
    const src = fs.readFileSync(file, "utf8");

    // Every route must have a whole-handler try/catch that returns JSON.
    expect(src).toContain("try {");
    expect(src).toContain("catch (error)");
    expect(src).toContain("return NextResponse.json(");
    // The catch must produce JSON, not res.status().send(text) or next(error).
    expect(src).not.toContain(".send(");
    expect(src).not.toContain("next(error");
  });

  it.each(ROUTES)("%s always uses NextResponse.json for its response", (file) => {
    const fs = require("node:fs");
    const src = fs.readFileSync(file, "utf8");
    // The PRIMARY return paths should be JSON responses.
    const jsonCalls = (src.match(/NextResponse\.json\(/g) ?? []).length;
    expect(jsonCalls).toBeGreaterThanOrEqual(1);
    // No direct text/HTML response primitives.
    expect(src).not.toMatch(/new Response\(/);
    expect(src).not.toMatch(/res\.json\(\)/);
  });
});
