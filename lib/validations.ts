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

export const feedbackSchema = z.object({
  overall_score: z.number().int().min(0).max(10),
  summary: z.string().max(2000),
  strengths: z.array(z.string().max(300)).max(20),
  areas_to_improve: z.array(z.string().max(300)).max(20),
  per_question_notes: z
    .array(
      z.object({
        question: z.string().max(1000),
        answer: z.string().max(3000),
        score: z.number().int().min(0).max(10),
        feedback: z.string().max(1000),
      }),
    )
    .max(MAX_QUESTIONS + 5),
});

export const uploadResumeSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(200)
    .regex(/\.pdf$/i, "Only PDF files are allowed"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type StartInterviewFormValues = z.infer<typeof startInterviewSchema>;
export type InterviewFeedbackData = z.infer<typeof feedbackSchema>;
