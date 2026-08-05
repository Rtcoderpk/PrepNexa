"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const interviews = payload.find((p: any) => p.dataKey === "interviews")?.value;
  const avg = payload.find((p: any) => p.dataKey === "averageScore")?.value;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <p className="font-medium">{label}</p>
      <p>Interviews: {interviews ?? 0}</p>
      <p className="text-primary">
        Avg score: {avg !== null && avg !== undefined ? `${avg} / 10` : "—"}
      </p>
    </div>
  );
}

export function WeeklyTrend({ stats }: { stats: DashboardStats }) {
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

  const hasData =
    (range === "weekly" ? stats.weeklyTrend : stats.monthlyTrend).some(
      (b) => b.interviews > 0,
    );

  const data =
    range === "weekly" ? stats.weeklyTrend : stats.monthlyTrend;

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Practice Volume</CardTitle>
        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as "weekly" | "monthly")}
        >
          <TabsList className="h-8">
            <TabsTrigger value="weekly" className="text-xs">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              Monthly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No interviews in this period"
            description="Complete interviews to see your practice volume here."
            className="py-8"
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
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
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="volume"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="score"
                  orientation="right"
                  domain={[0, 10]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TrendTooltip />} />
                <Bar
                  yAxisId="volume"
                  dataKey="interviews"
                  fill="#8b5cf6"
                  fillOpacity={0.55}
                  radius={[4, 4, 0, 0]}
                  barSize={range === "weekly" ? 16 : 32}
                />
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="averageScore"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                  connectNulls={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
