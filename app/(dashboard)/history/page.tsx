import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getInterviewHistory } from "@/lib/history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Interview History",
};

export default async function HistoryPage() {
  const items = await getInterviewHistory();

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Interview History
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review all your past interview sessions.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/setup">
            <Sparkles className="mr-2 h-4 w-4" />
            New interview
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No interviews yet"
          description="Start your first interview with Alex to build your history."
        />
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="glass flex items-center justify-between gap-4 p-5 transition-all hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {item.job_role ?? "Untitled interview"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(item.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {item.status === "completed" ? (
                  <Badge variant="success">
                    {item.overall_score !== null
                      ? `${item.overall_score} / 10`
                      : "Completed"}
                  </Badge>
                ) : (
                  <Badge variant="outline">In progress</Badge>
                )}
                <Link
                  href={
                    item.status === "completed"
                      ? `/interview/${item.id}/results`
                      : `/interview/${item.id}`
                  }
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
