import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Sparkles, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getResults } from "@/lib/results";
import { getUsageStatus } from "@/lib/usage";
import { ProCtaCard } from "@/components/marketing/pro-cta-card";
import { ScoreRing } from "@/components/results/score-ring";
import { Strengths } from "@/components/results/strength-cards";
import { PerQuestionFeedback } from "@/components/results/per-question-feedback";
import { ReportActions } from "@/components/results/report-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Interview Results",
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getResults(id);
  if (!data) notFound();

  // Load usage to decide whether to show the post-free-interview conversion CTA.
  // Safe default: treat as premium (no CTA) when status can't be read, so a
  // paying user is never shown an upgrade prompt.
  let isPremium = true;
  try {
    const status = await getUsageStatus(user.id);
    isPremium = status.isPremium;
  } catch {
    // Default stands: no conversion CTA when usage is unknown.
  }

  const { interview } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Interview Results
          </h1>
          <p className="mt-1 text-muted-foreground">
            {interview.job_role ?? "Interview"} ·{" "}
            {formatDate(interview.completed_at ?? interview.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/setup">
              <Sparkles className="mr-2 h-4 w-4" />
              New interview
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">
              <RotateCcw className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Score summary */}
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <ScoreRing score={interview.overall_score ?? 0} />
            <div className="mt-6">
              <ReportActions data={data} />
            </div>
          </CardContent>
        </Card>

        {/* Summary + strengths/improvements */}
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {interview.summary ?? "No summary available."}
              </p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-6">
              <Strengths
                strengths={interview.strengths ?? []}
                improvements={interview.areas_to_improve ?? []}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">
            Question-by-Question Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PerQuestionFeedback questions={data.questions} />
        </CardContent>
      </Card>

      {/* Post-free-interview conversion for free users */}
      {!isPremium && (
        <ProCtaCard
          title="You've completed your free interview."
          description="Ready for your next interview? Upgrade to PrepNexa Pro and keep practicing with advanced feedback, resume analysis, and job matching."
        />
      )}
    </div>
  );
}
