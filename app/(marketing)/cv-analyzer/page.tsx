import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "CV Analyzer — Free CV Review & Improvement Tool",
  description:
    "Free CV analyzer. Get instant feedback on your CV's structure, content, keywords, and impact. Discover weak sections and how to fix them.",
  alternates: { canonical: "/cv-analyzer" },
  openGraph: {
    title: "CV Analyzer — PrepNexa",
    description:
      "Free CV analysis: structure, content, keywords, and improvements in seconds.",
    type: "website",
    url: "/cv-analyzer",
  },
};

export default function CvAnalyzerPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary">
          <FileText className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Free <span className="text-gradient">CV Analyzer</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A strong CV is the difference between an interview and the trash
          folder. Get a free, detailed analysis of your CV and learn exactly
          what to fix.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg" variant="gradient">
            <Link href="/free-ats-resume-checker">
              Analyze my CV free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Structure & section headings",
          "Contact information",
          "Professional summary",
          "Experience & achievements",
          "Skills & keywords",
          "Grammar & readability",
        ].map((item) => (
          <Card key={item} className="glass">
            <CardContent className="flex items-center gap-3 pt-6">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                ✓
              </span>
              <p className="text-sm font-medium">{item}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-3xl space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          CV vs resume — same tool
        </h2>
        <p>
          In most countries &quot;CV&quot; and &quot;resume&quot; are used
          interchangeably. Our analyzer treats them the same way: it checks
          structure, keywords, measurable achievements, and ATS compatibility.
          Whether you call it a CV or a resume, we&apos;ll help you improve it.
        </p>
        <p>
          Upload your CV as a PDF and we&apos;ll score it, find weak sections,
          and rewrite weak bullet points — faithfully, without inventing
          experience.
        </p>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
