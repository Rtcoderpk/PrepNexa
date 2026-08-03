"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechSynthesis() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || muted) return;

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;

      const voices = synth.getVoices();
      const preferred = voices.find((v) =>
        v.name.toLowerCase().includes("google"),
      );
      utterance.voice = preferred ?? voices[0] ?? null;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechRef.current = utterance;
      synth.speak(utterance);
    },
    [isSupported, muted],
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  return { isSupported, isSpeaking, muted, speak, stop, toggleMute };
}
