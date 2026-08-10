import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Resume Tips — 15 Practical Tips to Strengthen Your Resume",
  description:
    "Practical resume tips that actually help: action verbs, measurable results, ATS keywords, and formatting. Examples included for every tip.",
  alternates: { canonical: "/resume-tips" },
  openGraph: {
    title: "Resume Tips — PrepNexa",
    description: "12 practical resume tips with examples to help you get more interviews.",
    type: "website",
    url: "/resume-tips",
  },
};

const tips = [
  { title: "Mirror the job description", body: "Use the exact keywords and phrases from the job posting where they genuinely apply." },
  { title: "Start bullets with action verbs", body: "Built, launched, optimized, reduced — not 'responsible for'." },
  { title: "Add measurable results", body: "Quantify what changed: 'Improved page load by 40%' beats 'helped improve performance'." },
  { title: "Use a clean, parseable layout", body: "Standard headings, no tables or images — ATS parsers need plain text they can read." },
  { title: "Tailor the summary to the role", body: "One focused summary per application, not a generic profile." },
  { title: "Keep it scannable", body: "Recruiters spend seconds on a first skim. Use whitespace and short bullets." },
  { title: "Lead with your strongest role", body: "Put your most relevant, most recent experience first." },
  { title: "Cut filler and fluff", body: "Remove clichés like 'results-oriented' and 'team player' with no evidence." },
  { title: "List hard skills clearly", body: "Include the exact tech stack or tool names a recruiter will search for." },
  { title: "Include a workable email", body: "A professional email address is table stakes." },
  { title: "Proofread twice", body: "Typos signal carelessness. Read it aloud or use a checker." },
  { title: "Check the ATS score", body: "Run your finished resume through a free ATS checker before sending." },
];

export default function ResumeTipsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Resume <span className="text-gradient">Tips</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Practical, example-rich advice to make your resume work harder — for
          both ATS software and busy recruiters.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {tips.map((tip, i) => (
          <Card key={tip.title} className="glass">
            <CardContent className="pt-6">
              <p className="mb-2 text-sm font-bold">
                <span className="mr-2 text-primary">{i + 1}.</span>
                {tip.title}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tip.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="gradient" size="lg">
          <Link href="/free-ats-resume-checker">
            Check your resume for free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}