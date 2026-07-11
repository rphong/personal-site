import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSceneId } from "../three/scene-registry";
import { isSceneCaptureEnabled } from "./capture-policy";
import { SceneCaptureViewport } from "./scene-capture-viewport";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scene capture",
  robots: { index: false, follow: false },
};

interface SceneCapturePageProps {
  readonly searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}

export async function SceneCaptureContent({
  searchParams,
}: SceneCapturePageProps) {
  const parameters = await searchParams;
  const sceneValue = Array.isArray(parameters.scene)
    ? parameters.scene[0]
    : parameters.scene;
  if (!sceneValue || !isSceneId(sceneValue)) notFound();

  return (
    <SceneCaptureViewport
      sceneId={sceneValue}
      scrollTest={parameters.scroll === "1"}
      showControls={parameters.controls === "1"}
    />
  );
}

export default function SceneCapturePage({
  searchParams,
}: SceneCapturePageProps) {
  if (!isSceneCaptureEnabled()) notFound();

  // Vinext 0.0.50 probes the route with an invalid searchParams object. Keep
  // query validation in the nested server component so only the real render
  // can accept or reject the requested registry scene.
  return <SceneCaptureContent searchParams={searchParams} />;
}
