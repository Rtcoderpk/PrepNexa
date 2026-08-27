import { feedbackReportSchema, type InterviewFeedbackReportData } from "@/lib/validations";
import { safeParseJson, isJSONParserError, type ParseOptions } from "@/lib/ai/json-parser";

/**
 * Parses raw LLM output into a validated feedback report using a robust
 * multi-strategy extractor (raw, fenced, balanced-brace, truncation repair).
 *
 * Throws a JSONParserError carrying task/provider/model diagnostics when the
 * output cannot be extracted or fails schema validation. The error never
 * contains the raw model output (which may include PII / interview answers).
 */
export function parseFeedbackReportJson(
  raw: string,
  options?: Omit<ParseOptions, "task">,
): InterviewFeedbackReportData {
  const parseOpts: ParseOptions = {
    task: "interview_feedback",
    provider: options?.provider,
    model: options?.model,
  };
  const result = safeParseJson(raw, feedbackReportSchema, parseOpts);
  return result.data;
}

export { isJSONParserError };
