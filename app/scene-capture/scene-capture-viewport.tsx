"use client";

import Link from "next/link";
import { getSceneDefinition } from "../three/scene-registry";
import { SceneSection } from "../three/scene-section";
import type { SceneId } from "../three/types";

export function SceneCaptureViewport({
  sceneId,
  scrollTest,
  showControls,
}: {
  readonly sceneId: SceneId;
  readonly scrollTest: boolean;
  readonly showControls: boolean;
}) {
  const scene = getSceneDefinition(sceneId);
  const nextSceneId = scene.nextSceneId ?? "home-hero";

  return (
    <main
      className="scene-capture-root"
      data-capture-controls={showControls ? "true" : "false"}
      data-scroll-test={scrollTest ? "true" : "false"}
    >
      <SceneSection
        className="scene-capture-viewport"
        forceActive
        sceneId={sceneId}
      >
        <h1 className="scene-capture-title">{scene.label}</h1>
      </SceneSection>
      {scrollTest ? (
        <div aria-hidden="true" className="scene-capture-scroll-space" />
      ) : null}
      <Link
        className="scene-capture-next"
        data-testid="capture-next-scene"
        href={`/scene-capture?scene=${nextSceneId}&controls=1`}
        scroll={false}
      >
        Next scene
      </Link>
    </main>
  );
}
