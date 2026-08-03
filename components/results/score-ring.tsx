"use client";

import { motion } from "framer-motion";

function scoreColor(score: number): string {
  if (score >= 8) return "#10b981";
  if (score >= 6) return "#f59e0b";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Needs work";
  return "Weak";
}

export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.min(10, Math.max(0, score));
  const color = scoreColor(clamped);
  const degrees = clamped * 36; // 10/10 → 360deg

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${degrees}deg, var(--secondary) ${degrees}deg)`,
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-[10.5rem] w-[10.5rem] flex-col items-center justify-center rounded-full bg-background"
          >
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-5xl font-extrabold"
              style={{ color }}
            >
              {clamped}
            </motion.span>
            <span className="text-sm text-muted-foreground">/ 10</span>
          </motion.div>
        </div>
      </div>
      <p
        className="mt-4 text-lg font-semibold"
        style={{ color }}
      >
        {scoreLabel(clamped)}
      </p>
    </div>
  );
}
