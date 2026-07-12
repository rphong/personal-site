"use client";

import { useSceneRuntime } from "./scene-runtime-context";

export function ThreePreferenceToggle() {
  const runtime = useSceneRuntime();
  if (!runtime.threeInitialized) return null;

  const unavailable = !runtime.threeSupported;
  const label = !runtime.threeSupported
    ? "3D unavailable"
    : runtime.threeEnabled
      ? "3D on"
      : "3D off";

  return (
    <button
      type="button"
      className="three-preference-toggle"
      aria-label={label}
      aria-pressed={runtime.threeEnabled}
      disabled={unavailable}
      onClick={() => runtime.setThreeEnabled(!runtime.threeEnabled)}
    >
      {label}
    </button>
  );
}
