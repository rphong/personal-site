import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { MathUtils, type Group } from "three";
import { normalizeSceneRotation } from "./rotation";
import { getSceneDefinition } from "./scene-registry";
import type { SceneId, SceneRotation } from "./types";

export function NormalizedSceneRoot({
  sceneId,
  rotation,
  invalidate,
  children,
}: {
  readonly sceneId: SceneId;
  readonly rotation: SceneRotation;
  readonly invalidate: () => void;
  readonly children: ReactNode;
}) {
  const root = useRef<Group>(null);
  const limits = getSceneDefinition(sceneId).rotation;
  const { pitch, yaw } = normalizeSceneRotation(rotation, limits);

  useLayoutEffect(() => {
    if (!root.current) return;
    root.current.rotation.set(
      MathUtils.degToRad(pitch),
      MathUtils.degToRad(yaw),
      0,
      "YXZ",
    );
    invalidate();
  }, [invalidate, pitch, sceneId, yaw]);

  return (
    <group ref={root} name={`scene-root:${sceneId}`}>
      {children}
    </group>
  );
}
