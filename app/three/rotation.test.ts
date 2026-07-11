import { describe, expect, it } from "vitest";
import {
  applyRotationDelta,
  normalizeSceneRotation,
  resetSceneRotation,
} from "./rotation";
import type { RotationLimits } from "./types";

const limits: RotationLimits = {
  yaw: [-25, 25],
  pitch: [-8, 8],
  default: { yaw: 3, pitch: -2 },
  degreesPerPixel: 0.2,
};

describe("scene rotation policy", () => {
  it("converts pointer pixels to bounded yaw and pitch degrees", () => {
    expect(
      applyRotationDelta(
        { yaw: 0, pitch: 0 },
        { deltaX: 200, deltaY: -100, allowPitch: true },
        limits,
      ),
    ).toEqual({ yaw: 25, pitch: -8 });
  });

  it("ignores vertical touch deltas when pitch is not allowed", () => {
    expect(
      applyRotationDelta(
        { yaw: 5, pitch: 4 },
        { deltaX: -20, deltaY: 200, allowPitch: false },
        limits,
      ),
    ).toEqual({ yaw: 1, pitch: 4 });
  });

  it("returns a fresh copy of the registered default pose", () => {
    const rotation = resetSceneRotation(limits);
    expect(rotation).toEqual({ yaw: 3, pitch: -2 });
    expect(rotation).not.toBe(limits.default);
  });

  it("normalizes each axis independently at a rendering boundary", () => {
    expect(
      normalizeSceneRotation(
        { yaw: Number.NaN, pitch: 99 },
        limits,
      ),
    ).toEqual({ yaw: 3, pitch: 8 });
  });

  it("keeps fractional movement precise without mutating its inputs", () => {
    const current = { yaw: 1, pitch: 2 };
    const delta = { deltaX: 1.5, deltaY: -2.25, allowPitch: true };

    const rotation = applyRotationDelta(current, delta, limits);

    expect(rotation.yaw).toBeCloseTo(1.3);
    expect(rotation.pitch).toBeCloseTo(1.55);
    expect(rotation).not.toBe(current);
    expect(current).toEqual({ yaw: 1, pitch: 2 });
    expect(delta).toEqual({ deltaX: 1.5, deltaY: -2.25, allowPitch: true });
  });

  it("sanitizes non-finite input and clamps pitch even when pitch input is off", () => {
    expect(
      applyRotationDelta(
        { yaw: Number.NaN, pitch: 99 },
        {
          deltaX: Number.POSITIVE_INFINITY,
          deltaY: Number.NaN,
          allowPitch: false,
        },
        limits,
      ),
    ).toEqual({ yaw: 3, pitch: 8 });
  });

  it.each([
    { ...limits, yaw: [25, -25] as const },
    { ...limits, pitch: [Number.NEGATIVE_INFINITY, 8] as const },
    { ...limits, degreesPerPixel: 0 },
    { ...limits, degreesPerPixel: Number.NaN },
    { ...limits, default: { yaw: 30, pitch: 0 } },
  ] satisfies readonly RotationLimits[])(
    "rejects an invalid registered rotation contract",
    (invalidLimits) => {
      expect(() => resetSceneRotation(invalidLimits)).toThrow(
        /Invalid rotation limits/,
      );
      expect(() =>
        applyRotationDelta(
          { yaw: 0, pitch: 0 },
          { deltaX: 1, deltaY: 1, allowPitch: true },
          invalidLimits,
        ),
      ).toThrow(/Invalid rotation limits/);
    },
  );
});
