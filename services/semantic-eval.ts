import { createLLMProvider } from "@/services/llm/provider";
import { pythonai, type PythonAiClient, type SemanticScoreResult } from "@/services/pythonai";

/**
 * Semantic answer evaluation. Blends two signals:
 *  - embedding cosine similarity (pythonai sentence-transformers) for surface
 *    semantic relevance, and
 *  - an LLM judgment of technical correctness, completeness, and clarity.
 *
 * The LLM dominates (0.65 weight). When pythonai is unavailable, scoring falls
 * back to LLM-only. Everything degrades gracefully — evaluation never throws
 * into the caller; it returns a zeroed result with an "offline" marker instead.
 */

export interface SemanticEvaluation {
  cosineScore: number; // 0-1 embedding similarity (0 when pythonai is down)
  llmScore: number; // 0-1 LLM judgment
  blendedScore: number; // 0-1 final weighted combination
  feedback: string;
  offline: boolean; // true when pythonai was unreachable
}

export interface SemanticScoringClient {
  semanticScore(params: {
    question: string;
    answer: string;
    role?: string;
    resumeContext?: string;
  }): Promise<SemanticScoreResult>;
}

/** Evaluator dependency, injectable for testing/DI. */
export interface SemanticEvaluator {
  evaluate(params: {
    question: string;
    answer: string;
    role?: string;
    resumeContext?: string;
  }): Promise<SemanticEvaluation>;
}

const LLM_WEIGHT = 0.65;
const COSINE_WEIGHT = 0.35;

export async function evaluateAnswer(
  params: {
    question: string;
    answer: string;
    role?: string;
    resumeContext?: string;
  },
  scoringClient: SemanticScoringClient,
): Promise<SemanticEvaluation> {
  const provider = createLLMProvider();

  // Embedding similarity — best-effort; any failure degrades to LLM-only.
  let cosineScore = 0;
  let offline = true;
  try {
    const result = await scoringClient.semanticScore(params);
    cosineScore = clamp01(result.cosine);
    offline = false;
  } catch {
    // pythonai may be down; fall back to LLM-only scoring, cosineScore = 0.
  }

  const llmRaw = await provider.chat({
    system:
      "You are an expert interviewer grading a candidate's answer. Be strict but fair.",
    messages: [
      {
        role: "user",
        content: `Role: ${params.role ?? "Senior Software Engineer"}${
          params.resumeContext
            ? `\nResume context: ${params.resumeContext.slice(0, 2000)}`
            : ""
        }

Question: ${params.question}

Candidate answer:
${params.answer.slice(0, 3000)}

Return a SINGLE valid JSON object, no markdown, no commentary:
{
  "score": <number 0-1>,
  "reason": "<one-sentence assessment of technical correctness, completeness, and clarity>"
}`,
      },
    ],
    temperature: 0.2,
    format: "json",
    maxOutputTokens: 300,
  });

  const { score, reason } = parseLlmJudgment(llmRaw);

  const llmScore = clamp01(score);
  const blendedScore = offline
    ? llmScore
    : COSINE_WEIGHT * cosineScore + LLM_WEIGHT * llmScore;

  return {
    cosineScore,
    llmScore,
    blendedScore,
    feedback: reason || "No detailed feedback available.",
    offline,
  };
}

/** Parses the LLM's strict JSON reply; never throws. */
function parseLlmJudgment(raw: string): { score: number; reason: string } {
  try {
    const json = raw.match(/\{[\s\S]*\}/);
    if (json) {
      const parsed = JSON.parse(json[0]) as { score?: unknown; reason?: unknown };
      return {
        score: Number(parsed.score),
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }
  } catch {
    // Fall through to defaults.
  }
  return { score: 0, reason: "" };
}

/** Maps a 0-1 blended score onto the 0-10 integer scale used by interview_questions.score. */
export function toTenScale(score01: number): number {
  return clampInt(Math.round(score01 * 10));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampInt(value: number): number {
  return Math.min(10, Math.max(0, value));
}

/**
 * Constructs a default evaluator bound to the production pythonai client.
 * Separate from evaluateAnswer so callers can inject mocks in tests.
 */
export function createSemanticEvaluator(pythonAi: PythonAiClient): SemanticEvaluator {
  return {
    async evaluate(params) {
      return evaluateAnswer(params, pythonAi);
    },
  };
}

/** Default singleton bound to the shared pythonai client. */
export const semanticEvaluator: SemanticEvaluator =
  createSemanticEvaluator(pythonai);
