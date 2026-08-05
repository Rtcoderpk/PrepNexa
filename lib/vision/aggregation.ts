/**
 * Aggregates per-frame vision samples into the session-level metrics that get
 * persisted per answered question. Pure functions — no browser APIs.
 */

import type { VisionMetricsData } from "@/lib/validations";

export interface VisionSample {
  /** frame index */
  frame: number;
  eyeContact: boolean; // gaze considered engaged
  blink: boolean; // this frame is a blink
  confidence: number; // 0-100
  headPose: { pitch: number; yaw: number; roll: number };
  smile: boolean;
  posture: number; // 0-1
  timestampMs: number;
}

export interface AggregatedVision {
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
}

const EYE_CONTACT_THRESHOLD = 0.7;
const BLINK_EAR_THRESHOLD = 0.21;
const SMILE_MAR_THRESHOLD = 0.45;
const BLINK_COOLDOWN_MS = 120;

export function aggregateVision(
  samples: VisionSample[],
  eyeContactThreshold = EYE_CONTACT_THRESHOLD,
): AggregatedVision {
  if (samples.length === 0) {
    return {
      durationSec: 0,
      sampleCount: 0,
      eyeContactPct: 0,
      blinkCount: 0,
      blinkRatePerMin: 0,
      avgConfidence: 0,
      headPitchAvg: 0,
      headYawAvg: 0,
      headRollAvg: 0,
      smilePct: 0,
      postureScore: 0,
    };
  }

  const engaged = samples.filter((s) => s.confidence >= eyeContactThreshold).length;
  const smiling = samples.filter((s) => s.smile).length;
  const total = samples.length;

  const blinkCount = countBlinks(samples);
  const startMs = samples[0].timestampMs;
  const endMs = samples[samples.length - 1].timestampMs;
  const durationSec = endMs > startMs ? (endMs - startMs) / 1000 : 0;
  const blinkRatePerMin = durationSec > 0 ? (blinkCount / durationSec) * 60 : 0;

  const avgConfidence =
    samples.reduce((sum, s) => sum + s.confidence, 0) / total;
  const headPitchAvg =
    samples.reduce((sum, s) => sum + s.headPose.pitch, 0) / total;
  const headYawAvg =
    samples.reduce((sum, s) => sum + s.headPose.yaw, 0) / total;
  const headRollAvg =
    samples.reduce((sum, s) => sum + s.headPose.roll, 0) / total;
  const postureScore =
    samples.reduce((sum, s) => sum + s.posture, 0) / total;

  return {
    durationSec: round1(durationSec),
    sampleCount: total,
    eyeContactPct: round1((engaged / total) * 100),
    blinkCount,
    blinkRatePerMin: round1(blinkRatePerMin),
    avgConfidence: round1(avgConfidence),
    headPitchAvg: round1(headPitchAvg),
    headYawAvg: round1(headYawAvg),
    headRollAvg: round1(headRollAvg),
    smilePct: round1((smiling / total) * 100),
    postureScore: round1(postureScore),
  };
}

/**
 * Counts distinct blinks with a cooldown: consecutive low-EAR frames within the
 * cooldown window collapse into a single blink. Uses the blink flag already set
 * per sample by the hook, which runs the EAR threshold.
 */
function countBlinks(samples: VisionSample[]): number {
  let count = 0;
  let lastBlinkMs = -Infinity;
  for (const sample of samples) {
    if (sample.blink && sample.timestampMs - lastBlinkMs > BLINK_COOLDOWN_MS) {
      count += 1;
      lastBlinkMs = sample.timestampMs;
    }
  }
  return count;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function toVisionMetricsData(agg: AggregatedVision): VisionMetricsData {
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

