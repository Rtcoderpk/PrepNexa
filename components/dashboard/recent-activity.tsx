"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export function RecentActivity({ stats }: { stats: DashboardStats }) {
  if (stats.recentActivity.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No interviews yet"
            description="Start your first interview with Alex to begin tracking your progress."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <Link
          href="/history"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {stats.recentActivity.map((item) => (
          <Link
            key={item.id}
            href={
              item.status === "completed"
                ? `/interview/${item.id}/results`
                : `/interview/${item.id}`
            }
            className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {item.job_role ?? "Untitled interview"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(item.created_at)}
              </p>
            </div>
            {item.status === "completed" ? (
              <div className="flex items-center gap-2">
                {item.overall_score !== null && (
                  <Badge variant="success">
                    {item.overall_score} / 10
                  </Badge>
                )}
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline">In progress</Badge>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
