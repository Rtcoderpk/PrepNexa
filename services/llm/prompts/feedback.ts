import { sanitizeInput } from "@/lib/security";

export interface FeedbackPromptParams {
  role?: string;
  resumeContext?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** Optional per-answer metrics (speech + vision) to fold into the report. */
  telemetry?: Array<{
    question: string;
    wordsPerMinute?: number;
    fillerDensity?: number;
    fluencyScore?: number;
    eyeContactPct?: number;
    avgConfidence?: number;
    blinkRatePerMin?: number;
    postureScore?: number;
  }>;
}

/**
 * Feedback prompt tuned for local models: the model must emit ONLY a JSON
 * object, no markdown, no preamble. Schema mirrors types/feedback.ts.
 */
export function buildFeedbackPrompt(params: FeedbackPromptParams): string {
  const { role = "Senior Software Engineer", resumeContext, history, telemetry } = params;

  const transcript = history
    .map((turn) =>
      `${turn.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${turn.content}`,
    )
    .join("\n\n");

  const telemetryBlock = telemetry?.length
    ? "\n\nPer-question telemetry (speech + non-verbal cues):\n" +
      JSON.stringify(telemetry, null, 2)
    : "";

  const resumeBlock = resumeContext
    ? `\n\nCandidate resume context:\n${sanitizeInput(resumeContext).slice(0, 5000)}`
    : "";

  return `You are a senior technical interviewer and hiring coach at Google. Review the mock interview transcript below and produce a detailed, structured feedback report.

Role interviewed for: ${role}
${resumeBlock}

<transcript>
${sanitizeInput(transcript).slice(0, 20000)}
</transcript>
${telemetryBlock}

Produce your report as a SINGLE valid JSON object with EXACTLY this shape. Do not wrap it in markdown fences. Do not add commentary before or after the JSON. All scores are integers 0-10.

{
  "overall_score": <int 0-10>,
  "summary": "<2-4 sentence overall summary>",
  "strengths": ["<string>", ...],
  "weaknesses": ["<string>", ...],
  "areas_to_improve": ["<string>", ...],
  "technical_score": <int 0-10>,
  "communication_score": <int 0-10>,
  "confidence_score": <int 0-10>,
  "grammar_score": <int 0-10>,
  "speaking_speed_score": <int 0-10>,
  "eye_contact_score": <int 0-10>,
  "body_language_score": <int 0-10>,
  "star_evaluation": "<brief STAR assessment: situation, task, action, result of the strongest behavioral answer>",
  "hiring_recommendation": "<Strong hire | Hire | Lean hire | No hire>",
  "improvement_roadmap": "<personalized 4-6 step action plan>",
  "per_question_notes": [
    {
      "question": "<the interview question>",
      "answer": "<the candidate's answer>",
      "score": <int 0-10>,
      "feedback": "<1-2 sentence specific feedback>"
    }
  ]
}

Rules:
- technical/communication/grammar scores come from the transcript.
- confidence, eye contact, body language, speaking speed: derive from the telemetry if provided, otherwise estimate from the transcript tone.
- per_question_notes must align one entry per interviewer question (follow-ups may be folded into their parent question).
- Be specific and actionable. Do not use generic praise.`;
}
