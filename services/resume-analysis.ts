import { createLLMProvider } from "@/services/llm/provider";
import { sanitizeInput } from "@/lib/security";
import { z } from "zod";
import { safeParseJson, isJSONParserError, summarizeJSONParseError } from "@/lib/ai/json-parser";

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
// Public API
// -------------------------------------------------------------------------

const MAX_RESUME_CHARS = 12000;
const MAX_JD_CHARS = 8000;
const MAX_BULLETS = 7;
const MAX_ATTEMPTS = 2;
/** Backoff between retry attempts. */
const RETRY_BACKOFF_MS = 800;

function normalizeResumeText(text: string): string {
  return sanitizeInput(text).slice(0, MAX_RESUME_CHARS);
}

// -------------------------------------------------------------------------
// Robust JSON parsing (delegated to the shared parser). The previous hand-rolled
// extractor used a greedy `\{[\s\S]*\}` regex that broke on nested objects and
// trailing commentary, and offered no truncation recovery.
// -------------------------------------------------------------------------

const bulletArraySchema = z.array(bulletImprovementSchema);

function parseResumeAnalysis(raw: string): ResumeAnalysis {
  const result = safeParseJson(raw, resumeAnalysisSchema, { task: "resume_analysis" });
  return result.data;
}

function parseBulletImprovements(raw: string): BulletImprovement[] {
  const result = safeParseJson(raw, bulletArraySchema, { task: "resume_improvement" });
  return result.data;
}

/** Analyzes a resume: ATS compatibility + overall quality + improvements. */
export async function analyzeResume(
  text: string,
  userId?: string,
): Promise<ResumeAnalysisResult> {
  const resume = normalizeResumeText(text);
  const provider = createLLMProvider();
  const startedAt = Date.now();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let aiStart = Date.now();
    try {
      // Ask for the full analysis and the bullet rewrites in parallel.
      aiStart = Date.now();
      const [analysisRaw, bulletsRaw] = await Promise.all([
        provider.chat({
          task: "resume_analysis",
          system: "",
          messages: [{ role: "user", content: buildAnalysisPrompt(resume) }],
          temperature: 0.2,
          format: "json",
          maxOutputTokens: 4000,
          // Per-call timeout must fit under the route's maxDuration=60s budget
          // (with retries). 25s/call keeps the worst case under the limit so
          // Vercel never returns an HTML timeout page.
          timeoutMs: 25_000,
          userId,
        }),
        provider.chat({
          task: "resume_improvement",
          system: "",
          messages: [{ role: "user", content: buildBulletPrompt(resume, MAX_BULLETS) }],
          temperature: 0.3,
          format: "json",
          maxOutputTokens: 2000,
          timeoutMs: 25_000,
          userId,
        }).catch(() => ""),
      ]);

      // parseResumeAnalysis uses the robust parser (raw / fenced / balanced /
      // truncation-repair) + schema validation. Throws JSONParserError on failure.
      const parseStart = Date.now();
      const analysis = parseResumeAnalysis(analysisRaw);

      let bulletImprovements: BulletImprovement[] = [];
      if (bulletsRaw) {
        try {
          bulletImprovements = parseBulletImprovements(bulletsRaw).slice(0, MAX_BULLETS);
        } catch {
          // Non-fatal: analysis is still valid without improvement suggestions.
          bulletImprovements = [];
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `[resume-analysis] attempt=${attempt + 1} aiMs=${Date.now() - aiStart} parseMs=${Date.now() - parseStart} totalMs=${Date.now() - startedAt}`,
      );

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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Resume analysis failed");
      // eslint-disable-next-line no-console
      console.log(
        `[resume-analysis] attempt=${attempt + 1} FAILED aiMs=${Date.now() - aiStart} totalMs=${Date.now() - startedAt} kind=${(error as { kind?: string })?.kind ?? "unknown"}`,
      );

      // Config errors (bad credentials) are not retryable.
      const kind = (error as { kind?: string })?.kind;
      if (kind === "config") {
        throw error;
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
      }
    }
  }

  // Log diagnostics for the final failure — never include raw model output
  // (may contain PII / resume text). Only structural info is logged.
  if (isJSONParserError(lastError)) {
    const diag = summarizeJSONParseError(lastError);
    console.error(
      `[resume-analysis] JSON parse failure: task=${diag.task} provider=${diag.provider ?? "unknown"} model=${diag.model ?? "unknown"} parseError=${diag.parseError?.slice(0, 100)} rawLength=${diag.rawLength} repairPasses=${diag.repairPasses}`,
    );
  }

  throw lastError ?? new Error("Resume analysis failed after retries");
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
    maxOutputTokens: 3000,
    userId,
  });

  const result = safeParseJson(raw, jobMatchSchema, { task: "job_match" });
  return result.data;
}

export { MAX_RESUME_CHARS, MAX_JD_CHARS, MAX_BULLETS };
