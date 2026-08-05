import { z } from "zod";

export const MAX_RESUME_TEXT_CHARS = 15000;
export const MAX_QUESTIONS = 5;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name is required")
      .max(80, "Full name is too long"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const startInterviewSchema = z.object({
  jobRole: z
    .string()
    .trim()
    .min(2, "Job role is required")
    .max(100, "Job role is too long")
    .optional()
    .or(z.literal("")),
  jobDescription: z
    .string()
    .trim()
    .max(5000, "Job description is too long")
    .optional()
    .or(z.literal("")),
  resumeText: z
    .string()
    .trim()
    .max(MAX_RESUME_TEXT_CHARS, `Resume text exceeds ${MAX_RESUME_TEXT_CHARS} characters`)
    .optional()
    .or(z.literal("")),
  resumeFileName: z.string().max(200).optional().or(z.literal("")),
});

export const respondInterviewSchema = z.object({
  interviewId: z.string().uuid("Invalid interview"),
  answer: z
    .string()
    .trim()
    .min(1, "Answer cannot be empty")
    .max(MAX_MESSAGE_LENGTH, "Answer is too long"),
});

export const uploadResumeSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(200)
    .regex(/\.pdf$/i, "Only PDF files are allowed"),
});

// -------------------------------------------------------------
// Per-answer telemetry (from browser CV + speech analysis)
// -------------------------------------------------------------

export const speechMetricsSchema = z.object({
  transcript: z.string().trim().max(MAX_MESSAGE_LENGTH).default(""),
  audioDurationSec: z.number().min(0).max(600).optional(),
  wordsPerMinute: z.number().min(0).max(600).optional(),
  pauseCount: z.number().int().min(0).max(1000).optional(),
  avgPauseSec: z.number().min(0).max(60).optional(),
  fillerWordCount: z.number().int().min(0).max(1000).optional(),
  fillerDensity: z.number().min(0).max(100).optional(),
  fluencyScore: z.number().min(0).max(1).optional(),
  transcriptionSource: z
    .enum(["faster_whisper", "web_speech"])
    .optional()
    .default("web_speech"),
});

export const visionMetricsSchema = z.object({
  durationSec: z.number().min(0).max(3600).optional(),
  sampleCount: z.number().int().min(0).max(1_000_000).optional(),
  eyeContactPct: z.number().min(0).max(100).optional(),
  blinkCount: z.number().int().min(0).max(100_000).optional(),
  blinkRatePerMin: z.number().min(0).max(600).optional(),
  avgConfidence: z.number().min(0).max(100).optional(),
  confidenceSamples: z.number().int().min(0).max(1_000_000).optional(),
  headPitchAvg: z.number().min(-90).max(90).optional(),
  headYawAvg: z.number().min(-90).max(90).optional(),
  headRollAvg: z.number().min(-90).max(90).optional(),
  smilePct: z.number().min(0).max(100).optional(),
  postureScore: z.number().min(0).max(1).optional(),
});

export const respondTelemetrySchema = z.object({
  speech: speechMetricsSchema.optional(),
  vision: visionMetricsSchema.optional(),
});

// -------------------------------------------------------------
// Full feedback report
// -------------------------------------------------------------

const perQuestionNoteSchema = z.object({
  question: z.string().min(1).max(1000),
  answer: z.string().max(3000),
  score: z.number().int().min(0).max(10),
  feedback: z.string().max(1000),
});

export const feedbackReportSchema = z.object({
  overall_score: z.number().int().min(0).max(10),
  summary: z.string().max(2000),
  strengths: z.array(z.string().max(300)).max(20),
  weaknesses: z.array(z.string().max(300)).max(20),
  areas_to_improve: z.array(z.string().max(300)).max(20),
  technical_score: z.number().int().min(0).max(10),
  communication_score: z.number().int().min(0).max(10),
  confidence_score: z.number().int().min(0).max(10),
  grammar_score: z.number().int().min(0).max(10),
  speaking_speed_score: z.number().int().min(0).max(10),
  eye_contact_score: z.number().int().min(0).max(10),
  body_language_score: z.number().int().min(0).max(10),
  star_evaluation: z.string().max(2000),
  hiring_recommendation: z.string().max(50),
  improvement_roadmap: z.string().max(4000),
  per_question_notes: z.array(perQuestionNoteSchema).max(MAX_QUESTIONS + 5),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type StartInterviewFormValues = z.infer<typeof startInterviewSchema>;
export type InterviewFeedbackReportData = z.infer<typeof feedbackReportSchema>;
export type SpeechMetricsData = z.infer<typeof speechMetricsSchema>;
export type VisionMetricsData = z.infer<typeof visionMetricsSchema>;

/** Clamps already-validated telemetry to safe upper bounds before persistence. */
export function clampSpeech(v: SpeechMetricsData): SpeechMetricsData {
  return {
    ...v,
    audioDurationSec:
      v.audioDurationSec !== undefined ? Math.min(600, v.audioDurationSec) : undefined,
    wordsPerMinute:
      v.wordsPerMinute !== undefined ? Math.min(600, v.wordsPerMinute) : undefined,
    fillerDensity:
      v.fillerDensity !== undefined ? Math.min(100, v.fillerDensity) : undefined,
    fluencyScore:
      v.fluencyScore !== undefined ? Math.min(1, v.fluencyScore) : undefined,
  };
}

export function clampVision(v: VisionMetricsData): VisionMetricsData {
  return {
    ...v,
    eyeContactPct:
      v.eyeContactPct !== undefined ? Math.min(100, v.eyeContactPct) : undefined,
    avgConfidence:
      v.avgConfidence !== undefined ? Math.min(100, v.avgConfidence) : undefined,
    smilePct: v.smilePct !== undefined ? Math.min(100, v.smilePct) : undefined,
    postureScore:
      v.postureScore !== undefined ? Math.min(1, v.postureScore) : undefined,
    blinkRatePerMin:
      v.blinkRatePerMin !== undefined ? Math.min(600, v.blinkRatePerMin) : undefined,
    headPitchAvg:
      v.headPitchAvg !== undefined ? Math.min(90, v.headPitchAvg) : undefined,
    headYawAvg:
      v.headYawAvg !== undefined ? Math.min(90, v.headYawAvg) : undefined,
    headRollAvg:
      v.headRollAvg !== undefined ? Math.min(90, v.headRollAvg) : undefined,
  };
}
