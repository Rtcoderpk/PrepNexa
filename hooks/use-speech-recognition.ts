"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ??
    w.webkitSpeechRecognition ??
    null) as SpeechRecognitionConstructor | null;
  return Ctor;
}

export function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const shouldBeListeningRef = useRef(false);
  const hasFatalErrorRef = useRef(false);
  const onFinalTranscriptRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const stop = useCallback(() => {
    shouldBeListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      onFinalTranscriptRef.current = onFinalTranscript;

      const Ctor = getSpeechRecognition();
      if (!Ctor) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }

      stop();

      hasFatalErrorRef.current = false;
      shouldBeListeningRef.current = true;

      const recognition = new Ctor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalText = "";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        setTranscript((finalText + interim).trim());
      };

      recognition.onend = () => {
        const text = (finalText || transcriptRef.current).trim();
        if (text) {
          onFinalTranscriptRef.current(text);
          finalText = "";
          setTranscript("");
          transcriptRef.current = "";
        }

        if (shouldBeListeningRef.current && !hasFatalErrorRef.current) {
          try {
            recognition.start();
            return;
          } catch (e) {
            console.error("Failed to auto-restart speech recognition:", e);
          }
        }
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        const err = event.error;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone access was denied. Please allow it in your browser.");
          hasFatalErrorRef.current = true;
        } else if (err === "audio-capture") {
          setError("No microphone was found. Please ensure it is plugged in.");
          hasFatalErrorRef.current = true;
        } else if (err === "language-not-supported") {
          setError("The selected language is not supported by your browser.");
          hasFatalErrorRef.current = true;
        } else if (err === "network") {
          setError("Network error occurred. Please check your connection.");
          hasFatalErrorRef.current = true;
        } else if (err === "no-speech") {
          // no-op, user can retry
        } else if (err === "aborted") {
          // no-op, user stopped it
        } else {
          setError(`Speech recognition error (${err}). Please try again.`);
        }

        if (hasFatalErrorRef.current) {
          shouldBeListeningRef.current = false;
        }
      };

      recognitionRef.current = recognition;
      setError(null);
      setTranscript("");
      setIsListening(true);
      recognition.start();
    },
    [stop],
  );

  const toggle = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      if (isListening) {
        stop();
      } else {
        start(onFinalTranscript);
      }
    },
    [isListening, start, stop],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, toggle };
}
