"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { Group } from "three";
import { NormalizedSceneRoot } from "./normalized-scene-root";
import { useSceneGltf } from "./scene-loader";
import { cloneRuntimeScene, disposeRuntimeScene } from "./scene-resources";
import type { LiveSceneDefinition, SceneRotation } from "./types";

export function SceneModel({
  attemptKey,
  scene,
  rotation,
}: {
  readonly attemptKey: string;
  readonly scene: LiveSceneDefinition;
  readonly rotation: SceneRotation;
}) {
  const gltf = useSceneGltf(scene.modelUrl, attemptKey);
  const attachment = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const parent = attachment.current;
    if (!parent) return;
    const runtimeScene = cloneRuntimeScene(gltf.scene);
    parent.add(runtimeScene);
    invalidate();
    return () => {
      parent.remove(runtimeScene);
      disposeRuntimeScene(runtimeScene);
      invalidate();
    };
  }, [gltf.scene, invalidate]);

  return (
    <NormalizedSceneRoot
      sceneId={scene.id}
      rotation={rotation}
      invalidate={invalidate}
    >
      <group ref={attachment} name={`scene-instance:${scene.id}`} />
    </NormalizedSceneRoot>
  );
}
