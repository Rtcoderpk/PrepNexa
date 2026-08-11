"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles, LogOut } from "lucide-react";
import type { ChatMessage, QuestionCategory } from "@/types/interview";
import { MessageBubble } from "@/components/interview/message-bubble";
import { ChatInput } from "@/components/interview/chat-input";
import { VisionIndicator } from "@/components/vision/vision-indicator";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useVisionMetrics } from "@/hooks/use-vision-metrics";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { respondAction } from "@/actions/respond";
import { AiResponseError } from "@/lib/ai/friendly-errors";
import { analyzeTranscriptMetrics } from "@/services/speech-metrics";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SpeechMetricsData, VisionMetricsData } from "@/lib/validations";

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

/** Match the friendly messages the server uses for transient AI failures. */
function isTransientAIError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("temporarily busy") ||
    msg.includes("switching to another AI engine") ||
    msg.includes("already in progress") ||
    msg.includes("No AI provider is currently available")
  );
}

/** The per-user AI budget guardrail message emitted by the router. */
function isBudgetLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("AI usage limit");
}

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
  const vision = useVisionMetrics();
  const audioRecorder = useAudioRecorder();

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
      const complete = last.content.trim() === COMPLETION_PHRASE;
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

  const captureSpeech = useCallback(async (): Promise<SpeechMetricsData | undefined> => {
    // If the audio recorder captured a blob, ask Faster Whisper. Otherwise fall
    // back to Web Speech metrics computed locally from the typed/recognized text.
    const recording = await audioRecorder.stop();
    if (recording && recording.durationSec > 0.4) {
      try {
        const form = new FormData();
        form.append("audio", recording.blob, "answer.wav");
        const response = await fetch("/api/analysis/transcribe", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (response.ok && data.transcript) {
          return {
            transcript: data.transcript,
            audioDurationSec: data.durationSec ?? recording.durationSec,
            wordsPerMinute: data.wordsPerMinute,
            pauseCount: data.pauseCount,
            avgPauseSec: data.avgPauseSec,
            fillerWordCount: data.fillerWordCount,
            fillerDensity: data.fillerDensity,
            fluencyScore: data.fluencyScore,
            transcriptionSource: "faster_whisper",
          };
        }
      } catch {
        // pythonai unavailable — fall through to local metrics.
      }
    }
    return undefined;
  }, [audioRecorder]);

  // Capture the current question's analysis window while the candidate answers.
  const collectAnswerTelemetry = useCallback(async () => {
    const speech = await captureSpeech();
    const visionMetrics = vision.endWindow();
    return { speech, vision: toVisionData(visionMetrics) };
  }, [captureSpeech, vision]);

  // Local fallback speech metrics from the typed/recognized answer.
  const buildLocalSpeech = useCallback(
    (answerText: string): SpeechMetricsData => {
      const metrics = analyzeTranscriptMetrics({ transcript: answerText });
      return {
        transcript: metrics.transcript ?? answerText,
        transcriptionSource: "web_speech",
        ...(metrics.wordsPerMinute !== undefined
          ? { wordsPerMinute: metrics.wordsPerMinute }
          : {}),
        ...(metrics.fillerWordCount !== undefined
          ? { fillerWordCount: metrics.fillerWordCount }
          : {}),
        ...(metrics.fillerDensity !== undefined
          ? { fillerDensity: metrics.fillerDensity }
          : {}),
        ...(metrics.fluencyScore !== undefined
          ? { fluencyScore: metrics.fluencyScore }
          : {}),
      };
    },
    [],
  );

  const waitForQueuedFeedback = useCallback(async (jobId: string) => {
    // Poll the status endpoint until the worker has persisted the report.
    // Hard cap guards against a worker that never ran (e.g. no FEEDBACK_WORKER_SECRET).
    const MAX_ATTEMPTS = 20;
    const INTERVAL_MS = 3000;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, INTERVAL_MS));
      try {
        const res = await fetch(
          `/api/interview/feedback/status?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        const body = await res.json();
        if (res.ok && body.done) return;
      } catch {
        // transient — keep polling
      }
    }
  }, []);

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
        if (data.budgetLimit) {
          throw new AiResponseError(
            "You've reached your AI usage limit for now. Please try again later.",
            true,
          );
        }
        throw new Error(data.error ?? "Failed to generate feedback");
      }

      // Queued path: report completes on the worker — poll then redirect.
      if (data.queued && data.jobId) {
        await waitForQueuedFeedback(data.jobId);
      }
      router.push(`/interview/${info.id}/results`);
    } catch (error) {
      toast.error(
        error instanceof AiResponseError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to generate feedback. Please refresh the results page.",
      );
      router.push(`/interview/${info.id}/results`);
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [info.id, messages, router, waitForQueuedFeedback]);

  const handleSend = useCallback(
    async (text: string) => {
      if (isEnded || isThinking || isGeneratingFeedback) return;

      // Start sampling metrics for the answer about to be recorded.
      vision.beginWindow();
      try {
        await audioRecorder.start();
      } catch {
        // mic may already be in use; answer still proceeds without audio.
      }

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

        // Stop recording and collect telemetry (transcription + vision).
        const { speech, vision: visionData } = await collectAnswerTelemetry();

        const result = await respondAction({
          interviewId: info.id,
          answer: text,
          previousMessages: prevMessages,
          speech: speech ?? buildLocalSpeech(text),
          vision: visionData,
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
        // Never surface raw provider errors. AI failures preserve the answer
        // (persisted server-side) so the interview can continue/reconnect.
        if (
          isBudgetLimitError(error) ||
          (error instanceof AiResponseError && error.budgetLimit)
        ) {
          toast.error(
            "You've reached your AI usage limit for now. Please try again later.",
          );
        } else if (isTransientAIError(error)) {
          toast.error(
            "AI is temporarily busy. We're automatically switching to another AI engine. Your answer is saved.",
          );
        } else {
          toast.error(
            error instanceof Error
              ? error.message
              : "Something went wrong. Your answer was saved — please refresh to continue.",
          );
        }
      }
    },
    [info.id, isEnded, isThinking, isGeneratingFeedback, messages, vision, audioRecorder, collectAnswerTelemetry, buildLocalSpeech, generateFeedback],
  );

  const handleCameraToggle = useCallback(() => {
    if (vision.state.isCameraOn || vision.state.status === "loading") {
      vision.stop();
    } else {
      void vision.start();
    }
  }, [vision]);

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
          <VisionIndicator vision={vision.state} onToggle={handleCameraToggle} />
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

function toVisionData(agg: {
  durationSec: number;
  sampleCount: number;
  eyeContactPct: number;
  blinkCount: number;
  blinkRatePerMin: number;
  avgConfidence: number;
  headPitchAvg: number;
  headYawAvg: number;
  headRollAvg: number;
  smilePct: number;
  postureScore: number;
}): VisionMetricsData {
  return {
    durationSec: agg.durationSec,
    sampleCount: agg.sampleCount,
    eyeContactPct: agg.eyeContactPct,
    blinkCount: agg.blinkCount,
    blinkRatePerMin: agg.blinkRatePerMin,
    avgConfidence: agg.avgConfidence,
    confidenceSamples: agg.sampleCount,
    headPitchAvg: agg.headPitchAvg,
    headYawAvg: agg.headYawAvg,
    headRollAvg: agg.headRollAvg,
    smilePct: agg.smilePct,
    postureScore: agg.postureScore,
  };
}
