import { isAIError, userFacingAIError } from "@/lib/ai/ai-types";

/**
 * Maps any AI/provider error to a user-safe, friendly message. Never exposes
 * provider names, HTTP codes, or technical details to the end user. Non-AI
 * errors pass through their own message.
 */
export function friendlyAIErrorMessage(error: unknown): string {
  if (isAIError(error)) {
    // All provider errors (429, 5xx, timeout, quota…) surface the same calm
    // message. The router has already attempted retries + failover.
    return userFacingAIError();
  }

  if (error instanceof Error) {
    // Known application errors (validation, ownership, limits) keep their text.
    return error.message;
  }

  return userFacingAIError();
}

/**
 * Convenience wrapper for the "we're reconnecting your interview" tone used
 * specifically in the live interview flow, where progress is preserved.
 */
export function reconnectInterviewMessage(): string {
  return "Your answer is saved. We're reconnecting your interview.";
}