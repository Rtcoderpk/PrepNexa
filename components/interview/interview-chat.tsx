"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles, LogOut } from "lucide-react";
import type { ChatMessage, QuestionCategory } from "@/types/interview";
import { MessageBubble } from "@/components/interview/message-bubble";
import { ChatInput } from "@/components/interview/chat-input";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { respondAction } from "@/actions/respond";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ExistingQuestion {
  id: string;
  question: string;
  category: string;
  answer: string | null;
  is_follow_up: boolean;
  created_at: string;
}

const COMPLETION_PHRASE =
  "That wraps up our interview — thank you for your time today.";

export function InterviewChat({
  info,
  initialQuestions,
  maxQuestions,
}: {
  info: { id: string; jobRole: string | null };
  initialQuestions: ExistingQuestion[];
  maxQuestions: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { speak, isSupported: ttsSupported, isSpeaking, muted, toggleMute } =
    useSpeechSynthesis();

  // Hydrate from existing questions on mount (page refresh)
  useEffect(() => {
    if (initialQuestions.length === 0) return;

    const hydrated: ChatMessage[] = [];
    for (const q of initialQuestions) {
      hydrated.push({
        id: q.id,
        role: "assistant",
        content: q.question,
        timestamp: new Date(q.created_at),
        category: q.category as QuestionCategory,
      });
      if (q.answer) {
        hydrated.push({
          id: `${q.id}-answer`,
          role: "user",
          content: q.answer,
          timestamp: new Date(q.created_at),
        });
      }
    }
    setMessages(hydrated);

    const last = hydrated[hydrated.length - 1];
    if (last && last.role === "assistant") {
      const complete =
        last.content.trim() === COMPLETION_PHRASE;
      if (complete) setIsEnded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  // Speak Alex's newest message
  const lastAssistantIndex = messages
    .map((m) => m.role)
    .lastIndexOf("assistant");
  const hasUnspoken = lastAssistantIndex === messages.length - 1;
  useEffect(() => {
    if (hasUnspoken && ttsSupported && !muted && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant") speak(last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, ttsSupported, muted]);

  // Generate opening question if the chat is empty
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (initialQuestions.length > 0) return;

    const startInterview = async () => {
      setIsThinking(true);
      try {
        const response = await fetch("/api/interview/opening", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId: info.id }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to start the interview");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `q-${data.questionId}`,
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
            category: data.category as QuestionCategory,
          },
        ]);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to start the interview. Please refresh.",
        );
      } finally {
        setIsThinking(false);
      }
    };

    void startInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (isEnded || isThinking || isGeneratingFeedback) return;

      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: text,
          timestamp: new Date(),
        },
      ]);
      setIsThinking(true);

      try {
        const prevMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
          category: m.category,
          isFollowUp: false,
        }));

        const result = await respondAction({
          interviewId: info.id,
          answer: text,
          previousMessages: prevMessages,
        });

        const isComplete = result.message.trim() === COMPLETION_PHRASE;

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: result.message,
            timestamp: new Date(),
            category: result.isFollowUp
              ? undefined
              : (result.category as QuestionCategory),
          },
        ]);
        setIsThinking(false);

        if (isComplete) {
          setIsEnded(true);
          setIsGeneratingFeedback(true);
          toast.success("Interview complete! Generating your feedback…");
          await generateFeedback();
        }
      } catch (error) {
        setIsThinking(false);
        toast.error(
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        );
      }
    },
    [info.id, isEnded, isThinking, isGeneratingFeedback, messages],
  );

  const generateFeedback = useCallback(async () => {
    try {
      const response = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: info.id,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate feedback");
      }
      router.push(`/interview/${info.id}/results`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate feedback. Please refresh the results page.",
      );
      router.push(`/interview/${info.id}/results`);
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [info.id, messages, router]);

  const roleLabel = info.jobRole || "your interview";
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const progress = Math.min(100, (assistantCount / maxQuestions) * 100);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Alex</p>
            <p className="text-xs text-muted-foreground">
              {roleLabel} interview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:block">
            {assistantCount} / {maxQuestions} questions
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => router.push("/dashboard")}
          >
            <LogOut className="mr-1 h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Progress value={progress} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-4"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isThinking && (
          <MessageBubble
            message={{
              id: "thinking",
              role: "assistant",
              content: "",
              timestamp: new Date(),
            }}
            isTyping
          />
        )}
        {isGeneratingFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center py-4"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary/80 px-4 py-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
              Alex is scoring your interview…
            </span>
          </motion.div>
        )}
      </div>

      {/* Footer input */}
      <div className="border-t border-border/60 p-3">
        <ChatInput
          disabled={isEnded || isThinking || isGeneratingFeedback}
          onSend={handleSend}
          isSpeechSupported={ttsSupported}
          isSpeaking={isSpeaking}
          isMuted={muted}
          onToggleMute={toggleMute}
          isVoiceSupported
        />
      </div>
    </div>
  );
}
