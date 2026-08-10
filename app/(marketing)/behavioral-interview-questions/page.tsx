import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Behavioral Interview Questions — 30+ Examples & STAR Answers",
  description:
    "Practice the most common behavioral interview questions with example STAR answers. Learn the STAR method and get AI feedback on your responses.",
  alternates: { canonical: "/behavioral-interview-questions" },
  openGraph: {
    title: "Behavioral Interview Questions — PrepNexa",
    description:
      "30+ behavioral interview questions, the STAR method, and example answers. Practice with AI feedback.",
    type: "website",
    url: "/behavioral-interview-questions",
  },
};

const questions = [
  "Tell me about a time you disagreed with a teammate. How did you resolve it?",
  "Describe a situation where you failed. What did you learn?",
  "Give an example of a time you had to meet a tight deadline.",
  "Tell me about a time you showed leadership without a formal title.",
  "Describe a conflict with a manager and how you handled it.",
  "Tell me about a time you went above and beyond your role.",
  "Describe a difficult customer or stakeholder you had to satisfy.",
  "Give an example of a time you made a mistake at work.",
  "Tell me about a time you had to learn a new skill quickly.",
  "Describe a situation where you had to make a decision with limited information.",
];

export default function BehavioralQuestionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Behavioral Interview <span className="text-gradient">Questions</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Behavioral questions reveal how you actually work. The best way to
          answer them is with the STAR method — Situation, Task, Action, Result.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-lg font-bold">The STAR method</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Situation</span> —
            set the scene briefly.
          </li>
          <li>
            <span className="font-semibold text-foreground">Task</span> — what
            were you responsible for?
          </li>
          <li>
            <span className="font-semibold text-foreground">Action</span> — what
            specifically did <em>you</em> do?
          </li>
          <li>
            <span className="font-semibold text-foreground">Result</span> — what
            happened? Use numbers where possible.
          </li>
        </ul>
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

      <div className="mt-10 text-center">
        <Button asChild variant="gradient" size="lg">
          <Link href="/signup">
            Practice behavioral questions with AI feedback
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mx-auto mt-12 max-w-3xl space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground">Common pitfalls</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>Answering generically without a concrete story.</li>
          <li>Not giving your specific role in the action.</li>
          <li>Skipping the result — always close with what changed.</li>
          <li>Rambling — keep stories to 60–90 seconds.</li>
        </ul>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
