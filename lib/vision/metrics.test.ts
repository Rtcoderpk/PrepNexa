import { describe, expect, it } from "vitest";
import {
  calculateConfidence,
  estimateHeadPose,
  eyeAspectRatio,
  gazeScore,
  mouthAspectRatio,
  postureScore,
  type Landmark,
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

/** Builds a landmark array of the given length, filling any index with a base value. */
function buildLandmarks(
  points: Partial<Record<number, Landmark>>,
  length = 478,
): LandmarkArray {
  return Array.from({ length }, (_, i) => points[i] ?? { x: 0.5, y: 0.5, z: 0 });
}

/** Builds a set of eye landmarks forming a known rectangle for EAR computation. */
function eyeRect(w: number, h: number, cx = 0.5, cy = 0.5): LandmarkArray {
  const pts: Partial<Record<number, Landmark>> = {};
  // LEFT_EYE_INDICES corners: [33=left, 160/158=top, 133=right, 153/144=bottom]
  pts[LEFT_EYE_INDICES[0]] = { x: cx - w / 2, y: cy, z: 0 }; // left corner
  pts[LEFT_EYE_INDICES[3]] = { x: cx + w / 2, y: cy, z: 0 }; // right corner
  pts[LEFT_EYE_INDICES[1]] = { x: cx, y: cy - h / 2, z: 0 }; // upper inner
  pts[LEFT_EYE_INDICES[2]] = { x: cx, y: cy - h / 2, z: 0 }; // upper outer
  pts[LEFT_EYE_INDICES[4]] = { x: cx, y: cy + h / 2, z: 0 }; // lower inner
  pts[LEFT_EYE_INDICES[5]] = { x: cx, y: cy + h / 2, z: 0 }; // lower outer
  return buildLandmarks(pts);
}

describe("eyeAspectRatio", () => {
  it("returns 0 for zero-width eye (C = 0)", () => {
    const lm = buildLandmarks({
      [LEFT_EYE_INDICES[0]]: { x: 0.5, y: 0.5, z: 0 },
      [LEFT_EYE_INDICES[3]]: { x: 0.5, y: 0.5, z: 0 },
    });
    expect(eyeAspectRatio(lm, LEFT_EYE_INDICES)).toBe(0);
  });

  it("returns ~1 for a square eye (A+B ~ 2C)", () => {
    const lm = eyeRect(0.2, 0.2);
    // For a square of side 0.2: A=B=C=0.2 → EAR = (0.2+0.2)/(2*0.2) = 1
    expect(eyeAspectRatio(lm, LEFT_EYE_INDICES)).toBeCloseTo(1, 2);
  });
});

describe("mouthAspectRatio", () => {
  it("returns 0 when denominator is zero", () => {
    const lm = buildLandmarks({ [MOUTH_INDICES[0]]: { x: 0.5, y: 0.5, z: 0 } });
    expect(mouthAspectRatio(lm, MOUTH_INDICES)).toBe(0);
  });

  it("returns positive ratio for an open mouth", () => {
    // Spread mouth corners horizontally, top/bottom lips vertically.
    const lm = buildLandmarks({
      [MOUTH_INDICES[0]]: { x: 0.4, y: 0.5, z: 0 }, // left corner
      [MOUTH_INDICES[4]]: { x: 0.6, y: 0.5, z: 0 }, // right corner
      [MOUTH_INDICES[1]]: { x: 0.5, y: 0.46, z: 0 }, // upper
      [MOUTH_INDICES[5]]: { x: 0.5, y: 0.54, z: 0 }, // lower
    });
    expect(mouthAspectRatio(lm, MOUTH_INDICES)).toBeGreaterThan(0);
  });
});

describe("gazeScore", () => {
  const left = { x: 0.3, y: 0.5, z: 0 };
  const right = { x: 0.7, y: 0.5, z: 0 };

  it("returns 1 when iris is at eye center (looking straight)", () => {
    expect(gazeScore({ x: 0.5, y: 0.5, z: 0 }, left, right)).toBe(1);
  });

  it("returns 0 when iris is at an extreme corner", () => {
    expect(gazeScore({ x: 0.3, y: 0.5, z: 0 }, left, right)).toBe(0);
  });

  it("clamps to [0,1]", () => {
    expect(gazeScore({ x: 0.2, y: 0.5, z: 0 }, left, right)).toBe(0);
    expect(gazeScore({ x: 0.5, y: 0.5, z: 0 }, left, right)).toBe(1);
  });
});

describe("estimateHeadPose", () => {
  it("returns ~0 angles for a frontal face", () => {
    const lm = buildLandmarks({
      [LEFT_EYE_INDICES[3]]: { x: 0.4, y: 0.4, z: 0 }, // inner left eye
      [RIGHT_EYE_INDICES[0]]: { x: 0.6, y: 0.4, z: 0 }, // outer right eye
      1: { x: 0.5, y: 0.5, z: 0 }, // nose
      152: { x: 0.5, y: 0.6, z: 0 }, // chin
    });
    const pose = estimateHeadPose(lm);
    expect(pose.roll).toBeCloseTo(0, 1);
    expect(pose.yaw).toBeCloseTo(0, 1);
  });

  it("reports nonzero roll when the head is tilted", () => {
    const lm = buildLandmarks({
      [LEFT_EYE_INDICES[3]]: { x: 0.4, y: 0.5, z: 0 },
      [RIGHT_EYE_INDICES[0]]: { x: 0.6, y: 0.3, z: 0 },
      1: { x: 0.5, y: 0.45, z: 0 },
      152: { x: 0.5, y: 0.6, z: 0 },
    });
    const pose = estimateHeadPose(lm);
    expect(Math.abs(pose.roll)).toBeGreaterThan(0);
  });
});

describe("postureScore", () => {
  it("returns neutral 0.5 when landmarks are missing", () => {
    expect(postureScore(null)).toBe(0.5);
    expect(postureScore({})).toBe(0.5);
  });

  it("returns ~1 for a vertical torso", () => {
    const lm = {
      11: { x: 0.45, y: 0.3, z: 0 }, // left shoulder
      12: { x: 0.55, y: 0.3, z: 0 }, // right shoulder
      23: { x: 0.45, y: 0.7, z: 0 }, // left hip
      24: { x: 0.55, y: 0.7, z: 0 }, // right hip
    };
    // Torso is vertical → verticality = 1
    expect(postureScore(lm)).toBeCloseTo(1, 1);
  });
});

describe("calculateConfidence", () => {
  const neutral = {
    avgEar: 0.3,
    mar: 0.45,
    eyebrowRaiseVal: 0.1,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    gaze: 1,
  };

  it("starts near 100 for neutral confident cues", () => {
    expect(calculateConfidence(neutral)).toBeGreaterThan(90);
  });

  it("penalizes closed eyes", () => {
    const low = calculateConfidence({ ...neutral, avgEar: 0.1 });
    expect(low).toBeLessThan(calculateConfidence(neutral));
  });

  it("penalizes looking away", () => {
    const low = calculateConfidence({ ...neutral, gaze: 0.5 });
    expect(low).toBeLessThan(calculateConfidence(neutral));
  });

  it("clamps to [0, 100]", () => {
    expect(calculateConfidence(neutral)).toBeLessThanOrEqual(100);
    expect(calculateConfidence({ ...neutral, avgEar: 0.1, gaze: 0, eyebrowRaiseVal: 0 })).toBeGreaterThanOrEqual(0);
  });
});

// Reference the iris indices so the import is used (gaze tests use raw coords).
describe("iris landmark indices are present", () => {
  it("has iris indices within a 478-landmark array", () => {
    const lm = buildLandmarks({});
    expect(lm[LEFT_IRIS_IDX]).toBeDefined();
    expect(lm[RIGHT_IRIS_IDX]).toBeDefined();
  });
});
