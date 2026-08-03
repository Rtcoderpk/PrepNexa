"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <p className="font-medium">{label}</p>
      <p className="text-primary">Score: {payload[0].value} / 10</p>
    </div>
  );
}

export function ScoreChart({ stats }: { stats: DashboardStats }) {
  const hasData = stats.scoreTrend.length >= 2;

  const domain = useMemo(() => [0, 10], []);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Score Improvement</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No completed interviews yet"
            description="Complete an interview to see your score trend here."
            className="py-8"
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.scoreTrend}
                margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={domain}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#scoreGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
