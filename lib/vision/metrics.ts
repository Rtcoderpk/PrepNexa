/**
 * Browser-side facial metrics. Ported from the reference InterviewAnalyser's
 * mediapipe_helpers.py and rewritten for MediaPipe Tasks (browser) landmark
 * arrays. All functions are pure: they take normalized landmarks and return
 * dimensionless metrics, so they are trivially unit-testable.
 *
 * Landmark coordinate convention (MediaPipe Tasks):
 *   x, y in [0,1] normalized to image; z in [-1,1] (not used for ratios here).
 */

import {
  LEFT_BROW_CENTER_IDX,
  LEFT_EYE_CENTER_IDX,
  LEFT_EYE_CORNER,
  LEFT_EYE_INDICES,
  LEFT_IRIS_IDX,
  MOUTH_INDICES,
  RIGHT_EYE_CORNER,
  RIGHT_EYE_INDICES,
  RIGHT_IRIS_IDX,
} from "@/lib/vision/landmark-indices";

export type Landmark = { x: number; y: number; z: number };

export type LandmarkArray = Landmark[];

interface XY {
  x: number;
  y: number;
}

function dist(a: XY, b: XY): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function mid(a: XY, b: XY): XY {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Eye Aspect Ratio (EAR) from 6 eye landmarks.
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 */
export function eyeAspectRatio(landmarks: LandmarkArray, eyeIndices: readonly number[]): number {
  const p = eyeIndices.map((i) => landmarks[i]);
  const A = dist(p[1], p[5]);
  const B = dist(p[2], p[4]);
  const C = dist(p[0], p[3]);
  if (C === 0) return 0;
  return (A + B) / (2 * C);
}

/**
 * Mouth Aspect Ratio (MAR) from 8 mouth ring points.
 */
export function mouthAspectRatio(landmarks: LandmarkArray, mouthIndices: readonly number[]): number {
  const p = mouthIndices.map((i) => landmarks[i]);
  const A = dist(p[2], p[8]);
  const B = dist(p[3], p[7]);
  const C = dist(p[4], p[6]);
  const D = dist(p[0], p[6]);
  if (D === 0) return 0;
  return (A + B + C) / (2 * D);
}

/**
 * Normalized vertical distance between eyebrow and eye center.
 * Positive value means brow is above the eye (raised).
 */
export function eyebrowRaise(landmarks: LandmarkArray): number {
  const eyeY = landmarks[LEFT_EYE_CENTER_IDX].y;
  const browY = landmarks[LEFT_BROW_CENTER_IDX].y;
  return eyeY - browY;
}

/**
 * Gaze score from iris position relative to eye corners.
 * 1.0 = looking straight at camera, 0.0 = looking fully away.
 */
export function gazeScore(
  iris: Landmark,
  cornerLeft: Landmark,
  cornerRight: Landmark,
): number {
  const eyeCenter = mid(cornerLeft, cornerRight);
  const eyeWidth = dist(cornerLeft, cornerRight);
  if (eyeWidth === 0) return 0;
  const irisOffset = dist(iris, eyeCenter);
  const score = 1 - irisOffset / (eyeWidth / 2);
  return Math.min(1, Math.max(0, score));
}

export interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

/**
 * Approximate head pose from Face Landmarker using eye, nose, and face-center
 * reference points. Uses normalized coordinates; angles are in degrees.
 *
 * roll: tilt of the head left/right (from the eye line)
 * yaw:  rotation left/right (from nose vs eye-midline horizontal offset)
 * pitch: vertical tilt (from nose vs mouth-center vertical offset)
 */
export function estimateHeadPose(landmarks: LandmarkArray): HeadPose {
  const leftEye = landmarks[LEFT_EYE_INDICES[3]]; // inner corner
  const rightEye = landmarks[RIGHT_EYE_INDICES[0]]; // outer corner
  const nose = landmarks[1];
  const chin = landmarks[152];

  const eyeLine = { dx: rightEye.x - leftEye.x, dy: rightEye.y - leftEye.y };
  const roll = Math.atan2(eyeLine.dy, eyeLine.dx) * (180 / Math.PI);

  const eyeMid = mid(leftEye, rightEye);
  const noseOffsetX = nose.x - eyeMid.x;
  const noseOffsetY = nose.y - eyeMid.y;
  const yaw = Math.atan2(noseOffsetX, Math.abs(noseOffsetY)) * (180 / Math.PI);

  const chinOffsetY = chin.y - nose.y;
  const pitch = Math.atan2(noseOffsetY - chinOffsetY * 0.5, Math.abs(chinOffsetY)) * (180 / Math.PI);

  return { pitch, yaw, roll };
}

/**
 * Body posture score from Pose Landmarker (0..1). Uses shoulder-line tilt and
 * torso verticality as a proxy for slouching.
 * Pass landmarks keyed by MediaPipe Pose landmark index (0-32).
 */
export function postureScore(poseLandmarks: Record<number, Landmark> | null): number {
  if (!poseLandmarks) return 0.5; // neutral default when pose not visible
  const lShoulder = poseLandmarks[11];
  const rShoulder = poseLandmarks[12];
  const lHip = poseLandmarks[23];
  const rHip = poseLandmarks[24];
  if (!lShoulder || !rShoulder || !lHip || !rHip) return 0.5;

  const shoulderMid = mid(lShoulder, rShoulder);
  const hipMid = mid(lHip, rHip);

  // Verticality: how close the torso vector is to straight vertical.
  const torsoVec = { dx: shoulderMid.x - hipMid.x, dy: shoulderMid.y - hipMid.y };
  const len = Math.sqrt(torsoVec.dx * torsoVec.dx + torsoVec.dy * torsoVec.dy);
  if (len === 0) return 0.5;
  const verticality = Math.abs(torsoVec.dy / len); // 1 = perfectly vertical
  return Math.min(1, Math.max(0, verticality));
}

// ---------------------------------------------------------------
// Confidence aggregation
// ---------------------------------------------------------------

export interface ConfidenceInput {
  avgEar: number;
  mar: number;
  eyebrowRaiseVal: number;
  headPose: HeadPose;
  gaze: number;
}

/**
 * Confidence score 0..100 from facial + gaze metrics.
 * Ported and tuned from the reference's calculate_confidence().
 */
export function calculateConfidence(input: ConfidenceInput): number {
  const { avgEar, mar, eyebrowRaiseVal, headPose, gaze } = input;

  let confidence = 100;

  if (avgEar < 0.21) confidence -= 20; // eyes closed / excessive blinking

  if (
    Math.abs(headPose.pitch) > 30 ||
    Math.abs(headPose.yaw) > 30 ||
    Math.abs(headPose.roll) > 25
  ) {
    confidence -= 20; // not facing the camera
  }

  if (mar > 0.6) confidence += 10; // smiling
  else if (mar < 0.3) confidence -= 10; // tight / neutral lips

  if (eyebrowRaiseVal < 0.02) confidence -= 10; // no expressiveness

  if (gaze < 0.8) confidence -= Math.round((1 - gaze) * 20); // looking away

  return Math.min(100, Math.max(0, confidence));
}
