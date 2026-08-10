import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "HR Interview Questions — 25+ Common HR Questions & Answers",
  description:
    "Prepare for HR interview questions: tell me about yourself, salary expectations, why should we hire you, and more. Practice with AI feedback.",
  alternates: { canonical: "/hr-interview-questions" },
  openGraph: {
    title: "HR Interview Questions — PrepNexa",
    description:
      "Prepare for HR interview questions with example answers and AI practice feedback.",
    type: "website",
    url: "/hr-interview-questions",
  },
};

const questions = [
  "Tell me about yourself.",
  "Why do you want to work here?",
  "What are your strengths?",
  "What is your biggest weakness?",
  "Where do you see yourself in five years?",
  "Why should we hire you?",
  "Why are you leaving your current job?",
  "What are your salary expectations?",
  "Tell me about a time you worked under pressure.",
  "Do you have any questions for us?",
];

export default function HrQuestionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          HR Interview <span className="text-gradient">Questions</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          HR interviews assess fit, motivation, and communication. These
          questions sound easy but are easy to fumble without preparation.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {questions.map((q, i) => (
          <Card key={q} className="glass">
            <CardContent className="flex gap-3 pt-6">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{q}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-lg font-bold">Answering &quot;Tell me about yourself&quot;</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Structure it as: <em>present</em> (what you do now), <em>past</em>{" "}
          (relevant experience), <em>future</em> (why this role). Keep it under
          two minutes and connect each part to the job you&apos;re applying for.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="gradient" size="lg">
          <Link href="/signup">
            Practice HR questions with AI feedback
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
