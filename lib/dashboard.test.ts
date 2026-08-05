import { describe, expect, it } from "vitest";
import { average, buildSeries, intervalStart } from "@/lib/dashboard";

describe("average", () => {
  it("returns null for empty / all-null values", () => {
    expect(average([])).toBeNull();
    expect(average([null, null])).toBeNull();
  });

  it("averages present values, ignoring nulls", () => {
    expect(average([8, 9, 10])).toBe(9);
    expect(average([8, null, 10])).toBe(9);
  });

  it("rounds to one decimal place", () => {
    expect(average([8, 9])).toBe(8.5);
    expect(average([8, 9, 10, 8])).toBe(8.8);
  });
});

describe("intervalStart", () => {
  it("snaps a week to Monday", () => {
    // 2026-08-05 is a Wednesday. Interval math is local-time, so assert on the
    // local calendar date, which must be a Monday (day 1).
    const start = intervalStart("2026-08-05T10:00:00", "week");
    expect(start.getDay()).toBe(1); // Monday
  });

  it("snaps a month to the 1st", () => {
    const start = intervalStart("2026-08-15T10:00:00", "month");
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(7); // August
  });
});

describe("buildSeries", () => {
  // Fixed "now" so bucket math is deterministic regardless of wall clock.
  const now = new Date(2026, 7, 5, 12, 0, 0); // 2026-08-05 local

  it("produces a contiguous series of the requested bucket count", () => {
    const series = buildSeries([], "week", 3, now);
    expect(series).toHaveLength(3);
    expect(series.every((b) => b.interviews === 0)).toBe(true);
  });

  it("groups interviews into their week buckets and averages scores", () => {
    const rows = [
      { created_at: "2026-08-04T10:00:00", overall_score: 7 }, // week of now
      { created_at: "2026-08-03T10:00:00", overall_score: 8 }, // week of now
      { created_at: "2026-07-30T10:00:00", overall_score: 6 }, // previous week
    ];
    const series = buildSeries(rows, "week", 2, now);
    // Most recent bucket holds the two August interviews.
    expect(series[1].interviews).toBe(2);
    expect(series[1].averageScore).toBe(7.5);
    // Older bucket holds the July interview.
    expect(series[0].interviews).toBe(1);
    expect(series[0].averageScore).toBe(6);
  });

  it("computes average score per month bucket, ignoring null scores", () => {
    const series = buildSeries(
      [
        { created_at: "2026-07-01T10:00:00", overall_score: 6 },
        { created_at: "2026-07-15T10:00:00", overall_score: null },
        { created_at: "2026-07-16T10:00:00", overall_score: 10 },
        { created_at: "2026-08-02T10:00:00", overall_score: 9 },
      ],
      "month",
      2,
      now,
    );
    // First bucket = July (3 rows), avg of 6 and 10 = 8.
    expect(series[0].averageScore).toBe(8);
    expect(series[0].interviews).toBe(3);
    // Second bucket = August (1 row).
    expect(series[1].interviews).toBe(1);
    expect(series[1].averageScore).toBe(9);
  });
});
