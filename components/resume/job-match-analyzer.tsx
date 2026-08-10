"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface JobMatchReport {
  match_score: number;
  summary: string;
  matched_keywords: string[];
  missing_keywords: string[];
  relevant_skills: string[];
  missing_skills: string[];
  experience_alignment: string;
  recommended_changes: string[];
  sections_to_improve: string[];
}

export function JobMatchAnalyzer() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<JobMatchReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not read the PDF.");
      }
      setResumeText(data.text.slice(0, 15000));
      toast.success("Resume extracted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not read the PDF.",
      );
    }
  }, []);

  const runMatch = async () => {
    if (resumeText.trim().length < 50) {
      toast.error("Please upload a resume first.");
      return;
    }
    if (jobDescription.trim().length < 20) {
      toast.error("Please paste a job description (at least 20 characters).");
      return;
    }
    setIsLoading(true);
    setReport(null);
    try {
      const response = await fetch("/api/resume/job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Match failed");
      }
      setReport(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't match your resume right now.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Your Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all hover:border-primary/50 hover:bg-secondary/40"
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
              <FileUp className="mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-medium">
                {fileName ?? "Upload resume PDF"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF up to 5MB
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description you're targeting…"
              className="min-h-[180px] w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary/50"
              maxLength={10000}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {jobDescription.length} / 10000
            </p>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={runMatch}
        disabled={isLoading}
        variant="gradient"
        size="lg"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Matching your resume…
          </>
        ) : (
          <>
            Match resume to job
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {report && (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="glass">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <div
                  className={cn(
                    "flex h-24 w-24 items-center justify-center rounded-full border-4 text-2xl font-bold",
                    report.match_score >= 75
                      ? "border-emerald-500/50 text-emerald-500"
                      : report.match_score >= 50
                        ? "border-amber-500/50 text-amber-500"
                        : "border-rose-500/50 text-rose-500",
                  )}
                >
                  {report.match_score}
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Match Score
                </p>
              </CardContent>
            </Card>
            <Card className="glass sm:col-span-2">
              <CardContent className="space-y-3 py-8">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {report.summary}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">
                    Experience alignment:{" "}
                  </span>
                  {report.experience_alignment}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base text-emerald-600">
                  Matched Keywords
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {report.matched_keywords.length === 0 && (
                  <p className="text-sm text-muted-foreground">None detected.</p>
                )}
                {report.matched_keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600"
                  >
                    {k}
                  </span>
                ))}
              </CardContent>
            </Card>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base text-amber-600">
                  Missing Keywords
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {report.missing_keywords.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Great — nothing missing.
                  </p>
                )}
                {report.missing_keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600"
                  >
                    {k}
                  </span>
                ))}
              </CardContent>
            </Card>
          </div>

          {report.recommended_changes.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">
                  Recommended Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {report.recommended_changes.map((c) => (
                    <li key={c} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.sections_to_improve.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">
                  Sections to Improve
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {report.sections_to_improve.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                  >
                    {s}
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          <Button asChild variant="gradient" className="w-full">
            <Link href="/pricing">
              Unlock unlimited matching — PKR 499/month
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
