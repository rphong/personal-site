"use client";

import { lazy, Suspense } from "react";
import type { SceneCanvasPortProps } from "./scene-canvas";

const LazySceneCanvas = lazy(() =>
  import("./scene-canvas").then((module) => ({
    default: module.SceneCanvas,
  })),
);

export function SceneCanvasBoundary(props: SceneCanvasPortProps) {
  return (
    <Suspense fallback={null}>
      <LazySceneCanvas {...props} />
    </Suspense>
  );
}
