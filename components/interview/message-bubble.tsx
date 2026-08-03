"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types/interview";
import { formatTime } from "@/lib/utils";
import { QUESTION_CATEGORY_LABELS } from "@/types/interview";
import { cn } from "@/lib/utils";

export function MessageBubble({
  message,
  isTyping,
}: {
  message: ChatMessage;
  isTyping?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex items-end gap-3", isUser && "flex-row-reverse")}
    >
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/25">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[78%] space-y-1.5 sm:max-w-[70%]",
          isUser && "items-end",
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-primary">
              Alex
            </span>
            {message.category && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {QUESTION_CATEGORY_LABELS[message.category as keyof typeof QUESTION_CATEGORY_LABELS] ??
                  message.category}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-br-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
              : "rounded-bl-md glass",
          )}
        >
          {isTyping ? (
            <TypingIndicator />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        <div
          className={cn(
            "px-1 text-[10px] text-muted-foreground",
            isUser && "text-right",
          )}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-typing-dot rounded-full bg-primary"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
