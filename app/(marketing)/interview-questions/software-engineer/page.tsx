import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Software Engineer Interview Questions — Top Questions & Answers",
  description:
    "Practice the most common software engineer interview questions: data structures, system design, algorithms, and behavioral. Get AI feedback on your answers.",
  alternates: { canonical: "/interview-questions/software-engineer" },
  openGraph: {
    title: "Software Engineer Interview Questions — PrepNexa",
    description:
      "Practice software engineer interview questions with AI feedback.",
    type: "website",
    url: "/interview-questions/software-engineer",
  },
};

const questions = [
  "Explain the difference between an array and a linked list.",
  "How would you reverse a string in place?",
  "What is the difference between REST and GraphQL?",
  "Describe how garbage collection works in a language like Java or Go.",
  "How would you design a rate limiter?",
  "Explain the difference between `==` and `===` in JavaScript.",
  "What is an idempotent API call and why does it matter?",
  "Describe a time you improved the performance of a slow system.",
  "What is the difference between horizontal and vertical scaling?",
  "How do you handle a production incident?",
];

export default function SoftwareEngineerQuestionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Software Engineer Interview <span className="text-gradient">Questions</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Software engineering interviews mix data structures, system design,
          and behavioral questions. These are the patterns interviewers reuse —
          practice answering them clearly and confidently.
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
        <h2 className="text-lg font-bold">Interview prep tips for engineers</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Drill core data structures until answers are automatic.</li>
          <li>Verbalize your thought process — interviews reward reasoning.</li>
          <li>Prepare 2–3 real stories about production bugs you fixed.</li>
          <li>Ask clarifying questions before jumping into a solution.</li>
        </ul>
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="gradient" size="lg">
          <Link href="/signup">
            Run a software engineer mock interview
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
