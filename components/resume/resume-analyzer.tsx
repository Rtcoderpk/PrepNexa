"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  FileUp,
  FileText,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ResumeAnalysisReport {
  atsScore: number;
  qualityScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  topImprovements: string[];
  keywordAnalysis: {
    strong_keywords: string[];
    missing_common_keywords: string[];
    keyword_stuffing_risk: boolean;
    ats_compatibility_notes: string;
  };
  sectionAnalysis: Array<{
    section: string;
    present: boolean;
    status: "good" | "needs_improvement" | "missing";
    feedback: string;
  }>;
  contactAnalysis: string;
  actionVerbs: "strong" | "moderate" | "weak";
  measurableAchievements: "strong" | "moderate" | "weak";
  grammar: "good" | "moderate" | "needs_work";
  readability: "good" | "moderate" | "needs_work";
  bulletImprovements: Array<{
    before: string;
    issue: string;
    why: string;
    after: string;
  }>;
}

const STAGES = [
  "Reading your resume",
  "Checking ATS compatibility",
  "Analyzing content",
  "Finding weak sections",
  "Checking keywords",
  "Generating improvements",
];

const MAX_ANALYSIS_RETRIES = 2;

function isTransientAnalysisError(message: string): boolean {
  const cleaned = message.toLowerCase();
  return (
    cleaned.includes("temporarily") ||
    cleaned.includes("try again in a moment") ||
    cleaned.includes("no ai provider") ||
    cleaned.includes("rate limit") ||
    cleaned.includes("overloaded") ||
    cleaned.includes("unavailable")
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color =
    score >= 75
      ? "text-emerald-500"
      : score >= 50
        ? "text-amber-500"
        : "text-rose-500";
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-full border-4 text-2xl font-bold",
          color,
          score >= 75
            ? "border-emerald-500/50"
            : score >= 50
              ? "border-amber-500/50"
              : "border-rose-500/50",
        )}
      >
        {score}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    strong: "text-emerald-600 bg-emerald-500/10",
    moderate: "text-amber-600 bg-amber-500/10",
    weak: "text-rose-600 bg-rose-500/10",
    good: "text-emerald-600 bg-emerald-500/10",
    needs_work: "text-rose-600 bg-rose-500/10",
  };
  const label = level.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        map[level] ?? "text-muted-foreground bg-secondary",
      )}
    >
      {label}
    </span>
  );
}

