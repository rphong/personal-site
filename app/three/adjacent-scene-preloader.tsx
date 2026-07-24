"use client";

import { useEffect, useRef } from "react";
import {
  acquireSceneModelHostLease,
  clearAllSceneModels,
  preloadSceneModel,
  releaseSceneModelHostLease,
} from "./scene-loader";
import {
  reconcileScenePreloads,
  type ModelCachePort,
} from "./scene-preload-policy";
import { clearPreparedSceneModels } from "./scene-model";
import type { SceneId } from "./types";

const browserModelCache: ModelCachePort = {
  preload: (url) => {
    void preloadSceneModel(url).catch(() => undefined);
  },
};

export function AdjacentScenePreloader({
  activeSceneId,
  enabled,
  ready,
}: {
  readonly activeSceneId: SceneId;
  readonly enabled: boolean;
  readonly ready: boolean;
}) {
  const allowed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      clearAllSceneModels();
      clearPreparedSceneModels();
      allowed.current = new Set();
      return;
    }

    allowed.current = reconcileScenePreloads(
      activeSceneId,
      allowed.current,
      browserModelCache,
      false,
    );
    if (!ready) return;

    const preloadNext = () => {
      allowed.current = reconcileScenePreloads(
        activeSceneId,
        allowed.current,
        browserModelCache,
        true,
      );
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preloadNext, {
        timeout: 1_500,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(preloadNext, 500);
    return () => window.clearTimeout(timeoutId);
  }, [activeSceneId, enabled, ready]);

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
