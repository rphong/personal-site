import type { ReactNode } from "react";
import { MathUtils } from "three";
import { normalizeSceneRotation } from "./rotation";
import { getSceneDefinition } from "./scene-registry";
import type {
  SceneId,
  SceneModelTransform,
  SceneRotation,
} from "./types";

const IDENTITY_TRANSFORM: SceneModelTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

export function NormalizedSceneRoot({
  sceneId,
  rotation,
  transform = IDENTITY_TRANSFORM,
  children,
}: {
  readonly sceneId: SceneId;
  readonly rotation: SceneRotation;
  readonly transform?: SceneModelTransform;
  readonly children: ReactNode;
}) {
  const limits = getSceneDefinition(sceneId).rotation;
  const { pitch, yaw } = normalizeSceneRotation(rotation, limits);

  return (
    <group
      name={`scene-root:${sceneId}`}
      position={transform.position}
      rotation={[
        MathUtils.degToRad(pitch + transform.rotation[0]),
        MathUtils.degToRad(yaw + transform.rotation[1]),
        MathUtils.degToRad(transform.rotation[2]),
        "YXZ",
      ]}
      scale={transform.scale}
    >
      {children}
    </group>
  );
}
