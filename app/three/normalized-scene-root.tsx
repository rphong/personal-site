import type { ReactNode } from "react";
import { MathUtils } from "three";
import { normalizeSceneRotation } from "./rotation";
import { getSceneDefinition } from "./scene-registry";
import type { SceneId, SceneRotation } from "./types";

export function NormalizedSceneRoot({
  sceneId,
  rotation,
  children,
}: {
  readonly sceneId: SceneId;
  readonly rotation: SceneRotation;
  readonly children: ReactNode;
}) {
  const limits = getSceneDefinition(sceneId).rotation;
  const { pitch, yaw } = normalizeSceneRotation(rotation, limits);

  return (
    <group
      name={`scene-root:${sceneId}`}
      rotation={[
        MathUtils.degToRad(pitch),
        MathUtils.degToRad(yaw),
        0,
        "YXZ",
      ]}
    >
      {children}
    </group>
  );
}
