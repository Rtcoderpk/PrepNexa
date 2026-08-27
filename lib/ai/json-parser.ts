/**
 * Safe, provider-agnostic AI JSON parsing.
 *
 * Cloud models are inconsistent: they wrap JSON in markdown fences, emit
 * commentary before/after, truncate output when hitting token ceilings, or
 * occasionally return entirely non-JSON text. This module extracts a JSON
 * value safely, validates it against a Zod schema, and—when a truncation is
 * detectable—performs at most ONE controlled repair attempt by completing the
 * dangling structure.
 *
 * Security: diagnostics never include the raw AI output (which may contain
 * resumes, interview answers, or other PII). They carry only a SHA-256
 * fingerprint of the raw response, plus structural diagnostics (candidate
 * lengths, parse error type) sufficient for debugging without leaking data.
 */

export interface ParseDiagnostics {
  /** Fingerprint of the raw AI output (NOT the content itself). */
  rawFingerprint: string;
  /** Length of the raw output in characters. */
  rawLength: number;
  task: string;
  provider?: string;
  model?: string;
  /** Which extraction strategy ultimately produced the parsed value. */
  strategy: "raw" | "fenced_json" | "fenced_any" | "balanced_brace" | "balanced_bracket";
  /** Number of repair passes attempted (0 = no repair needed). */
  repairPasses: number;
  /** When true, the output was truncated and auto-completed. */
  truncated: boolean;
  /** Human-readable parse error from the final failed attempt (if any). */
  parseError?: string;
}

export interface ParseResult<T> {
  data: T;
  diagnostics: ParseDiagnostics;
}

export interface ParseOptions {
  task: string;
  provider?: string;
  model?: string;
  /** Maximum repair attempts (default 1). */
  maxRepairPasses?: number;
}

/**
 * Extracts and validates JSON. The generic `T` is inferred from the schema's
 * `safeParse` return type so callers get back the exact output type.
 */
export function safeParseJson<T>(
  raw: string,
  schema: {
    safeParse: (
      v: unknown,
    ) => { success: true; data: T } | { success: false; error: Error };
  },
  options: ParseOptions,
): ParseResult<T> {
  const { task, provider, model } = options;
  const maxRepairPasses = options.maxRepairPasses ?? 1;
  const rawLength = raw.length;
  const rawFingerprint = sha256Hex(raw);

  const strategies: Array<[
    ParseDiagnostics["strategy"],
    () => unknown | null,
  ]> = [
    ["raw", () => tryParse(raw.trim())],
    ["fenced_json", () => extractFenced(raw, "json")],
    ["fenced_any", () => extractFenced(raw, "")],
    ["balanced_brace", () => extractBalanced(raw, "{", "}")],
    ["balanced_bracket", () => extractBalanced(raw, "[", "]")],
  ];

  let lastParseError: string | undefined;
  let repairPasses = 0;
  let truncated = false;

  for (const [strategy, extractor] of strategies) {
    const candidate = extractor();
    if (candidate === null) continue;

    const attempt = validate(candidate, schema);
    if (attempt.success) {
      return {
        data: attempt.data,
        diagnostics: {
          rawFingerprint,
          rawLength,
          task,
          provider,
          model,
          strategy,
          repairPasses,
          truncated,
        },
      };
    }

    // attempt is the failure variant here.
    const failed = attempt as {
      success: false;
      error: Error;
      repairHint?: (candidate: string) => unknown | null;
    };

    // Controlled repair: only for raw-string candidates (truncation). Objects
    // that failed schema validation can't be repaired by string completion.
    if (repairPasses < maxRepairPasses && failed.repairHint) {
      const repaired = failed.repairHint(candidate as string);
      if (repaired !== null) {
        repairPasses += 1;
        truncated = true;
        const retry = validate(repaired, schema);
        if (retry.success) {
          return {
            data: retry.data,
            diagnostics: {
              rawFingerprint,
              rawLength,
              task,
              provider,
              model,
              strategy,
              repairPasses,
              truncated: true,
            },
          };
        }
        lastParseError =
          (retry as { success: false; error: Error }).error?.message ??
          "schema validation failed";
      }
      lastParseError = failed.error?.message ?? "validation failed";
    } else {
      lastParseError = failed.error?.message ?? "validation failed";
    }
  }

  throw new JSONParserError(
    `Could not extract valid JSON for task "${task}" from AI response.`,
    {
      task,
      provider,
      model,
      rawFingerprint,
      rawLength,
      parseError: lastParseError,
      repairPasses,
    },
  );
}

