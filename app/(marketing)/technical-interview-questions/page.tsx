import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Technical Interview Questions — Practice for Developer Roles",
  description:
    "Practice technical interview questions for software engineering, data science, and more. Get AI feedback on your answers and improve your technical interview skills.",
  alternates: { canonical: "/technical-interview-questions" },
  openGraph: {
    title: "Technical Interview Questions — PrepNexa",
    description:
      "Practice technical interview questions with AI feedback and improve your answers.",
    type: "website",
    url: "/technical-interview-questions",
  },
};

const questions = [
  "Explain the difference between a process and a thread.",
  "What is the time complexity of a hash map lookup, and why?",
  "Explain RESTful API design principles.",
  "How does a relational database index work?",
  "What is the difference between SQL and NoSQL databases?",
  "Explain how HTTPS works at a high level.",
  "What is a memory leak and how do you debug one?",
  "Describe how you would design a URL shortener.",
  "What is the difference between a class and an interface?",
  "Explain the CAP theorem.",
];

export default function TechnicalQuestionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Technical Interview <span className="text-gradient">Questions</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Technical interviews test your fundamentals, your reasoning, and your
          ability to explain complex ideas simply. Practice answering out loud —
          that&apos;s the skill interviews actually reward.
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
        <h2 className="text-lg font-bold">How to answer technical questions</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Restate the question to confirm you understand it.</li>
          <li>Think out loud — interviewers want to see your reasoning.</li>
          <li>Start simple, then add complexity and trade-offs.</li>
          <li>Name your assumptions and state the complexity.</li>
        </ul>
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="gradient" size="lg">
          <Link href="/interview-questions/software-engineer">
            Practice for a software role
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
