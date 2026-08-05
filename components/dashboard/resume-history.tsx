"use client";

import { FileText, Upload } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export function ResumeHistory({ stats }: { stats: DashboardStats }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Resume History</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.resumeHistory.length === 0 ? (
          <EmptyState
            title="No resumes yet"
            description="Upload a resume during interview setup to start tailoring your practice."
            className="py-8"
          />
        ) : (
          <ul className="space-y-1">
            {stats.resumeHistory.map((resume) => (
              <li
                key={resume.id}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {resume.file_name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Upload className="h-3 w-3" />
                      {formatDate(resume.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {resume.interview_count}{" "}
                  {resume.interview_count === 1 ? "interview" : "interviews"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
