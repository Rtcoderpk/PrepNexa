"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

function LineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <p className="font-medium">{label}</p>
      <p className="text-primary">
        {value !== null && value !== undefined
          ? `Confidence: ${value} / 10`
          : "No confidence data"}
      </p>
    </div>
  );
}

export function ConfidenceTrajectory({ stats }: { stats: DashboardStats }) {
  const hasData = stats.confidenceTrend.some((p) => p.score !== null);

  const data = useMemo(
    () =>
      stats.confidenceTrend.map((p) => ({
        ...p,
        score: p.score ?? null,
      })),
    [stats.confidenceTrend],
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Confidence Trajectory</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No confidence data yet"
            description="Complete interviews to track how your confidence grows over time."
            className="py-8"
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
              >
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
                  domain={[0, 10]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<LineTooltip />} />
                <ReferenceLine
                  y={5}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
