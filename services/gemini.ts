import { GoogleGenAI } from "@google/genai";
import { buildInterviewerSystemPrompt } from "@/lib/security";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const getClient = () =>
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ConversationTurn {
  role: "user" | "model";
  content: string;
}

interface GenerateOptions {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(message)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer as ReturnType<typeof setTimeout>),
  );
}

export async function generateInterviewerResponse(params: {
  role?: string;
  resumeContext?: string;
  questionsAsked: number;
  totalQuestions: number;
  history: ConversationTurn[];
  temperature?: number;
}): Promise<string> {
  const system = buildInterviewerSystemPrompt({
    role: params.role,
    resumeContext: params.resumeContext,
  })
    .replace("{questions_asked}", String(params.questionsAsked))
    .replace("{total_questions}", String(params.totalQuestions));

  const contents = params.history.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.content }],
  }));

  const response = await generateContent({
    contents,
    system,
    temperature: params.temperature ?? 0.7,
    maxOutputTokens: 300,
  });

  return response;
}

export async function generateFeedback(params: {
  role?: string;
  history: ConversationTurn[];
}): Promise<string> {
  const prompt = `You are a senior interview coach. Review the following interview transcript and produce a detailed feedback report as a SINGLE JSON object.

Return ONLY valid JSON with this exact shape (no markdown, no commentary):
{
  "overall_score": <integer 0-10>,
  "summary": "<2-4 sentence overall summary>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areas_to_improve": ["<area 1>", "<area 2>", "<area 3>"],
  "per_question_notes": [
    {
      "question": "<the interview question>",
      "answer": "<the candidate's answer>",
      "score": <integer 0-10>,
      "feedback": "<1-2 sentence feedback for this Q&A>"
    }
  ]
}

Role being interviewed for: ${params.role}

Interview transcript:
${params.history
  .map((turn) => `${turn.role === "model" ? "Alex" : "Candidate"}: ${turn.content}`)
  .join("\n\n")}`;

  return generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    system: "",
    temperature: 0.4,
    maxOutputTokens: 2000,
  });
}

async function generateContent(options: {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  system: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured");
  }

  const ai = getClient();
  const run = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: options.contents,
    config: {
      systemInstruction: options.system || undefined,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    },
  });

  const response = await withTimeout(
    run,
    DEFAULT_TIMEOUT_MS,
    "Gemini request timed out",
  );

  const text =
    response.text ??
    response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";

  if (!text.trim()) {
    throw new Error("Gemini returned an empty response");
  }

  return text.trim();
}
