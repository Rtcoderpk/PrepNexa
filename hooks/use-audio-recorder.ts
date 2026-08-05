"use client";

import { useCallback, useRef, useState } from "react";

export interface AudioRecording {
  /** WAV Blob ready for upload to the transcription endpoint. */
  blob: Blob;
  durationSec: number;
}

interface UseAudioRecorder {
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<AudioRecording | null>;
}

const SAMPLE_RATE = 16000;

/**
 * Records microphone audio as 16-bit PCM WAV at 16kHz (the format Faster Whisper
 * expects). Used to capture a candidate's spoken answer per question.
 */
export function useAudioRecorder(): UseAudioRecorder {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: SAMPLE_RATE },
      });
      streamRef.current = stream;
      setIsSupported(true);

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      startTimeRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission denied. You can still type your answers."
          : "Could not access the microphone. You can still type your answers.";
      setError(message);
      setIsSupported(false);
    }
  }, []);

  const stop = useCallback(async (): Promise<AudioRecording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return null;
    }

    const durationSec = (Date.now() - startTimeRef.current) / 1000;

    return new Promise<AudioRecording | null>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: "audio/wav",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
        if (blob.size > 0) {
          resolve({ blob, durationSec });
        } else {
          resolve(null);
        }
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, isSupported, error, start, stop };
}
