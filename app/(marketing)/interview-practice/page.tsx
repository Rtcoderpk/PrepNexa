import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Online Interview Practice — Practice Interviews Free",
  description:
    "Practice interviews online for free. Simulate real interview questions, answer out loud, and get AI feedback on your performance.",
  alternates: { canonical: "/interview-practice" },
  openGraph: {
    title: "Online Interview Practice — PrepNexa",
    description:
      "Free online interview practice with an AI interviewer and instant feedback.",
    type: "website",
    url: "/interview-practice",
  },
};

export default function InterviewPracticePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Online Interview <span className="text-gradient">Practice</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The best way to prepare for an interview is to practice the real
          thing. Run through complete mock interviews, get scored, and track
          your progress over time.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg" variant="gradient">
            <Link href="/signup">
              Start practicing free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2">
        {[
          "Realistic questions for your role",
          "5 progressive question categories",
          "Voice or typed answers",
          "Instant, detailed feedback",
          "Score tracking across interviews",
          "Resume & job-description aware",
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

      <div className="mx-auto mt-12 max-w-3xl space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          Consistency beats cramming
        </h2>
        <p>
          Interview skills improve with repetition. Practice one mock interview
          at a time, review your feedback, and target your weakest areas. Over a
          few weeks you&apos;ll answer harder questions more calmly and more
          clearly.
        </p>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
