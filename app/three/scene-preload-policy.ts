import {
  getSceneDefinition,
  getScenePreloadUrls,
} from "./scene-registry";
import type { SceneId } from "./types";

export interface ModelCachePort {
  readonly preload: (url: string) => void;
  readonly clear: (url: string) => void;
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
  const desired = new Set<string>(currentUrl ? [currentUrl] : []);

  if (activeSceneId && currentUrl && preloadNext) {
    const nextUrl = getScenePreloadUrls(activeSceneId).find(
      (url) => url !== currentUrl,
    );
    if (nextUrl) desired.add(nextUrl);
  }

  for (const url of desired) {
    if (url !== currentUrl && !previous.has(url)) cache.preload(url);
  }
  for (const url of previous) {
    if (!desired.has(url)) cache.clear(url);
  }
  return desired;
}
