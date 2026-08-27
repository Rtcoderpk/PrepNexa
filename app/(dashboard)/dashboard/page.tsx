import type { Metadata } from "next";
import Link from "next/link";
import { Mic, FileText, ArrowRight } from "lucide-react";
import { getDashboardStats } from "@/lib/dashboard";
import { getUsageStatus } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";
import { AdSlot } from "@/components/ads/ad-slot";
import { UsageSummary } from "@/components/dashboard/usage-summary";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

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
            Practice interviews, analyze your resume, and track your progress —
            all in one place.
          </p>
        </div>
      </div>

      {/* Primary actions — one page, two clear things to do */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/setup"
          className="group relative overflow-hidden rounded-3xl border border-border/60 bg-background/50 p-6 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-secondary/40"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl transition-opacity group-hover:bg-indigo-500/20" />
          <div className="relative">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg">
              <Mic className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">AI Mock Interview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Practice with Alex — 5 realistic questions with instant feedback
              and a detailed performance report.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Start interview
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <Link
          href="/free-ats-resume-checker"
          className="group relative overflow-hidden rounded-3xl border border-border/60 bg-background/50 p-6 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-secondary/40"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl transition-opacity group-hover:bg-fuchsia-500/20" />
          <div className="relative">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">Resume / ATS Analyzer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check how well your CV passes ATS screening — score, keywords,
              strengths, and improvements.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Analyze my resume
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </div>

      {usage && <UsageSummary usage={usage} />}

      {stats && <StatsCards stats={stats} />}

      {stats && <RecentActivity stats={stats} />}

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
