"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { getSceneDefinition } from "../three/scene-registry";
import { SceneSection } from "../three/scene-section";
import type { SceneId, SiteRoute } from "../three/types";

const CAPTURE_BACKGROUND_SCENE_BY_ROUTE = {
  "/": "home-hero",
  "/experience": "experience-hero",
  "/projects": "projects-hero",
  "/contact": "contact-hero",
} as const satisfies Record<SiteRoute, SceneId>;

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
  const captureBackground = getSceneDefinition(
    CAPTURE_BACKGROUND_SCENE_BY_ROUTE[scene.route],
  ).background;

  return (
    <main
      className="scene-capture-root"
      data-capture-controls={showControls ? "true" : "false"}
      data-scroll-test={scrollTest ? "true" : "false"}
      style={
        {
          "--route-background": captureBackground,
          background: captureBackground,
        } as CSSProperties
      }
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
