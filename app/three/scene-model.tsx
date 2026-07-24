"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import {
  AnimationClip,
  AnimationMixer,
  Group,
  LoopOnce,
  type Object3D,
} from "three";
import { NormalizedSceneRoot } from "./normalized-scene-root";
import { useSceneGltf } from "./scene-loader";
import { cloneRuntimeScene, disposeRuntimeScene } from "./scene-resources";
import type { LiveSceneDefinition, SceneId, SceneRotation } from "./types";

interface SceneGltfSource {
  readonly scene: Group;
  readonly animations: readonly AnimationClip[];
}

interface PreparedSceneModel {
  readonly definition: LiveSceneDefinition;
  readonly source: Group;
  readonly runtimeScene: Group;
  readonly mixer: AnimationMixer | null;
}

interface RuntimeSceneAttachment {
  readonly runtimeScene: Group;
  readonly temporary: boolean;
}

const preparedSceneModels = new Map<SceneId, PreparedSceneModel>();

export function applyStaticScenePose(
  root: Object3D,
  animations: readonly AnimationClip[],
  pose: NonNullable<LiveSceneDefinition["staticPose"]>,
): AnimationMixer {
  const clips = new Map(animations.map((clip) => [clip.name, clip]));
  const requested = new Set<string>();
  for (const { name, timeSeconds } of pose.clips) {
    if (requested.has(name)) {
      throw new Error(`Static scene pose clip is duplicated: ${name}`);
    }
    requested.add(name);
    const clip = clips.get(name);
    if (
      clip &&
      (!Number.isFinite(timeSeconds) ||
        timeSeconds < 0 ||
        timeSeconds > clip.duration)
    ) {
      throw new Error(`Static scene pose time is outside ${name}`);
    }
  }
  const missing = pose.clips
    .map(({ name }) => name)
    .filter((name) => !clips.has(name));
  if (missing.length > 0) {
    throw new Error(`Static scene pose clips are missing: ${missing.join(", ")}`);
  }

  const mixer = new AnimationMixer(root);
  const actions = pose.clips.map(({ name, timeSeconds }) => {
    const action = mixer.clipAction(clips.get(name)!);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.time = timeSeconds;
    return action;
  });
  mixer.update(0);
  for (const action of actions) action.paused = true;
  root.updateMatrixWorld(true);
  return mixer;
}

function disposePreparedSceneModel(prepared: PreparedSceneModel) {
  prepared.mixer?.stopAllAction();
  prepared.mixer?.uncacheRoot(prepared.runtimeScene);
  disposeRuntimeScene(prepared.runtimeScene);
}

export function prepareSceneModel(
  definition: LiveSceneDefinition,
  gltf: SceneGltfSource,
): Group {
  const existing = preparedSceneModels.get(definition.id);
  if (
    existing?.definition === definition &&
    existing.source === gltf.scene
  ) {
    return existing.runtimeScene;
  }
  if (existing) disposePreparedSceneModel(existing);

  const runtimeScene = cloneRuntimeScene(gltf.scene);
  const mixer = definition.staticPose
    ? applyStaticScenePose(
        runtimeScene,
        gltf.animations,
        definition.staticPose,
      )
    : null;
  preparedSceneModels.set(definition.id, {
    definition,
    source: gltf.scene,
    runtimeScene,
    mixer,
  });
  return runtimeScene;
}

export function clearPreparedSceneModels() {
  for (const sceneId of [...preparedSceneModels.keys()]) {
    clearPreparedSceneModel(sceneId);
  }
}

export function clearPreparedSceneModel(sceneId: SceneId) {
  const prepared = preparedSceneModels.get(sceneId);
  if (!prepared) return;
  preparedSceneModels.delete(sceneId);
  disposePreparedSceneModel(prepared);
}

function createRuntimeSceneAttachment(
  preparedRuntimeScene: Group,
): RuntimeSceneAttachment {
  if (!preparedRuntimeScene.parent) {
    return { runtimeScene: preparedRuntimeScene, temporary: false };
  }
  return {
    runtimeScene: cloneRuntimeScene(preparedRuntimeScene),
    temporary: true,
  };
}

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
    const preparedRuntimeScene = prepareSceneModel(scene, gltf);
    const { runtimeScene, temporary } =
      createRuntimeSceneAttachment(preparedRuntimeScene);
    parent.add(runtimeScene);
    invalidate();
    return () => {
      parent.remove(runtimeScene);
      if (temporary) disposeRuntimeScene(runtimeScene);
      invalidate();
    };
  }, [gltf, invalidate, scene]);

  return (
    <NormalizedSceneRoot
      sceneId={scene.id}
      rotation={rotation}
      transform={scene.modelTransform}
    >
      <group ref={attachment} name={`scene-instance:${scene.id}`} />
    </NormalizedSceneRoot>
  );
}
