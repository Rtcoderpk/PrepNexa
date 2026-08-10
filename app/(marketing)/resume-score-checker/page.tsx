import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Resume Score Checker — Free Resume Scoring Tool",
  description:
    "Check your resume score free. Get a resume quality score out of 100, an ATS score, and specific improvements to boost your application.",
  alternates: { canonical: "/resume-score-checker" },
  openGraph: {
    title: "Resume Score Checker — PrepNexa",
    description:
      "Score your resume out of 100 for free. ATS score, quality score, and improvements.",
    type: "website",
    url: "/resume-score-checker",
  },
};

export default function ResumeScoreCheckerPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary">
          <Gauge className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Resume <span className="text-gradient">Score Checker</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          How strong is your resume, really? Get two scores out of 100 — ATS
          compatibility and overall quality — plus a roadmap to improve both.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg" variant="gradient">
            <Link href="/free-ats-resume-checker">
              Score my resume free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2">
        <Card className="glass">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              ATS Score
            </p>
            <p className="mt-2 text-4xl font-extrabold text-emerald-500">/100</p>
            <p className="mt-3 text-sm text-muted-foreground">
              How well an ATS can parse and match your resume — structure,
              keywords, and formatting.
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">
              Resume Quality Score
            </p>
            <p className="mt-2 text-4xl font-extrabold text-primary">/100</p>
            <p className="mt-3 text-sm text-muted-foreground">
              How compelling your resume is to a human reviewer — clarity,
              impact, and results.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto mt-12 max-w-3xl space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          How the score works
        </h2>
        <p>
          Our AI reviews your resume across structure, headings, contact info,
          professional summary, experience, education, skills, projects,
          achievements, keywords, action verbs, measurable results, grammar,
          clarity, and readability.
        </p>
        <p>
          Your resume score is an AI-based estimate to help you prioritize
          fixes — it is not a guarantee that any specific ATS vendor will score
          you the same way.
        </p>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
