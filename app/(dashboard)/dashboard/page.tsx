import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getDashboardStats } from "@/lib/dashboard";
import { getUsageStatus } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";
import { AdSlot } from "@/components/ads/ad-slot";
import { UsageSummary } from "@/components/dashboard/usage-summary";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { ConfidenceTrajectory } from "@/components/dashboard/confidence-trajectory";
import { WeeklyTrend } from "@/components/dashboard/weekly-trend";
import { ResumeHistory } from "@/components/dashboard/resume-history";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  let stats;
  try {
    stats = await getDashboardStats();
  } catch {
    stats = null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let usage: null | Awaited<ReturnType<typeof getUsageStatus>> = null;
  if (user) {
    try {
      usage = await getUsageStatus(user.id);
    } catch {
      // Defaults stand.
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your career progress at a glance.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/setup">
            <Sparkles className="mr-2 h-4 w-4" />
            Start new interview
          </Link>
        </Button>
      </div>

      {usage && <UsageSummary usage={usage} />}

      {stats && <StatsCards stats={stats} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {stats && <ScoreChart stats={stats} />}
        {stats && <RecentActivity stats={stats} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {stats && <SkillRadar stats={stats} />}
        {stats && <ConfidenceTrajectory stats={stats} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {stats && <WeeklyTrend stats={stats} />}
        {stats && <ResumeHistory stats={stats} />}
      </div>

      {/* Ads for free users only */}
      {usage && !usage.isPremium && <AdSlot slot="dashboard" />}

      {!stats && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">
            We couldn&apos;t load your dashboard. Please refresh to try again.
          </p>
        </div>
      )}
    </div>
  );
}
