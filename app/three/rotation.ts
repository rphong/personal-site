import type { RotationLimits, SceneRotation } from "./types";

export interface RotationDelta {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly allowPitch: boolean;
}

function clamp(value: number, [minimum, maximum]: readonly [number, number]) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validRange(range: readonly [number, number]): boolean {
  return (
    Number.isFinite(range[0]) &&
    Number.isFinite(range[1]) &&
    range[0] <= range[1]
  );
}

function assertValidLimits(limits: RotationLimits): void {
  const valid =
    validRange(limits.yaw) &&
    validRange(limits.pitch) &&
    Number.isFinite(limits.degreesPerPixel) &&
    limits.degreesPerPixel > 0 &&
    Number.isFinite(limits.default.yaw) &&
    Number.isFinite(limits.default.pitch) &&
    limits.default.yaw >= limits.yaw[0] &&
    limits.default.yaw <= limits.yaw[1] &&
    limits.default.pitch >= limits.pitch[0] &&
    limits.default.pitch <= limits.pitch[1];
  if (!valid) throw new RangeError("Invalid rotation limits");
}

function safeCurrent(
  value: number,
  fallback: number,
  range: readonly [number, number],
): number {
  return clamp(Number.isFinite(value) ? value : fallback, range);
}

function safeDelta(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function applyRotationDelta(
  current: SceneRotation,
  delta: RotationDelta,
  limits: RotationLimits,
): SceneRotation {
  const { yaw, pitch } = normalizeSceneRotation(current, limits);
  return {
    yaw: clamp(
      yaw + safeDelta(delta.deltaX) * limits.degreesPerPixel,
      limits.yaw,
    ),
    pitch: delta.allowPitch
      ? clamp(
          pitch + safeDelta(delta.deltaY) * limits.degreesPerPixel,
          limits.pitch,
        )
      : pitch,
  };
}

export function normalizeSceneRotation(
  current: SceneRotation,
  limits: RotationLimits,
): SceneRotation {
  assertValidLimits(limits);
  return {
    yaw: safeCurrent(current.yaw, limits.default.yaw, limits.yaw),
    pitch: safeCurrent(current.pitch, limits.default.pitch, limits.pitch),
  };
}

export function resetSceneRotation(limits: RotationLimits): SceneRotation {
  assertValidLimits(limits);
  return { ...limits.default };
}
