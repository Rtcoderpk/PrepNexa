/**
 * Safe JSON helpers for both client and server API boundaries.
 *
 * The frontend must NEVER call `response.json()` blindly — a Serverless
 * timeout, reverse proxy, or unhandled server error can return plain text or
 * an HTML error page instead of JSON, and `response.json()` throws the
 * `Unexpected token 'A', "An error o"...` SyntaxError. These helpers inspect
 * the status + Content-Type first and return a normalized shape.
 */

export interface SafeJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  /** Set when the HTTP body was not JSON at all. */
  notJson: boolean;
}

/** Error category used in diagnostics (never includes raw content). */
export type ApiErrorCategory =
  | "network"          // fetch itself rejected (CORS, offline, proxy)
  | "timeout"          // request aborted by client timeout
  | "http_error"       // 4xx/5xx with valid JSON body
  | "not_json"         // non-2xx/2xx body that isn't JSON (HTML/text/empty)
  | "success_json"     // 2xx with JSON
  | "unknown";

/**
 * Safely parses a fetch Response into a normalized shape. Never throws on
 * non-JSON bodies — returns { notJson: true, error } instead.
 */
export async function safeReadJson<T = Record<string, unknown>>(
  response: Response,
): Promise<SafeJsonResult<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    // Non-2xx: try to extract a JSON error body; else fall back to a generic
    // HTTP error. A HTML/text body is surfaced as notJson.
    if (isJson) {
      try {
        const body = (await response.json()) as T;
        return {
          ok: false,
          status: response.status,
          data: body,
          error: extractErrorFromBody(body),
          notJson: false,
        };
      } catch {
        // JSON content-type but failed to parse — treat as malformed.
      }
    }
    return {
      ok: false,
      status: response.status,
      data: null,
      error: httpStatusLabel(response.status),
      notJson: true,
    };
  }

  // 2xx path.
  if (isJson) {
    try {
      const body = (await response.json()) as T;
      return {
        ok: true,
        status: response.status,
        data: body,
        error: null,
        notJson: false,
      };
    } catch {
      // JSON content-type but unparseable — rare.
    }
  }

  // 2xx but not JSON (or unparseable) — avoid partial/garbage parsing.
  const text = await response.text().catch(() => "");
  return {
    ok: false,
    status: response.status,
    data: null,
    error: text
      ? "The server returned an unexpected response."
      : "The server returned an empty response. Please try again.",
    notJson: true,
  };
}

/** Extracts the human-readable `error` (or `message`) from a JSON body. */
function extractErrorFromBody<T>(body: T): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const err = record.error;
    if (typeof err === "string" && err) return err;
    const message = record.message;
    if (typeof message === "string" && message) return message;
  }
  return httpStatusLabel(0);
}

/** Maps an HTTP/unknown status to a short friendly label. */
export function httpStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return "The server returned an unexpected error. Please try again.";
    case 400:
      return "The request was invalid. Please try again.";
    case 401:
      return "Please sign in to continue.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "The requested resource was not found.";
    case 408:
      return "The request timed out. Please try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The server is temporarily unavailable. Please try again in a moment.";
    default:
      return status >= 400
        ? `Request failed (${status}). Please try again.`
        : "Unexpected response. Please try again.";
  }
}

/**
 * Client-side diagnostic logger. Never logs response bodies (which may contain
 * PII / resume / interview answers) — only structural metadata.
 */
export function logApiDiagnostics(
  endpoint: string,
  result: Pick<SafeJsonResult<unknown>, "ok" | "status" | "notJson">,
): void {
  // eslint-disable-next-line no-console
  console.warn(
    `[api-client] ${endpoint}: ok=${result.ok} status=${result.status} notJson=${result.notJson}`,
  );
}
