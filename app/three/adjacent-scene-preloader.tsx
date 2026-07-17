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

const browserModelCache: ModelCachePort = {
  preload: (url) => {
    void preloadSceneModel(url)
      .then((gltf) => {
        for (const scene of LIVE_SCENES) {
          if (scene.modelUrl === url) prepareSceneModel(scene, gltf);
        }
      })
      .catch(() => undefined);
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
