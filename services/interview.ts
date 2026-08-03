import { createClient } from "@/lib/supabase/server";
import { generateInterviewerResponse } from "@/services/gemini";
import {
  DEFAULT_INTERVIEW_SETTINGS,
  type ChatMessage,
  type InterviewSetup,
  type QuestionCategory,
} from "@/types/interview";

export const COMPLETION_PHRASE =
  "That wraps up our interview — thank you for your time today.";

const CATEGORY_ORDER: QuestionCategory[] = [
  "introduction",
  "technical",
  "behavioral",
  "scenario",
  "problem_solving",
];

const CATEGORY_PROMPT: Record<QuestionCategory, string> = {
  introduction:
    "Begin with a warm introduction question that puts the candidate at ease.",
  technical:
    "Ask a technical question relevant to the role. Push for concrete examples.",
  behavioral:
    "Ask a behavioral question using the STAR format. Ask about a past situation and how they handled it.",
  scenario:
    "Present a realistic scenario this candidate would face in the role and ask how they would approach it.",
  problem_solving:
    "Pose an open-ended problem-solving question. Probe their reasoning process.",
};

export function getMaxQuestions(): number {
  return DEFAULT_INTERVIEW_SETTINGS.maxQuestions;
}

export function isCompletionMessage(content: string): boolean {
  return content.trim() === COMPLETION_PHRASE;
}

function buildConversationHistory(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? ("model" as const) : ("user" as const),
    content: message.content,
  }));
}

function nextCategory(assistantCount: number): QuestionCategory {
  return CATEGORY_ORDER[assistantCount] ?? "problem_solving";
}

export async function createInterview(params: {
  userId: string;
  setup: InterviewSetup;
}): Promise<string> {
  const supabase = await createClient();
  const { jobRole, jobDescription, resumeText, resumeFileName } = params.setup;

  let resumeFileId: string | null = null;
  if (resumeFileName && resumeText) {
    const { data: existingResume } = await supabase
      .from("resume_files")
      .select("id")
      .eq("user_id", params.userId)
      .eq("file_name", resumeFileName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    resumeFileId = existingResume?.id ?? null;
  }

  const { data: interview, error } = await supabase
    .from("interviews")
    .insert({
      user_id: params.userId,
      job_role: jobRole?.trim() || null,
      job_description: jobDescription?.trim() || null,
      status: "in_progress",
      resume_file_id: resumeFileId,
    })
    .select("id")
    .single();

  if (error || !interview) {
    throw new Error("Failed to create interview");
  }

  return interview.id;
}

export async function generateOpeningQuestion(params: {
  role?: string;
  resumeContext?: string;
  history: ChatMessage[];
  totalQuestions: number;
}): Promise<{ content: string; category: QuestionCategory }> {
  const category: QuestionCategory = "introduction";

  const content = await generateInterviewerResponse({
    role: params.role,
    resumeContext: params.resumeContext,
    questionsAsked: 0,
    totalQuestions: params.totalQuestions,
    history: [
      ...buildConversationHistory(params.history),
      {
        role: "user",
        content:
          "[Interview protocol note] This is the very start of the interview. Introduce yourself as Alex and ask the candidate to introduce themselves. Do not answer for them.",
      },
    ],
  });

  return { content, category };
}

export async function generateNextQuestion(params: {
  role?: string;
  resumeContext?: string;
  history: ChatMessage[];
  latestAnswer?: string;
  isFollowUp?: boolean;
}): Promise<{
  content: string;
  category: QuestionCategory;
  isFollowUp: boolean;
}> {
  const assistantCount = params.history.filter(
    (m) => m.role === "assistant",
  ).length;

  const category = params.isFollowUp
    ? getLastAssistantCategory(params.history)
    : nextCategory(assistantCount);

  const categoryNote = params.isFollowUp
    ? ""
    : `\nFor this next question, ${CATEGORY_PROMPT[category]}`;

  const followUpNote = params.isFollowUp
    ? "\nThis is a follow-up. Do not move to a new topic — probe deeper into the candidate's last answer, then return to the main flow."
    : "";

  const content = await generateInterviewerResponse({
    role: params.role,
    resumeContext: params.resumeContext,
    questionsAsked: assistantCount,
    totalQuestions: getMaxQuestions(),
    history: [
      ...buildConversationHistory(params.history),
      ...(params.latestAnswer
        ? [{ role: "user" as const, content: params.latestAnswer }]
        : []),
      {
        role: "user",
        content: `[Interview protocol note]${categoryNote}${followUpNote} React to the candidate's last answer naturally and ${
          params.isFollowUp ? "ask one follow-up" : "continue with the next question"
        }.`,
      },
    ],
  });

  return {
    content,
    category,
    isFollowUp: params.isFollowUp ?? false,
  };
}

function getLastAssistantCategory(messages: ChatMessage[]): QuestionCategory {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant" && messages[i].category) {
      return messages[i].category as QuestionCategory;
    }
  }
  return "introduction";
}
