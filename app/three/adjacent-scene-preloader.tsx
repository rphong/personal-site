"use client";

import { useEffect, useRef } from "react";
import { SCENE_DEFINITIONS } from "./scene-registry";
import {
  acquireSceneModelHostLease,
  clearSceneModel,
  preloadSceneModel,
  releaseSceneModelHostLease,
} from "./scene-loader";
import {
  reconcileScenePreloads,
  type ModelCachePort,
} from "./scene-preload-policy";
import {
  clearPreparedSceneModels,
  prepareSceneModel,
} from "./scene-model";
import type { SceneId } from "./types";

const LIVE_SCENES = Object.values(SCENE_DEFINITIONS).filter(
  (scene) => scene.requiredLive,
);
const LIVE_SCENE_MODEL_URLS = [
  ...new Set(LIVE_SCENES.map((scene) => scene.modelUrl)),
];

async function preloadAndPrepareSceneModel(url: string) {
  const gltf = await preloadSceneModel(url);
  for (const scene of LIVE_SCENES) {
    if (scene.modelUrl === url) prepareSceneModel(scene, gltf);
  }
}

export async function warmLiveSceneModels(): Promise<void> {
  await Promise.allSettled(
    LIVE_SCENE_MODEL_URLS.map(preloadAndPrepareSceneModel),
  );
}

const browserModelCache: ModelCachePort = {
  preload: (url) => {
    void preloadAndPrepareSceneModel(url).catch(() => undefined);
  },
  clear: clearSceneModel,
};

export function AdjacentScenePreloader({
  activeSceneId,
  enabled,
}: {
  readonly activeSceneId: SceneId;
  readonly enabled: boolean;
  readonly ready: boolean;
}) {
  const allowed = useRef<Set<string>>(new Set());

  useEffect(() => {
    allowed.current = reconcileScenePreloads(
      enabled ? activeSceneId : null,
      allowed.current,
      browserModelCache,
      enabled ? LIVE_SCENE_MODEL_URLS : [],
    );
    if (!enabled) clearPreparedSceneModels();
  }, [activeSceneId, enabled]);

  useEffect(() => {
    const lease = acquireSceneModelHostLease();
    return () => {
      queueMicrotask(() => {
        if (!releaseSceneModelHostLease(lease)) return;
        clearPreparedSceneModels();
        allowed.current = new Set();
      });
    };
  }, []);

  return null;
}
