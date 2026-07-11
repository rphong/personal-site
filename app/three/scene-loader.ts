import { use } from "react";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { SceneResourceCache } from "./scene-resource-cache";
import { disposeSceneSource } from "./scene-resources";

type FetchPort = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function configureSceneLoader(loader: GLTFLoader): GLTFLoader {
  return loader.setMeshoptDecoder(MeshoptDecoder);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function modelBasePath(url: string): string {
  const base =
    typeof document === "undefined"
      ? "http://localhost/"
      : document.baseURI;
  return new URL(".", new URL(url, base)).href;
}

export async function parseSceneGltf(
  data: ArrayBuffer,
  path: string,
): Promise<GLTF> {
  return configureSceneLoader(new GLTFLoader()).parseAsync(data, path);
}

export async function loadSceneGltf(
  url: string,
  signal: AbortSignal,
  fetcher: FetchPort = globalThis.fetch,
): Promise<GLTF> {
  let response: Response;
  try {
    response = await fetcher(url, {
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    if (isAbortError(error) || signal.aborted) throw error;
    throw new Error(`Scene model fetch failed for ${url}`, { cause: error });
  }

  let data: ArrayBuffer;
  try {
    data = await response.arrayBuffer();
  } catch (error) {
    if (isAbortError(error) || signal.aborted) throw error;
    throw new Error(`Scene model fetch failed for ${url}`, { cause: error });
  }

  if (signal.aborted) {
    const error = new Error(`Scene model fetch aborted for ${url}`);
    error.name = "AbortError";
    throw error;
  }

  try {
    const gltf = await parseSceneGltf(data, modelBasePath(url));
    if (signal.aborted) {
      disposeSceneSource(gltf.scene);
      const error = new Error(`Scene model fetch aborted for ${url}`);
      error.name = "AbortError";
      throw error;
    }
    return gltf;
  } catch (error) {
    if (isAbortError(error) || signal.aborted) throw error;
    throw new Error(`Scene model decode failed for ${url}`, { cause: error });
  }
}

const sceneCache = new SceneResourceCache<GLTF>({
  load: (url, signal) => loadSceneGltf(url, signal),
  dispose: (gltf) => disposeSceneSource(gltf.scene),
});

export function useSceneGltf(url: string, owner: string): GLTF {
  return use(sceneCache.activate(url, owner));
}

export function preloadSceneModel(url: string): Promise<GLTF> {
  return sceneCache.preload(url);
}

export function clearSceneModel(url: string): void {
  sceneCache.clear(url);
}

export function acquireSceneModelHostLease(): symbol {
  return sceneCache.acquireHostLease();
}

export function releaseSceneModelHostLease(lease: symbol): boolean {
  return sceneCache.releaseHostLease(lease);
}

export function clearAllSceneModels(): void {
  sceneCache.clearAll();
}
