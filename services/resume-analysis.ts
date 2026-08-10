import { createLLMProvider } from "@/services/llm/provider";
import { sanitizeInput } from "@/lib/security";
import { z } from "zod";

/**
 * AI Resume Analyzer + ATS Checker + Job Description Matching.
 * Pure cloud-AI calls with robust JSON parsing. Assumes the resume has already
 * been uploaded/parsed to text (see services/resume.ts).
 */

// -------------------------------------------------------------------------
// Schemas
// -------------------------------------------------------------------------

const bulletFeedbackSchema = z.object({
  original: z.string(),
  issue: z.string(),
  why: z.string(),
  improved: z.string(),
});

const resumeAnalysisSchema = z.object({
  ats_score: z.number().int().min(0).max(100),
  quality_score: z.number().int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).max(15),
  weaknesses: z.array(z.string()).max(15),
  top_improvements: z.array(z.string()).max(5),
  keyword_analysis: z.object({
    strong_keywords: z.array(z.string()).max(20),
    missing_common_keywords: z.array(z.string()).max(20),
    keyword_stuffing_risk: z.boolean(),
    ats_compatibility_notes: z.string(),
  }),
  section_analysis: z.array(
    z.object({
      section: z.string(),
      present: z.boolean(),
      status: z.enum(["good", "needs_improvement", "missing"]),
      feedback: z.string(),
    }),
  ),
  contact_analysis: z.string(),
  action_verbs: z.enum(["strong", "moderate", "weak"]),
  measurable_achievements: z.enum(["strong", "moderate", "weak"]),
  grammar: z.enum(["good", "moderate", "needs_work"]),
  readability: z.enum(["good", "moderate", "needs_work"]),
});

const bulletImprovementSchema = z.object({
  before: z.string(),
  issue: z.string(),
  why: z.string(),
  after: z.string(),
});

const jobMatchSchema = z.object({
  match_score: z.number().int().min(0).max(100),
  summary: z.string(),
  matched_keywords: z.array(z.string()).max(15),
  missing_keywords: z.array(z.string()).max(15),
  relevant_skills: z.array(z.string()).max(10),
  missing_skills: z.array(z.string()).max(10),
  experience_alignment: z.string(),
  recommended_changes: z.array(z.string()).max(8),
  sections_to_improve: z.array(z.string()).max(6),
});

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type BulletImprovement = z.infer<typeof bulletImprovementSchema>;
export type JobMatch = z.infer<typeof jobMatchSchema>;

export interface ResumeAnalysisResult {
  atsScore: number;
  qualityScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  topImprovements: string[];
  keywordAnalysis: ResumeAnalysis["keyword_analysis"];
  sectionAnalysis: ResumeAnalysis["section_analysis"];
  contactAnalysis: string;
  actionVerbs: ResumeAnalysis["action_verbs"];
  measurableAchievements: ResumeAnalysis["measurable_achievements"];
  grammar: ResumeAnalysis["grammar"];
  readability: ResumeAnalysis["readability"];
  bulletImprovements: BulletImprovement[];
  raw: ResumeAnalysis;
}

// -------------------------------------------------------------------------
// Prompts
// -------------------------------------------------------------------------

function buildAnalysisPrompt(resume: string): string {
  return `You are a veteran recruiter and ATS (Applicant Tracking System) expert. Analyze the resume below and return a SINGLE valid JSON object with EXACTLY this shape. No markdown fences, no commentary before/after.

{
  "ats_score": <int 0-100>,
  "quality_score": <int 0-100>,
  "summary": "<2-3 sentence honest assessment>",
  "strengths": ["<specific strength>", ...],
  "weaknesses": ["<specific weakness>", ...],
  "top_improvements": ["<top 3-5 high-impact changes>", ...],
  "keyword_analysis": {
    "strong_keywords": ["<keywords the resume demonstrates>", ...],
    "missing_common_keywords": ["<common keywords for the implied role, if any>", ...],
    "keyword_stuffing_risk": <boolean>,
    "ats_compatibility_notes": "<brief note>"
  },
  "section_analysis": [
    {
      "section": "<Contact | Summary | Experience | Education | Skills | Projects | Achievements>",
      "present": <boolean>,
      "status": "<good|needs_improvement|missing>",
      "feedback": "<specific feedback>"
    }
  ],
  "contact_analysis": "<note on contact info presence/quality>",
  "action_verbs": "<strong|moderate|weak>",
  "measurable_achievements": "<strong|moderate|weak>",
  "grammar": "<good|moderate|needs_work>",
  "readability": "<good|moderate|needs_work>"
}

Rules:
- Be honest and specific. Do NOT fabricate experience the resume does not contain.
- Keep recommendations faithful to the actual resume content.
- ATS score is an estimate, not a vendor-guaranteed score.

RESUME:
\`\`\`
${resume}
\`\`\``;
}

