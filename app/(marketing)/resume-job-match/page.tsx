import type { Metadata } from "next";
import { JobMatchAnalyzer } from "@/components/resume/job-match-analyzer";
import { CTA } from "@/components/marketing/cta";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resume Job Description Matcher — Match Your CV to a Job",
  description:
    "Paste a job description and get a match score, missing keywords, and recommended changes to make your resume fit the role. A PrepNexa Pro feature.",
  alternates: { canonical: "/resume-job-match" },
  openGraph: {
    title: "Resume Job Matcher — PrepNexa",
    description:
      "Match your resume to any job description with an AI match score and recommended changes.",
    type: "website",
    url: "/resume-job-match",
  },
};

export default async function ResumeJobMatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Resume ↔ Job <span className="text-gradient">Matcher</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Upload your resume, paste the job description you&apos;re targeting,
          and see exactly how well you fit — plus what to change.
        </p>
        {!user && (
          <p className="mt-3 text-sm text-muted-foreground">
            Job matching is a PrepNexa Pro feature.{" "}
            <a className="text-primary hover:underline" href="/signup">
              Sign in
            </a>{" "}
            to use it.
          </p>
        )}
      </div>

      <div className="mt-10">
        <JobMatchAnalyzer />
      </div>

      <CTA className="mt-12" />
    </div>
  );
}