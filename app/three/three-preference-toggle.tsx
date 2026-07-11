"use client";

import { useSceneRuntime } from "./scene-runtime-context";

export function ThreePreferenceToggle() {
  const runtime = useSceneRuntime();
  const unavailable = !runtime.threeInitialized || !runtime.threeSupported;
  const label = !runtime.threeInitialized
    ? "3D loading"
    : !runtime.threeSupported
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
