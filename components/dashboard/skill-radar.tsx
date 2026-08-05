"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

function RadarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <p className="font-medium">{entry.payload.skill}</p>
      <p className="text-primary">
        {entry.payload.value !== null
          ? `${entry.payload.value} / 10`
          : "No data yet"}
      </p>
    </div>
  );
}

export function SkillRadar({ stats }: { stats: DashboardStats }) {
  const data = useMemo(() => {
    const rows = [
      { skill: "Technical", value: stats.skillAverages.technical },
      { skill: "Communication", value: stats.skillAverages.communication },
      { skill: "Confidence", value: stats.skillAverages.confidence },
      { skill: "Grammar", value: stats.skillAverages.grammar },
      { skill: "Speaking Speed", value: stats.skillAverages.speakingSpeed },
      { skill: "Eye Contact", value: stats.skillAverages.eyeContact },
      { skill: "Body Language", value: stats.skillAverages.bodyLanguage },
    ];
    return rows.map((r) => ({
      ...r,
      value: r.value ?? 0,
      hasData: r.value !== null,
    }));
  }, [stats.skillAverages]);

  const hasAnyData = data.some((d) => d.hasData);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Skill Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <EmptyState
            title="No skill data yet"
            description="Complete interviews with vision and voice enabled to see your skill breakdown."
            className="py-8"
          />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 10]}
                    tick={false}
                    axisLine={false}
                  />
                  <Tooltip content={<RadarTooltip />} />
                  <Radar
                    dataKey="value"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Averages across {stats.completedInterviews} completed interview
              {stats.completedInterviews === 1 ? "" : "s"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
