import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mic, Brain, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";
import { AdSlot } from "@/components/ads/ad-slot";

export const metadata: Metadata = {
  title: "AI Mock Interview — Practice Interviews with PrepNexa",
  description:
    "Practice realistic AI mock interviews for any role. Get a live AI interviewer, voice answers, personalized feedback, and scores out of 10. Start free.",
  alternates: { canonical: "/ai-mock-interview" },
  openGraph: {
    title: "AI Mock Interview — PrepNexa",
    description:
      "Practice realistic AI mock interviews with instant, personalized feedback. 1 free interview.",
    type: "website",
    url: "/ai-mock-interview",
  },
};

const features = [
  {
    icon: Brain,
    title: "Adaptive AI interviewer",
    desc: "Asks progressively harder questions and follows up on weak answers.",
  },
  {
    icon: Mic,
    title: "Answer with your voice",
    desc: "Speak your answers and get transcribed, or type them in.",
  },
  {
    icon: FileText,
    title: "Resume-aware",
    desc: "Upload your resume or a job description and the questions adapt to you.",
  },
  {
    icon: BarChart3,
    title: "Detailed feedback",
    desc: "Score out of 10, strengths, weaknesses, and per-question notes.",
  },
];

export default function AiMockInterviewPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          AI Mock <span className="text-gradient">Interviews</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Practice realistic interviews with an AI that adapts to your role,
          your resume, and your answers. Get scored feedback after every
          interview.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" variant="gradient">
            <Link href="/signup">
              Start Free Interview
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/interview-questions">Browse interview questions</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          1 free complete AI interview. Then PrepNexa Pro — PKR 499/month.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title} className="glass">
            <CardContent className="pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdSlot slot="mock-interview" />

      <div className="mx-auto mt-16 max-w-3xl space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          How an AI mock interview works
        </h2>
        <ol className="list-inside list-decimal space-y-2">
          <li>Pick a job role or paste a job description.</li>
          <li>Optional: upload your resume so the interviewer adapts.</li>
          <li>
            Answer 5 progressive questions — introduction, technical,
            behavioral, scenario, and problem-solving.
          </li>
          <li>Use your voice or type your answers.</li>
          <li>
            Get a full feedback report with scores, strengths, and an
            improvement roadmap.
          </li>
        </ol>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