function buildBulletPrompt(resume: string, maxBullets: number): string {
  return `You are a professional resume writer. Rewrite weak resume bullet points so they are specific, quantified, and impactful. Return a SINGLE valid JSON ARRAY where each object is:
{"before": "<original>", "issue": "<what's wrong>", "why": "<why it matters>", "after": "<improved version>"}

IMPORTANT:
- Do NOT fabricate experience, numbers, or achievements not present in the original.
- "after" may sharpen language and structure but must stay faithful to what the candidate actually did.
- Return at most ${maxBullets} items; skip bullets that are already strong.

RESUME:
\`\`\`
${resume}
\`\`\`

Return ONLY the JSON array.`;
}

function buildJobMatchPrompt(resume: string, jobDescription: string): string {
  return `You are an expert recruiter matching a resume to a job description. Return a SINGLE valid JSON object with EXACTLY this shape. No markdown, no commentary.

{
  "match_score": <int 0-100>,
  "summary": "<2-3 sentences on how well the resume fits>",
  "matched_keywords": ["<keywords from the JD found in the resume>", ...],
  "missing_keywords": ["<keywords from the JD NOT found in the resume>", ...],
  "relevant_skills": ["<relevant resume skills>", ...],
  "missing_skills": ["<skills the JD asks for that the resume lacks>", ...],
  "experience_alignment": "<note on years/level fit>",
  "recommended_changes": ["<actionable resume changes to fit the JD better>", ...],
  "sections_to_improve": ["<resume sections to strengthen for this role>", ...]
}

Do NOT claim guaranteed interviews or jobs. Be practical and specific.

JOB DESCRIPTION:
\`\`\`
${jobDescription}
\`\`\`

RESUME:
\`\`\`
${resume}
\`\`\``;
}

// -------------------------------------------------------------------------
// JSON parsing helpers
// -------------------------------------------------------------------------

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* continue */
      }
    }
    const objMatcher = raw.match(/\{[\s\S]*\}/);
    if (objMatcher) {
      try {
        return JSON.parse(objMatcher[0]);
      } catch {
        /* continue */
      }
    }
    const arrMatcher = raw.match(/\[[\s\S]*\]/);
    if (arrMatcher) {
      try {
        return JSON.parse(arrMatcher[0]);
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

function normalizeResumeText(text: string): string {
  return sanitizeInput(text).slice(0, MAX_RESUME_CHARS);
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

const MAX_RESUME_CHARS = 12000;
const MAX_JD_CHARS = 8000;
const MAX_BULLETS = 7;

/** Analyzes a resume: ATS compatibility + overall quality + improvements. */
export async function analyzeResume(
  text: string,
  userId?: string,
): Promise<ResumeAnalysisResult> {
  const resume = normalizeResumeText(text);
  const provider = createLLMProvider();

  // Ask for the full analysis and the bullet rewrites in parallel.
  const [analysisRaw, bulletsRaw] = await Promise.all([
    provider.chat({
      task: "resume_analysis",
      system: "",
      messages: [{ role: "user", content: buildAnalysisPrompt(resume) }],
      temperature: 0.2,
      format: "json",
      maxOutputTokens: 3000,
      userId,
    }),
    provider.chat({
      task: "resume_improvement",
      system: "",
      messages: [{ role: "user", content: buildBulletPrompt(resume, MAX_BULLETS) }],
      temperature: 0.3,
      format: "json",
      maxOutputTokens: 2000,
      userId,
    }).catch(() => ""),
  ]);

  const parsedAnalysis = resumeAnalysisSchema.safeParse(
    extractJson(analysisRaw),
  );
  if (!parsedAnalysis.success) {
    throw new Error("The AI could not parse the resume analysis. Please try again.");
  }

  const analysis = parsedAnalysis.data;

  let bulletImprovements: BulletImprovement[] = [];
  if (bulletsRaw) {
    const parsedBullets = z.array(bulletImprovementSchema).safeParse(
      extractJson(bulletsRaw),
    );
    if (parsedBullets.success) {
      bulletImprovements = parsedBullets.data.slice(0, MAX_BULLETS);
    }
  }

  return {
    atsScore: analysis.ats_score,
    qualityScore: analysis.quality_score,
    summary: analysis.summary,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    topImprovements: analysis.top_improvements,
    keywordAnalysis: analysis.keyword_analysis,
    sectionAnalysis: analysis.section_analysis,
    contactAnalysis: analysis.contact_analysis,
    actionVerbs: analysis.action_verbs,
    measurableAchievements: analysis.measurable_achievements,
    grammar: analysis.grammar,
    readability: analysis.readability,
    bulletImprovements,
    raw: analysis,
  };
}

/** Matches a resume against a job description. */
export async function matchResumeToJob(
  resumeText: string,
  jobDescription: string,
  userId?: string,
): Promise<JobMatch> {
  const resume = normalizeResumeText(resumeText);
  const jd = sanitizeInput(jobDescription).slice(0, MAX_JD_CHARS);

  const provider = createLLMProvider();
  const raw = await provider.chat({
    task: "job_match",
    system: "",
    messages: [{ role: "user", content: buildJobMatchPrompt(resume, jd) }],
    temperature: 0.2,
    format: "json",
    maxOutputTokens: 2000,
    userId,
  });

  const parsed = jobMatchSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    throw new Error("The AI could not parse the job match. Please try again.");
  }
  return parsed.data;
}

export { MAX_RESUME_CHARS, MAX_JD_CHARS, MAX_BULLETS };