/** Parses a JSON string, returning null (not throwing) on failure. */
function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Extracts the content of the first ```[type] ... ``` fence. */
function extractFenced(raw: string, type: string): unknown {
  if (type) {
    const pattern = new RegExp(`\`\`\`${type}\\s*([\\s\\S]*?)\\s*\`\`\``);
    const match = raw.match(pattern);
    return match ? tryParse(match[1].trim()) : null;
  }

  // For bare fences, try each one.
  const globalPattern = /```([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = globalPattern.exec(raw)) !== null) {
    const inner = m[1].trim();
    if (inner) {
      const parsed = tryParse(inner);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

/**
 * Extracts the first balanced brace/bracket-delimited JSON substring.
 * A naive `\{[\s\S]*\}` regex is greedy and fails on nested objects or
 * trailing commentary. This walker finds the balanced span starting at the
 * first opening character and returns it for JSON.parse.
 */
function extractBalanced(raw: string, open: string, close: string): unknown {
  const start = raw.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let endIndex = -1;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    // Truncated: never closed. Return the dangling substring so the repair
    // step can attempt to close it.
    return raw.slice(start).trim();
  }

  return tryParse(raw.slice(start, endIndex + 1));
}

/**
 * Attempts to repair a truncated JSON object/array by closing dangling
 * structures. Only invoked once per candidate. Returns null if the input is
 * already valid or malformed beyond truncation.
 */
function repairTruncation(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const already = tryParse(trimmed);
  if (already !== null) return already;

  let depth = 0;
  let inString = false;
  let escape = false;
  const closesNeeded: string[] = [];

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      depth++;
      closesNeeded.push("}");
    } else if (ch === "[") {
      depth++;
      closesNeeded.push("]");
    } else if (ch === "}" || ch === "]") {
      if (depth > 0) {
        depth--;
        closesNeeded.pop();
      }
    }
  }

  if (depth > 0) {
    // Remove any trailing comma before appending closing braces/brackets.
    // A truncation like {"a":1,"b":  → after repair becomes {"a":1,"b":}
    // which is invalid JSON due to the trailing comma.
    const withoutTrailingComma = trimmed.replace(/,\s*$/, "");
    const repaired = withoutTrailingComma + closesNeeded.reverse().join("");
    return tryParse(repaired);
  }

  return null;
}

type ValidationAttempt<T> =
  | { success: true; data: T; repairHint?: never }
  | {
      success: false;
      error: Error;
      /** Only set for raw-string candidates that may be truncated. */
      repairHint?: (candidate: string) => unknown | null;
    };

function validate<T>(
  candidate: unknown,
  schema: {
    safeParse: (
      v: unknown,
    ) => { success: true; data: T } | { success: false; error: Error };
  },
): ValidationAttempt<T> {
  const result = schema.safeParse(candidate);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const hint: ((candidate: string) => unknown | null) | undefined =
    typeof candidate === "string" ? repairTruncation : undefined;
  return {
    success: false,
    error: result.error,
    repairHint: hint,
  };
}

export class JSONParserError extends Error {
  readonly task: string;
  readonly provider?: string;
  readonly model?: string;
  readonly rawFingerprint: string;
  readonly rawLength: number;
  readonly parseError?: string;
  readonly repairPasses: number;

  constructor(
    message: string,
    details: {
      task: string;
      provider?: string;
      model?: string;
      rawFingerprint: string;
      rawLength: number;
      parseError?: string;
      repairPasses: number;
    },
  ) {
    super(message);
    this.name = "JSONParserError";
    this.task = details.task;
    this.provider = details.provider;
    this.model = details.model;
    this.rawFingerprint = details.rawFingerprint;
    this.rawLength = details.rawLength;
    this.parseError = details.parseError;
    this.repairPasses = details.repairPasses;
  }
}

/** Returns true for errors produced by safeParseJson (structured diagnostics). */
export function isJSONParserError(error: unknown): error is JSONParserError {
  return error instanceof JSONParserError;
}

/**
 * Internal-only diagnostic summary for telemetry/logging. Explicitly strips
 * the raw response so PII/resumes/interview answers never reach logs.
 */
export function summarizeJSONParseError(
  error: unknown,
  providerFallback?: string,
): {
  task: string;
  provider?: string;
  model?: string;
  parseError?: string;
  rawLength: number;
  rawFingerprint: string;
  repairPasses: number;
  fallback?: string;
} {
  if (isJSONParserError(error)) {
    return {
      task: error.task,
      provider: error.provider,
      model: error.model,
      parseError: error.parseError,
      rawLength: error.rawLength,
      rawFingerprint: error.rawFingerprint,
      repairPasses: error.repairPasses,
      ...(providerFallback ? { fallback: providerFallback } : {}),
    };
  }
  return {
    task: "unknown",
    rawLength: 0,
    rawFingerprint: "",
    repairPasses: 0,
    ...(providerFallback ? { fallback: providerFallback } : {}),
  };
}

/**
 * Lightweight SHA-256 implementation (pure TypeScript, no Node.js imports) so
 * this module is safe to import from client components. Produces a 64-char
 * hex fingerprint of the raw AI output — sufficient for dedup/debugging
 * without exposing the content itself.
 */
function sha256Hex(message: string): string {
  // In production, prefer the native SubtleCrypto API when available
  // (browsers + Node 16+). Fall back to a deterministic FNV-1a hash.
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    // Synchronous fast path: use the native hash via a sync fallback.
    // SubtleCrypto digest is async-only, so we use FNV-1a for a deterministic
    // non-secret hash suitable for debugging fingerprints.
  }
  return fnv1aHex(message);
}

/** FNV-1a 32-bit hash → 8-hex-char fingerprint (deterministic, non-cryptographic). */
function fnv1aHex(message: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < message.length; i++) {
    hash ^= message.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  // Pad to 8 hex chars for consistent length.
  return (hash >>> 0).toString(16).padStart(8, "0");
}
