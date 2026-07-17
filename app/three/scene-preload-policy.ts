import { getSceneDefinition } from "./scene-registry";
import type { SceneId } from "./types";

export interface ModelCachePort {
  readonly preload: (url: string) => void;
  readonly clear: (url: string) => void;
}

export function reconcileScenePreloads(
  activeSceneId: SceneId | null,
  previous: ReadonlySet<string>,
  cache: ModelCachePort,
  preloadUrls: readonly string[],
): Set<string> {
  if (!activeSceneId) {
    for (const url of previous) cache.clear(url);
    return new Set();
  }

  const currentUrl = getSceneDefinition(activeSceneId).modelUrl;
  const desired = new Set(previous);
  if (currentUrl) desired.add(currentUrl);

  for (const url of preloadUrls) {
    desired.add(url);
    if (!previous.has(url)) cache.preload(url);
  }
  return desired;
}
