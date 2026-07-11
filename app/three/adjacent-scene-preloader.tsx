"use client";

import { useEffect, useRef } from "react";
import { getScenePreloadUrls } from "./scene-registry";
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
import type { SceneId } from "./types";

const browserModelCache: ModelCachePort = {
  preload: (url) => {
    void preloadSceneModel(url).catch(() => undefined);
  },
  clear: clearSceneModel,
};

function scheduleIdlePreload(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(callback, { timeout: 1_500 });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }
  const timeoutId = window.setTimeout(callback, 500);
  return () => window.clearTimeout(timeoutId);
}

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
  const scheduleGeneration = useRef(0);

  useEffect(() => {
    const generation = ++scheduleGeneration.current;
    allowed.current = reconcileScenePreloads(
      enabled ? activeSceneId : null,
      allowed.current,
      browserModelCache,
      false,
    );

    let cancel: () => void = () => undefined;
    if (enabled && ready && getScenePreloadUrls(activeSceneId).length > 1) {
      cancel = scheduleIdlePreload(() => {
        if (scheduleGeneration.current !== generation) return;
        allowed.current = reconcileScenePreloads(
          activeSceneId,
          allowed.current,
          browserModelCache,
          true,
        );
      });
    }

    return () => {
      scheduleGeneration.current += 1;
      cancel();
    };
  }, [activeSceneId, enabled, ready]);

  useEffect(() => {
    const lease = acquireSceneModelHostLease();
    return () => {
      queueMicrotask(() => {
        if (!releaseSceneModelHostLease(lease)) return;
        allowed.current = new Set();
      });
    };
  }, []);

  return null;
}
