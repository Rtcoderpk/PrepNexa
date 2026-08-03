"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Mic, Square, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { Button } from "@/components/ui/button";

export function ChatInput({
  disabled,
  onSend,
  onSpeak,
  isSpeaking,
  isVoiceSupported,
  isMuted,
  onToggleMute,
  isSpeechSupported,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
  onSpeak?: () => void;
  isSpeaking?: boolean;
  isVoiceSupported?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isSpeechSupported?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechRecognition();

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
    [onSend, disabled],
  );

  const handleMicToggle = () => {
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start((finalText) => {
        setValue((prev) =>
          prev ? `${prev.trim()} ${finalText}` : finalText,
        );
      });
    }
  };

  // Keep transcript in the input while listening
  useEffect(() => {
    if (speech.isListening && speech.transcript) {
      setValue(speech.transcript);
    }
  }, [speech.isListening, speech.transcript]);

  // Auto-resize the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(value);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 shadow-lg backdrop-blur-xl focus-within:border-primary/50">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Alex is finishing up…"
              : "Type your answer or tap the mic…"
          }
          disabled={disabled}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {isVoiceSupported && (
          <Button
            type="button"
            size="icon"
            variant={speech.isListening ? "destructive" : "outline"}
            onClick={handleMicToggle}
            className="shrink-0"
            aria-label={
              speech.isListening ? "Stop recording" : "Start recording"
            }
            title={
              speech.isListening ? "Stop recording" : "Start recording"
            }
          >
            {speech.isListening ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          type="button"
          size="icon"
          variant="gradient"
          onClick={() => submit(value)}
          disabled={disabled || !value.trim()}
          aria-label="Send answer"
          className="shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {speech.isListening && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              Listening…
            </motion.span>
          )}
          {speech.error && (
            <span className="text-xs text-destructive">{speech.error}</span>
          )}
        </div>

        {isSpeechSupported && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            className="gap-1.5 text-muted-foreground"
            aria-label={isMuted ? "Unmute Alex" : "Mute Alex"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : isSpeaking ? (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Volume2 className="h-4 w-4 text-primary" />
              </motion.span>
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            <span className="text-xs">{isMuted ? "Unmute" : "Voice"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
