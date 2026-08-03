"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionItem {
  id: string;
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
  category: string;
  is_follow_up: boolean;
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-success";
  if (score >= 6) return "text-amber-500";
  return "text-destructive";
}

export function PerQuestionFeedback({
  questions,
}: {
  questions: QuestionItem[];
}) {
  const [open, setOpen] = useState<string | null>(questions[0]?.id ?? null);

  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No questions recorded.</p>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => {
        const isOpen = open === q.id;
        return (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card/50"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : q.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium">
                    {q.question}
                  </p>
                  <span className="text-xs capitalize text-muted-foreground">
                    {q.category}
                    {q.is_follow_up ? " · follow-up" : ""}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {q.score !== null && (
                  <span
                    className={cn(
                      "text-sm font-bold",
                      scoreColor(q.score),
                    )}
                  >
                    {q.score}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-3 border-t border-border/60 p-4">
                    {q.answer && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Your answer
                        </p>
                        <p className="rounded-xl bg-secondary/50 p-3 text-sm">
                          {q.answer}
                        </p>
                      </div>
                    )}
                    {q.feedback && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Alex&apos;s feedback
                        </p>
                        <p className="rounded-xl bg-primary/5 p-3 text-sm">
                          {q.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
