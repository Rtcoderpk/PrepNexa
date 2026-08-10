import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Career Resources — Guides, Tips & Tools to Get Hired",
  description:
    "Free career resources: interview guides, resume tips, ATS guidance, and practical advice for landing your next job.",
  alternates: { canonical: "/career-resources" },
  openGraph: {
    title: "Career Resources — PrepNexa",
    description: "Free guides and tools for interviews, resumes, and your career.",
    type: "website",
    url: "/career-resources",
  },
};

const resources = [
  { href: "/ai-mock-interview", title: "AI Mock Interviews", desc: "Practice realistic interviews with an AI interviewer." },
  { href: "/free-ats-resume-checker", title: "Free ATS Resume Checker", desc: "Score your resume for ATS compatibility in seconds." },
  { href: "/resume-job-match", title: "Resume Job Matcher", desc: "Match your resume to any job description with an AI score." },
  { href: "/interview-questions", title: "Interview Questions", desc: "Browse questions by role and category." },
  { href: "/behavioral-interview-questions", title: "Behavioral Interview Questions", desc: "STAR answers and the most-asked behavioral questions." },
  { href: "/technical-interview-questions", title: "Technical Interview Questions", desc: "Technical questions by discipline." },
  { href: "/resume-tips", title: "Resume Tips", desc: "12 practical tips with examples." },
  { href: "/blog", title: "Blog", desc: "In-depth articles on interviews and resumes." },
  { href: "/pricing", title: "PrepNexa Pro", desc: "Unlimited practice, advanced feedback, and more." },
];

export default function CareerResourcesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Career <span className="text-gradient">Resources</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Everything you need to prepare smarter and get job-ready — tools,
          guides, and practice.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="glass h-full transition-all hover:border-primary/40">
              <CardContent className="pt-6">
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Explore
                  <ArrowRight className="h-4 w-4" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <CTA className="mt-12" />
    </div>
  );
}