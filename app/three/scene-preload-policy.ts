import {
  getSceneDefinition,
  getScenePreloadUrls,
} from "./scene-registry";
import type { SceneId } from "./types";

export interface ModelCachePort {
  readonly preload: (url: string) => void;
}

export function reconcileScenePreloads(
  activeSceneId: SceneId | null,
  previous: ReadonlySet<string>,
  cache: ModelCachePort,
  preloadNext: boolean,
): Set<string> {
  const currentUrl = activeSceneId
    ? getSceneDefinition(activeSceneId).modelUrl
    : null;
  if (!activeSceneId) return new Set();

  const desired = new Set(previous);
  if (preloadNext) {
    const nextUrl = getScenePreloadUrls(activeSceneId).find(
      (url) => url !== currentUrl,
    );
    if (nextUrl) desired.add(nextUrl);
  }

  for (const url of desired) {
    if (!previous.has(url)) cache.preload(url);
  }
  return desired;
}
