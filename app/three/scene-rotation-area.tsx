"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef } from "react";
import type { PercentInsets } from "./types";

const TOUCH_SLOP_PX = 6;
const INSET_SIDES = ["top", "right", "bottom", "left"] as const;

type TouchIntent = "pending" | "horizontal" | "vertical";

interface ActivePointer {
  readonly id: number;
  readonly type: string;
  readonly startX: number;
  readonly startY: number;
  intent: TouchIntent;
  x: number;
  y: number;
}

type RotationAreaStyle = CSSProperties &
  Record<
    | "--rotation-top"
    | "--rotation-right"
    | "--rotation-bottom"
    | "--rotation-left"
    | "--rotation-mobile-top"
    | "--rotation-mobile-right"
    | "--rotation-mobile-bottom"
    | "--rotation-mobile-left",
    string
  >;

function hasValidInsets(insets: PercentInsets) {
  for (const side of INSET_SIDES) {
    const value = insets[side];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return false;
    }
  }

  return !(
    insets.top + insets.bottom >= 100 ||
    insets.left + insets.right >= 100
  );
}

function percent(value: number) {
  return `${value}%`;
}

function capturePointer(target: HTMLDivElement, pointerId: number) {
  try {
    target.setPointerCapture?.(pointerId);
  } catch {
    // Pointer capture is best effort; native input can still continue in-bounds.
  }
}

function releasePointer(target: HTMLDivElement, pointerId: number) {
  try {
    const ownsCapture = target.hasPointerCapture?.(pointerId) ?? true;
    if (ownsCapture) target.releasePointerCapture?.(pointerId);
  } catch {
    // A browser may implicitly release capture before cancel/up is delivered.
  }
}

export function SceneRotationArea({
  desktop,
  mobile,
  onDelta,
}: {
  readonly desktop: PercentInsets;
  readonly mobile: PercentInsets;
  readonly onDelta: (
    deltaX: number,
    deltaY: number,
    allowPitch: boolean,
  ) => void;
}) {
  const active = useRef<ActivePointer | null>(null);
  const validInsets = hasValidInsets(desktop) && hasValidInsets(mobile);
  useEffect(() => {
    if (!validInsets) active.current = null;
  }, [validInsets]);
  if (!validInsets) return null;

  const style: RotationAreaStyle = {
    touchAction: "pan-y pinch-zoom",
    "--rotation-top": percent(desktop.top),
    "--rotation-right": percent(desktop.right),
    "--rotation-bottom": percent(desktop.bottom),
    "--rotation-left": percent(desktop.left),
    "--rotation-mobile-top": percent(mobile.top),
    "--rotation-mobile-right": percent(mobile.right),
    "--rotation-mobile-bottom": percent(mobile.bottom),
    "--rotation-mobile-left": percent(mobile.left),
  };

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (
      active.current ||
      !event.isPrimary ||
      !Number.isFinite(event.pointerId) ||
      !Number.isFinite(event.clientX) ||
      !Number.isFinite(event.clientY)
    ) {
      return;
    }
    if (event.pointerType !== "touch" && event.button !== 0) return;

    active.current = {
      id: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      intent: event.pointerType === "touch" ? "pending" : "horizontal",
      x: event.clientX,
      y: event.clientY,
    };
    capturePointer(event.currentTarget, event.pointerId);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = active.current;
    if (
      !pointer ||
      pointer.id !== event.pointerId ||
      !Number.isFinite(event.clientX) ||
      !Number.isFinite(event.clientY)
    ) {
      return;
    }

    if (pointer.type !== "touch") {
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (deltaX !== 0 || deltaY !== 0) onDelta(deltaX, deltaY, true);
      return;
    }

    if (pointer.intent === "vertical") return;
    if (pointer.intent === "pending") {
      const totalX = event.clientX - pointer.startX;
      const totalY = event.clientY - pointer.startY;
      if (!Number.isFinite(totalX) || !Number.isFinite(totalY)) return;
      if (Math.max(Math.abs(totalX), Math.abs(totalY)) < TOUCH_SLOP_PX) {
        return;
      }
      if (Math.abs(totalY) >= Math.abs(totalX)) {
        pointer.intent = "vertical";
        return;
      }

      pointer.intent = "horizontal";
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (totalX !== 0) onDelta(totalX, 0, false);
      return;
    }

    const deltaX = event.clientX - pointer.x;
    if (!Number.isFinite(deltaX)) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (deltaX !== 0) onDelta(deltaX, 0, false);
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current?.id !== event.pointerId) return;
    active.current = null;
    releasePointer(event.currentTarget, event.pointerId);
  };

  const loseCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current?.id === event.pointerId) active.current = null;
  };

  return (
    <div
      aria-hidden="true"
      className="scene-runtime__rotation-area"
      data-testid="scene-rotation-area"
      style={style}
      onLostPointerCapture={loseCapture}
      onPointerCancel={end}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
    />
  );
}