export function ResumeAnalyzer({
  limitReached,
  remainingChecks,
  requiresAuth,
}: {
  limitReached: boolean;
  remainingChecks: number;
  /** When true (anonymous visitor), show a sign-in gate instead of the uploader. */
  requiresAuth?: boolean;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [report, setReport] = useState<ResumeAnalysisReport | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runAnalysis = useCallback(
    async (file: File) => {
      setIsAnalyzing(true);
      setReport(null);
      setError(null);
      setStageIndex(0);

      const timer = setInterval(() => {
        setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
      }, 1200);

      try {
        let lastError: string | null = null;

        for (let attempt = 0; attempt <= MAX_ANALYSIS_RETRIES; attempt++) {
          try {
            const formData = new FormData();
            formData.set("file", file);
            const response = await fetch("/api/resume/analyze-upload", {
              method: "POST",
              body: formData,
            });
            const data = await response.json();

            if (!response.ok) {
              if (data.limitReached) {
                setError("You've used all your free resume checks. Upgrade to continue.");
                toast.error(
                  "You've used all your free resume checks. Upgrade to continue.",
                );
                return;
              }
              if (data.budgetLimit) {
                setError("You've reached your AI usage limit for now. Please try again later.");
                toast.error(
                  "You've reached your AI usage limit for now. Please try again later.",
                );
                return;
              }

              const msg = data.error ?? "Analysis failed";
              lastError = msg;
              const shouldRetry = isTransientAnalysisError(msg) && attempt < MAX_ANALYSIS_RETRIES;
              if (shouldRetry) {
                toast.warning(`AI is temporarily busy. Retrying analysis (${attempt + 2}/${MAX_ANALYSIS_RETRIES + 1})…`);
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
              }
              throw new Error(msg);
            }

            setReport(data);
            return;
          } catch (error) {
            const msg =
              error instanceof Error ? error.message : "Analysis failed";
            lastError = msg;
            const shouldRetry =
              (isTransientAnalysisError(msg) || msg === "Failed to fetch") &&
              attempt < MAX_ANALYSIS_RETRIES;
            if (shouldRetry) {
              toast.warning(`AI is temporarily busy. Retrying analysis (${attempt + 2}/${MAX_ANALYSIS_RETRIES + 1})…`);
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
            throw new Error(msg);
          }
        }

        throw new Error(lastError ?? "Analysis failed");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        const friendly =
          msg && isTransientAnalysisError(msg)
            ? "AI is temporarily busy. Please try again in a moment."
            : msg || "Analysis failed";
        setError(friendly);
        toast.error(friendly);
      } finally {
        clearInterval(timer);
        setIsAnalyzing(false);
      }
    },
    [],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Only PDF files are supported.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 5MB.");
        return;
      }
      setFileName(file.name);
      setSelectedFile(file);
      try {
        toast.success("Resume extracted. Starting analysis…");
        await runAnalysis(file);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not read the PDF.",
        );
      }
    },
    [runAnalysis],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Upload / analysis state */}
      {!report && (
        <Card className="glass">
          <CardContent className="space-y-5 pt-6">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                  {selectedFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void runAnalysis(selectedFile)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )}
            {requiresAuth && !limitReached ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <FileText className="h-10 w-10 text-primary" />
                <div>
                  <p className="text-base font-semibold">
                    Sign in to check your resume
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Create a free account to unlock {remainingChecks} free ATS
                    resume checks — instant score, keyword analysis, and
                    improvements.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="gradient">
                    <Link href="/signup">
                      Create free account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="space-y-4 py-6 text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <div className="mx-auto flex max-w-md flex-col gap-2">
                  {STAGES.map((stage, i) => (
                    <div
                      key={stage}
                      className={cn(
                        "flex items-center gap-2 text-sm transition-opacity",
                        i < stageIndex
                          ? "text-success opacity-100"
                          : i === stageIndex
                            ? "text-primary opacity-100"
                            : "text-muted-foreground opacity-40",
                      )}
                    >
                      {i < stageIndex ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : i === stageIndex ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border" />
                      )}
                      <span>{stage}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  This usually takes 10–20 seconds.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all hover:border-primary/50 hover:bg-secondary/40"
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                  />
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary">
                    <FileUp className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium">
                    Drop your resume here, or{" "}
                    <span className="text-primary">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF up to 5MB. We analyze the full text, securely.
                  </p>
                </div>

                {limitReached && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold">
                        You&apos;ve used all your free resume checks
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Keep improving your resume with PrepNexa Pro.
                      </p>
                      <Button asChild size="sm" className="mt-3" variant="gradient">
                        <Link href="/pricing">
                          Upgrade for PKR 499/month
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <FileText className="h-5 w-5 text-primary" />
                {fileName ?? "Your resume report"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ATS score is an AI-based compatibility estimate, not a
                guaranteed score from a specific ATS vendor.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setReport(null)}>
              Analyze another resume
            </Button>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="glass">
              <CardContent className="flex justify-center py-6">
                <ScoreRing score={report.atsScore} label="ATS Score" />
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="flex justify-center py-6">
                <ScoreRing score={report.qualityScore} label="Resume Quality" />
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="flex flex-col justify-center gap-2 py-6 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  Remaining checks
                </p>
                <p className="text-3xl font-bold text-primary">
                  {remainingChecks}
                </p>
                {remainingChecks === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Upgrade for unlimited checks
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {report.summary}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base text-emerald-600">
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {report.strengths.map((s) => (
                    <li key={s} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base text-rose-600">
                  Weaknesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {report.weaknesses.map((w) => (
                    <li key={w} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {report.topImprovements.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Top Improvements</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {report.topImprovements.map((t, i) => (
                    <li key={t} className="flex gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Keyword analysis */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Keyword Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Strong keywords</p>
                <div className="flex flex-wrap gap-2">
                  {report.keywordAnalysis.strong_keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              {report.keywordAnalysis.missing_common_keywords.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Missing common keywords
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.keywordAnalysis.missing_common_keywords.map((k) => (
                      <span
                        key={k}
                        className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {report.keywordAnalysis.keyword_stuffing_risk && (
                <p className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Keyword stuffing risk detected — avoid overusing keywords.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {report.keywordAnalysis.ats_compatibility_notes}
              </p>
            </CardContent>
          </Card>

          {/* Section analysis */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Section Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.sectionAnalysis.map((section) => (
                <div
                  key={section.section}
                  className="flex items-start gap-3 rounded-xl border border-border/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{section.section}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                          section.status === "good"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : section.status === "missing"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-amber-500/10 text-amber-600",
                        )}
                      >
                        {section.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.feedback}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Style signals */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Writing Signals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <span className="text-sm">Action verbs</span>
                <LevelBadge level={report.actionVerbs} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <span className="text-sm">Measurable achievements</span>
                <LevelBadge level={report.measurableAchievements} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <span className="text-sm">Grammar & clarity</span>
                <LevelBadge level={report.grammar} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <span className="text-sm">Readability</span>
                <LevelBadge level={report.readability} />
              </div>
            </CardContent>
          </Card>

          {/* Bullet improvements */}
          {report.bulletImprovements.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Improve Your Bullet Points
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.bulletImprovements.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-2 rounded-xl border border-border/60 p-4"
                  >
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-destructive">Before: </span>
                      {b.before}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-amber-600">Why: </span>
                      {b.issue} — {b.why}
                    </p>
                    <p className="text-sm text-emerald-600">
                      <span className="font-medium">After: </span>
                      {b.after}
                    </p>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gradient" className="flex-1">
              <Link href="/pricing">
                Unlock Pro — PKR 499/month
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setReport(null)}>
              <X className="mr-2 h-4 w-4" />
              Analyze another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
