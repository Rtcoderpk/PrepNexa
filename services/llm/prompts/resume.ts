import { sanitizeInput } from "@/lib/security";

/**
 * Extracts skills/experience/projects from a resume or job description and
 * returns compact structured JSON for targeting interview questions.
 */
export function buildResumeAnalysisPrompt(text: string): string {
  return `Analyze the following resume or job description and return a SINGLE valid JSON object, no markdown fences, no commentary.

Input:
${sanitizeInput(text).slice(0, 8000)}

{
  "skills": ["<top hard skills>", ...],
  "technologies": ["<languages/frameworks/tools>", ...],
  "experience_years": <number>,
  "projects": ["<notable project name + role>", ...],
  "responsibilities": ["<key responsibilities or seniority signals>", ...],
  "summary": "<one-sentence summary of the profile or role>"
}

Rules:
- Extract only what is present; use empty arrays for absent categories.
- Do not invent skills that are not in the text.`;
}

export function buildResumeInterviewFocus(text: string): string {
  return sanitizeInput(text).slice(0, 8000);
}