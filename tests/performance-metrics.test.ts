import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_BUDGETS,
  calculateCumulativeLayoutShift,
  calculateTotalBlockingTime,
} from "./browser/performance-metrics";

describe("production performance metrics", () => {
  it("locks the good Web Vitals and bounded main-thread budgets", () => {
    expect(PERFORMANCE_BUDGETS).toEqual({
      cumulativeLayoutShift: 0.1,
      interactionToNextPaintMs: 200,
      largestContentfulPaintMs: 2_500,
      longestTaskMs: 250,
      settledIdleWindowMs: 500,
      totalBlockingTimeMs: 200,
    });
  });

  it("uses the CLS session-window algorithm and ignores recent input", () => {
    expect(
      calculateCumulativeLayoutShift([
        { hadRecentInput: false, startTime: 100, value: 0.03 },
        { hadRecentInput: false, startTime: 500, value: 0.04 },
        { hadRecentInput: false, startTime: 1_400, value: 0.02 },
        { hadRecentInput: true, startTime: 1_500, value: 0.8 },
        { hadRecentInput: false, startTime: 2_600, value: 0.08 },
      ]),
    ).toBeCloseTo(0.09, 8);
  });

  it("counts only the over-50ms portion of long tasks inside the window", () => {
    expect(
      calculateTotalBlockingTime(
        [
          { duration: 40, startTime: 10 },
          { duration: 90, startTime: 60 },
          { duration: 100, startTime: 180 },
          { duration: 90, startTime: 400 },
        ],
        { endTime: 240, startTime: 0 },
      ),
    ).toBe(50);
  });

  it("retains blocking time when the measurement begins inside a long task", () => {
    expect(
      calculateTotalBlockingTime(
        [{ duration: 120, startTime: 20 }],
        { endTime: 120, startTime: 90 },
      ),
    ).toBe(30);
  });
});
