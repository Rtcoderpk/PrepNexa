import { describe, expect, it } from "vitest";
import { aggregateVision, toVisionMetricsData, type VisionSample } from "@/lib/vision/aggregation";

function sample(partial: Partial<VisionSample>): VisionSample {
  return {
    frame: 0,
    eyeContact: true,
    blink: false,
    confidence: 80,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    smile: false,
    posture: 0.8,
    timestampMs: 0,
    ...partial,
  };
}

describe("aggregateVision", () => {
  it("returns zeroed aggregate for no samples", () => {
    const agg = aggregateVision([]);
    expect(agg.sampleCount).toBe(0);
    expect(agg.eyeContactPct).toBe(0);
    expect(agg.blinkCount).toBe(0);
    expect(agg.durationSec).toBe(0);
  });

  it("computes percentages and averages from samples", () => {
    const agg = aggregateVision([
      sample({ eyeContact: true, confidence: 100, smile: true, posture: 1 }),
      sample({ eyeContact: true, confidence: 80, smile: false, posture: 0.8 }),
      sample({ eyeContact: false, confidence: 60, smile: false, posture: 0.6 }),
    ]);

    expect(agg.sampleCount).toBe(3);
    expect(agg.eyeContactPct).toBeCloseTo(66.7, 0);
    expect(agg.avgConfidence).toBeCloseTo(80, 0);
    expect(agg.smilePct).toBeCloseTo(33.3, 0);
    expect(agg.postureScore).toBeCloseTo(0.8, 1);
  });

  it("drives eye-contact from the gaze boolean, not confidence (regression)", () => {
    // Low confidence but engaged gaze → still counted as eye contact.
    const agg = aggregateVision([
      sample({ eyeContact: true, confidence: 10 }),
      sample({ eyeContact: false, confidence: 90 }),
    ]);
    expect(agg.eyeContactPct).toBe(50);
  });

  it("collapses consecutive blinks within cooldown into one", () => {
    // 3 blink frames but spaced < 120ms apart → count as 1 blink.
    const agg = aggregateVision([
      sample({ blink: true, timestampMs: 0 }),
      sample({ blink: true, timestampMs: 30 }),
      sample({ blink: true, timestampMs: 60 }),
    ]);
    expect(agg.blinkCount).toBe(1);
  });

  it("counts blinks separated beyond cooldown separately", () => {
    const agg = aggregateVision([
      sample({ blink: true, timestampMs: 0 }),
      sample({ blink: true, timestampMs: 200 }),
    ]);
    expect(agg.blinkCount).toBe(2);
  });

  it("computes blink rate per minute", () => {
    const agg = aggregateVision([
      sample({ blink: true, timestampMs: 0 }),
      sample({ blink: true, timestampMs: 5000 }),
    ]);
    // 2 blinks over 5s → 24 blinks/min
    expect(agg.blinkRatePerMin).toBeCloseTo(24, 0);
  });
});

describe("toVisionMetricsData", () => {
  it("maps aggregate to DB shape with confidence samples", () => {
    const data = toVisionMetricsData(aggregateVision([sample({})]));
    expect(data.sampleCount).toBe(1);
    expect(data.confidenceSamples).toBe(1);
    expect(data.eyeContactPct).toBe(100);
  });
});
