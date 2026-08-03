import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getDashboardStats } from "@/lib/dashboard";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your interview practice at a glance.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/setup">
            <Sparkles className="mr-2 h-4 w-4" />
            Start new interview
          </Link>
        </Button>
      </div>

      {stats && <StatsCards stats={stats} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {stats && <ScoreChart stats={stats} />}
        {stats && <RecentActivity stats={stats} />}
      </div>

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
