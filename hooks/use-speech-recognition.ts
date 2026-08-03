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

  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      const Ctor = getSpeechRecognition();
      if (!Ctor) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }

      stop();

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
        setIsListening(false);
        const text = (finalText || transcript).trim();
        if (text) {
          onFinalTranscript(text);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("Microphone access was denied. Please allow it in your browser.");
        } else if (event.error === "no-speech") {
          // no-op, user can retry
        } else {
          setError("Speech recognition error. Please try again.");
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setError(null);
      setTranscript("");
      setIsListening(true);
      recognition.start();
    },
    [stop, transcript],
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
