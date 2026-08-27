import { isAIError, userFacingAIError, AI_BUDGET_LIMIT_MESSAGE } from "@/lib/ai/ai-types";
import { isJSONParserError } from "@/lib/ai/json-parser";

/**
 * Server-action error carrying the friendly message plus a machine-readable
 * budget-limit signal so the client can branch on it (like the route-level
 * `budgetLimit` flag) instead of string-matching. Lives here (not in a
 * `"use server"` file) so both actions and client components can import it.
 */
export class AiResponseError extends Error {
  readonly budgetLimit: boolean;
  constructor(message: string, budgetLimit = false) {
    super(message);
    this.name = "AiResponseError";
    this.budgetLimit = budgetLimit;
  }
}

/**
 * True when the error is the per-user AI budget guardrail rejection. Used by
 * routes to emit a stable `budgetLimit` signal and by the client (via the
 * exact message) to show the specific budget UX instead of the generic
 * "AI temporarily busy" copy.
 */
export function isBudgetLimitError(error: unknown): boolean {
  return isAIError(error) && error.kind === "budget_limit";
}

/**
 * Maps any AI/provider error to a user-safe, friendly message. Never exposes
 * provider names, HTTP codes, or technical details to the end user. Non-AI
 * errors pass through their own message.
 */
export function friendlyAIErrorMessage(error: unknown): string {
  // JSON parse failures (after retries + repair exhaustion) surface as a
  // friendly message — the router has already attempted failover. The detailed
  // diagnostics (provider, model, fingerprint) are logged server-side.
  if (isJSONParserError(error)) {
    return userFacingAIError();
  }

  if (isAIError(error)) {
    // The per-user budget rejection keeps its specific, actionable copy so the
    // client can surface the upgrade/retry-later path. All other provider
    // errors (429, 5xx, timeout, quota…) surface the same calm message — the
    // router has already attempted retries + failover.
    if (error.kind === "budget_limit") return AI_BUDGET_LIMIT_MESSAGE;
    return userFacingAIError();
  }

  if (error instanceof Error) {
    // Known application errors (validation, ownership, limits) keep their text.
    return error.message;
  }

  return userFacingAIError();
}

/**
 * Result of mapping an error to user-facing text, plus a stable machine-
 * readable `budgetLimit` flag. This is the server->client contract for routes:
 * the client can branch on `budgetLimit` rather than string-matching.
 */
export function aiErrorPayload(error: unknown): {
  error: string;
  budgetLimit?: boolean;
} {
  return {
    error: friendlyAIErrorMessage(error),
    budgetLimit: isBudgetLimitError(error) ? true : undefined,
  };
}

/**
 * Convenience wrapper for the "we're reconnecting your interview" tone used
 * specifically in the live interview flow, where progress is preserved.
 */
export function reconnectInterviewMessage(): string {
  return "Your answer is saved. We're reconnecting your interview.";
}
