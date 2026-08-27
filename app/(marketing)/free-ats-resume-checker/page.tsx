import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/usage";
import { ResumeAnalyzer } from "@/components/resume/resume-analyzer";
import { AdSlot } from "@/components/ads/ad-slot";
import { PLANS } from "@/lib/pricing";
import { CTA } from "@/components/marketing/cta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Free ATS Resume Checker — Check Resume Compatibility with ATS",
  description:
    "Free ATS resume checker. Analyze your resume for ATS compatibility, keywords, structure, and action verbs in seconds. Get an ATS score out of 100 and actionable improvements.",
  alternates: {
    canonical: "/free-ats-resume-checker",
  },
  openGraph: {
    title: "Free ATS Resume Checker — PrepNexa",
    description:
      "Check your resume's ATS compatibility for free. Get an ATS score, keyword analysis, and improvement suggestions.",
    type: "website",
    url: "/free-ats-resume-checker",
  },
};

export default async function FreeAtsResumeCheckerPage() {
  // Determine usage gating for logged-in users; anonymous visitors can still
  // see the tool UI but analysis requires sign-in.
  let limitReached = false;
  let remainingChecks: number = PLANS.free.freeResumeChecks;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const status = await getUsageStatus(user.id);
      remainingChecks = status.resumeChecksRemaining;
      limitReached = !status.isPremium && status.resumeChecksRemaining <= 0;
    } catch {
      // Defaults stand.
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-1.5 text-xs font-medium">
          Free · No sign-up required to view
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
          Free ATS{" "}
          <span className="text-gradient">Resume Checker</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Upload your resume and get an ATS compatibility score, keyword
          analysis, and improvement suggestions in seconds.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {PLANS.free.freeResumeChecks} free resume checks included with a free
          account.
        </p>
      </div>

      <div className="mt-10">
        <ResumeAnalyzer
          limitReached={limitReached}
          remainingChecks={remainingChecks}
          requiresAuth={!user}
        />
      </div>

      <AdSlot slot="ats-results" />

      <div className="mx-auto mt-12 max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold">
          What is an ATS resume check?
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Applicant Tracking Systems (ATS) scan resumes for structure,
            keywords, and formatting before a human ever sees them. Our free ATS
            checker reviews your resume against the same signals — headings,
            contact info, action verbs, measurable achievements, and keyword
            density — and scores it out of 100.
          </p>
          <p>
            You get a clear breakdown of what&apos;s working, what&apos;s
            missing, and how to fix it. The ATS score is an AI-based
            compatibility estimate, not a guaranteed score from a specific ATS
            vendor.
          </p>
        </div>

        <h2 className="text-2xl font-bold">
          How to improve your ATS score
        </h2>
        <ul className="list-inside list-disc space-y-2 text-muted-foreground">
          <li>Use a standard resume layout with clear section headings.</li>
          <li>
            Start each bullet with a strong action verb (built, launched,
            optimized).
          </li>
          <li>
            Include measurable results — numbers, percentages, and time saved.
          </li>
          <li>
            Mirror the keywords from the job description in your skills and
            experience.
          </li>
          <li>Avoid text boxes, images, and tables that ATS parsers skip.</li>
        </ul>
        <p className="mt-4">
          Targeting a specific job? Use the{" "}
          <a
            href="/resume-job-match"
            className="text-primary hover:underline"
          >
            resume job matcher
          </a>{" "}
          to see how well your resume fits a job description and what to
          change.
        </p>
      </div>

      <CTA className="mt-12" />
    </div>
  );
}
