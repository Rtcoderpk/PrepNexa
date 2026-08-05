export interface PerQuestionNote {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

/** Full structured feedback report produced by the LLM pass. */
export interface InterviewFeedbackReport {
  overall_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  areas_to_improve: string[];
  technical_score: number;
  communication_score: number;
  confidence_score: number;
  grammar_score: number;
  speaking_speed_score: number;
  eye_contact_score: number;
  body_language_score: number;
  star_evaluation: string;
  hiring_recommendation: string;
  improvement_roadmap: string;
  per_question_notes: PerQuestionNote[];
}
