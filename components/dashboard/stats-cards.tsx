"use client";

import { motion } from "framer-motion";
import {
  Briefcase,
  CheckCircle2,
  TrendingUp,
  Timer,
} from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard";

const cards = [
  {
    key: "total",
    label: "Total Interviews",
    icon: Briefcase,
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    key: "average",
    label: "Average Score",
    icon: TrendingUp,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    key: "inProgress",
    label: "In Progress",
    icon: Timer,
    gradient: "from-fuchsia-500 to-pink-500",
  },
] as const;

export function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const value =
          card.key === "average"
            ? stats.averageScore !== null
              ? `${stats.averageScore.toFixed(1)}`
              : "—"
            : String(
                card.key === "total"
                  ? stats.totalInterviews
                  : card.key === "completed"
                    ? stats.completedInterviews
                    : stats.inProgressCount,
              );

        const suffix = card.key === "average" ? " / 10" : "";

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            className="glass rounded-2xl p-5"
          >
            <div
              className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-lg`}
            >
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {value}
              {suffix}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
