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

export interface PerQuestionNote {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

export interface InterviewFeedback {
  overall_score: number;
  summary: string;
  strengths: string[];
  areas_to_improve: string[];
  per_question_notes: PerQuestionNote[];
}

export interface InterviewSettings {
  maxQuestions: number;
}

export const DEFAULT_INTERVIEW_SETTINGS: InterviewSettings = {
  maxQuestions: 5,
};

export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  introduction: "Introduction",
  technical: "Technical",
  behavioral: "Behavioral",
  scenario: "Scenario",
  problem_solving: "Problem Solving",
};
