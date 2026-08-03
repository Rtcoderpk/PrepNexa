"use client";

import { motion } from "framer-motion";
import { ThumbsUp, TrendingUp, Sparkles } from "lucide-react";

export function Strengths({
  strengths,
  improvements,
}: {
  strengths: string[];
  improvements: string[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
            <ThumbsUp className="h-4 w-4" />
          </span>
          Strengths
        </h3>
        {strengths.length === 0 ? (
          <p className="text-sm text-muted-foreground">No strengths recorded.</p>
        ) : (
          strengths.map((strength, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="rounded-xl border border-success/20 bg-success/5 p-3 text-sm"
            >
              {strength}
            </motion.div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <TrendingUp className="h-4 w-4" />
          </span>
          Areas to Improve
        </h3>
        {improvements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No areas to improve recorded.
          </p>
        ) : (
          improvements.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm"
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-destructive/10">
                <Sparkles className="h-3 w-3 text-destructive" />
              </span>
              {item}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
