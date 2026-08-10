import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Interview Questions — Common Questions by Role & Category",
  description:
    "Browse common interview questions by category (behavioral, technical, HR) and by role. Practice them in a real AI mock interview and get feedback.",
  alternates: { canonical: "/interview-questions" },
  openGraph: {
    title: "Interview Questions — PrepNexa",
    description:
      "Browse common interview questions by category and role, then practice them with AI feedback.",
    type: "website",
    url: "/interview-questions",
  },
};

const categories = [
  { href: "/behavioral-interview-questions", label: "Behavioral interview questions" },
  { href: "/technical-interview-questions", label: "Technical interview questions" },
  { href: "/hr-interview-questions", label: "HR interview questions" },
];

const roles = [
  { href: "/interview-questions/software-engineer", label: "Software Engineer" },
  { href: "/interview-questions/frontend-developer", label: "Frontend Developer" },
  { href: "/interview-questions/backend-developer", label: "Backend Developer" },
  { href: "/interview-questions/python-developer", label: "Python Developer" },
  { href: "/interview-questions/data-scientist", label: "Data Scientist" },
  { href: "/interview-questions/machine-learning-engineer", label: "Machine Learning Engineer" },
  { href: "/interview-questions/full-stack-developer", label: "Full-Stack Developer" },
  { href: "/interview-questions/accountant", label: "Accountant" },
  { href: "/interview-questions/marketing-manager", label: "Marketing Manager" },
  { href: "/interview-questions/project-manager", label: "Project Manager" },
];

export default function InterviewQuestionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Interview <span className="text-gradient">Questions</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Browse common interview questions by category or by role, then
          practice answering them in a real AI mock interview.
        </p>
      </div>

      <div className="mt-10 space-y-10">
        <section>
          <h2 className="mb-4 text-xl font-bold">By category</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {categories.map((c) => (
              <Link key={c.href} href={c.href}>
                <Card className="glass transition-all hover:border-primary/40">
                  <CardContent className="flex items-center justify-between pt-6">
                    <p className="font-medium">{c.label}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold">By role</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <Link key={r.href} href={r.href}>
                <Card className="glass transition-all hover:border-primary/40">
                  <CardContent className="flex items-center justify-between pt-6">
                    <p className="font-medium">{r.label}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <CTA
          title="Practice these questions for real"
          subtitle="Pick a role and run a complete AI mock interview with personalized feedback."
        />
      </div>
    </div>
  );
}
