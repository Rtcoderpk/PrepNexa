"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import {
  aggregateVision,
  type AggregatedVision,
  type VisionSample,
} from "@/lib/vision/aggregation";
import {
  calculateConfidence,
  estimateHeadPose,
  eyebrowRaise,
  eyeAspectRatio,
  gazeScore,
  mouthAspectRatio,
  postureScore,
  type LandmarkArray,
} from "@/lib/vision/metrics";
import {
  LEFT_EYE_CORNER,
  LEFT_EYE_INDICES,
  LEFT_IRIS_IDX,
  MOUTH_INDICES,
  RIGHT_EYE_CORNER,
  RIGHT_EYE_INDICES,
  RIGHT_IRIS_IDX,
} from "@/lib/vision/landmark-indices";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export interface VisionRuntimeState {
  status: "idle" | "loading" | "ready" | "running" | "error";
  error: string | null;
  /** Latest live confidence (0-100) for the indicator UI. */
  liveConfidence: number | null;
  /** Latest live eye-contact (0-1) for the indicator UI. */
  liveEyeContact: number | null;
  isCameraOn: boolean;
}

export interface UseVisionMetrics {
  state: VisionRuntimeState;
  start: () => Promise<void>;
  stop: () => void;
  /** Begin a per-question sampling window. */
  beginWindow: () => void;
  /** End the window and produce aggregated metrics for the current question. */
  endWindow: () => AggregatedVision;
}

const FPS = 10;
const SAMPLE_INTERVAL_MS = 1000 / FPS;

function noopAggregation(): AggregatedVision {
  return aggregateVision([]);
}

/**
 * Runs MediaPipe Face Landmarker + Pose Landmarker entirely in the browser
 * (WebGL). No video leaves the device. Per-frame samples are accumulated into a
 * window; endWindow() returns the aggregated metrics to persist per question.
 */
export function useVisionMetrics(): UseVisionMetrics {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const samplesRef = useRef<VisionSample[]>([]);
  const windowActiveRef = useRef(false);
  const lastBlinkMsRef = useRef(-Infinity);

  const [state, setState] = useState<VisionRuntimeState>({
    status: "idle",
    error: null,
    liveConfidence: null,
    liveEyeContact: null,
    isCameraOn: false,
  });

  const processFrame = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const face = faceRef.current;
    const pose = poseRef.current;

    let sample: VisionSample | null = null;
    const now = performance.now();

    if (face) {
      const faceResults = face.detectForVideo(video, now);
      const landmarks = faceResults.faceLandmarks?.[0];
      if (landmarks) {
        const lm: LandmarkArray = landmarks as unknown as LandmarkArray;

        const leftEar = eyeAspectRatio(lm, LEFT_EYE_INDICES);
        const rightEar = eyeAspectRatio(lm, RIGHT_EYE_INDICES);
        const avgEar = (leftEar + rightEar) / 2;
        const mar = mouthAspectRatio(lm, MOUTH_INDICES);

        const leftGaze = gazeScore(lm[LEFT_IRIS_IDX], lm[LEFT_EYE_CORNER[0]], lm[LEFT_EYE_CORNER[1]]);
        const rightGaze = gazeScore(lm[RIGHT_IRIS_IDX], lm[RIGHT_EYE_CORNER[0]], lm[RIGHT_EYE_CORNER[1]]);
        const gaze = (leftGaze + rightGaze) / 2;

        const headPose = estimateHeadPose(lm);
        const smile = mar > 0.45;
        const eyebrowVal = eyebrowRaise(lm);

        // Blink: EAR dips below threshold with a cooldown.
        const isBlink = avgEar < 0.21 && now - lastBlinkMsRef.current > 120;
        if (isBlink) lastBlinkMsRef.current = now;

        const confidence = calculateConfidence({
          avgEar,
          mar,
          eyebrowRaiseVal: eyebrowVal,
          headPose,
          gaze,
        });

        const posture = pose
          ? postureScore(
              Object.fromEntries(
                (
                  pose.detectForVideo(video, now).landmarks?.[0] ?? ([] as Array<{ x: number; y: number; z: number }>)
                ).map((l: { x: number; y: number; z: number }, i: number) => [i, l]),
              ),
            )
          : 0.5;

        sample = {
          frame: samplesRef.current.length,
          eyeContact: gaze >= 0.7,
          blink: isBlink,
          confidence,
          headPose,
          smile,
          posture,
          timestampMs: now,
        };

        setState((prev) => ({
          ...prev,
          liveConfidence: confidence,
          liveEyeContact: gaze,
        }));
      }
    }

    if (sample && windowActiveRef.current) {
      samplesRef.current.push(sample);
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, []);

  const start = useCallback(async () => {
    if (state.status === "running" || state.status === "loading") return;
    setState((prev) => ({ ...prev, status: "loading", error: null }));

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const [face, pose] = await Promise.all([
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        }),
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        }),
      ]);
      faceRef.current = face;
      poseRef.current = pose;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      videoRef.current = video;
      await video.play();

      runningRef.current = true;
      setState((prev) => ({
        ...prev,
        status: "running",
        isCameraOn: true,
        error: null,
      }));
      rafRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      runningRef.current = false;
      const message =
        error instanceof Error
          ? error.name === "NotAllowedError"
            ? "Camera permission denied. Vision analysis is disabled — the interview still works."
            : "Could not start camera analysis. The interview still works without it."
          : "Vision analysis unavailable.";
      setState((prev) => ({ ...prev, status: "error", error: message }));
    }
  }, [state.status, processFrame]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    faceRef.current?.close();
    poseRef.current?.close();
    faceRef.current = null;
    poseRef.current = null;
    videoRef.current = null;
    samplesRef.current = [];
    windowActiveRef.current = false;
    setState((prev) => ({
      ...prev,
      status: "idle",
      isCameraOn: false,
      liveConfidence: null,
      liveEyeContact: null,
    }));
  }, []);

  const beginWindow = useCallback(() => {
    samplesRef.current = [];
    windowActiveRef.current = true;
  }, []);

  const endWindow = useCallback((): AggregatedVision => {
    windowActiveRef.current = false;
    const samples = samplesRef.current;
    samplesRef.current = [];
    if (samples.length === 0) return noopAggregation();
    return aggregateVision(samples);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      faceRef.current?.close();
      poseRef.current?.close();
    };
  }, []);

  return {
    state,
    start,
    stop,
    beginWindow,
    endWindow,
  };
}
