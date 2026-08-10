import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";
import { AdSlot } from "@/components/ads/ad-slot";

export const metadata: Metadata = {
  title: "AI Resume Analyzer — Free Resume Review & Improvements",
  description:
    "Get a free AI resume analysis. Discover strengths, weaknesses, keyword gaps, and specific improvements to make your resume stand out. Instant, actionable feedback.",
  alternates: { canonical: "/ai-resume-analyzer" },
  openGraph: {
    title: "AI Resume Analyzer — PrepNexa",
    description:
      "Free AI resume analysis: strengths, weaknesses, keyword gaps, and improvement suggestions in seconds.",
    type: "website",
    url: "/ai-resume-analyzer",
  },
};

const signals = [
  {
    title: "ATS compatibility",
    desc: "Structure, headings, and formatting that ATS parsers can read.",
  },
  {
    title: "Keyword analysis",
    desc: "Which role keywords you hit and which ones you're missing.",
  },
  {
    title: "Action verbs & results",
    desc: "Weak bullets rewritten to be specific and measurable.",
  },
  {
    title: "Grammar & clarity",
    desc: "Readability and language signals recruiters notice.",
  },
];

export default function AiResumeAnalyzerPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          AI Resume <span className="text-gradient">Analyzer</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Upload your resume and get a deep, honest analysis of what works and
          what doesn&apos;t — with specific fixes you can apply today.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg" variant="gradient">
            <Link href="/free-ats-resume-checker">
              Analyze my resume free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {signals.map((s) => (
          <Card key={s.title} className="glass">
            <CardContent className="pt-6">
              <Sparkles className="mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-1 font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdSlot slot="resume-analyzer" />

      <div className="mx-auto mt-16 max-w-3xl space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          What you&apos;ll get
        </h2>
        <ul className="list-inside list-disc space-y-2">
          <li>ATS compatibility score out of 100</li>
          <li>Overall resume quality score out of 100</li>
          <li>Top 5 improvements ranked by impact</li>
          <li>Keyword gaps and keyword-stuffing risks</li>
          <li>Section-by-section feedback</li>
          <li>Rewritten bullet points that stay faithful to your experience</li>
        </ul>
        <p className="pt-4">
          Every recommendation stays true to your actual resume — we never
          invent experience, numbers, or achievements.
        </p>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
