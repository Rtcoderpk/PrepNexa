export type QuestionCategory =
  | "introduction"
  | "technical"
  | "behavioral"
  | "scenario"
  | "problem_solving";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  category?: QuestionCategory;
}

export interface InterviewSetup {
  jobRole?: string;
  jobDescription?: string;
  resumeText?: string;
  resumeFileName?: string;
}

export const DEFAULT_INTERVIEW_SETTINGS = {
  maxQuestions: 5,
} as const;

export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  introduction: "Introduction",
  technical: "Technical",
  behavioral: "Behavioral",
  scenario: "Scenario",
  problem_solving: "Problem Solving",
};
