import type {
  Camera,
  Scene,
  WebGLRenderer,
} from "three";
import type { SceneId } from "./types";

export interface SceneRuntimeDebugFrame {
  readonly at: number;
  readonly bufferHeight: number;
  readonly bufferWidth: number;
  readonly calls: number;
  readonly cssHeight: number;
  readonly cssWidth: number;
  readonly frame: number;
  readonly pitch: number | null;
  readonly pixelRatio: number;
  readonly renderTarget: "screen" | "offscreen";
  readonly roll: number | null;
  readonly rootName: string | null;
  readonly sceneId: SceneId;
  readonly shadowMapEnabled: boolean;
  readonly yaw: number | null;
}

export interface SceneRuntimeDebugPort {
  readonly canvas: HTMLCanvasElement;
  readonly clearFrames: () => void;
  readonly context: WebGL2RenderingContext;
  readonly frames: SceneRuntimeDebugFrame[];
  readonly renderer: WebGLRenderer;
  camera: Camera | null;
  invalidate: (() => void) | null;
  scene: Scene | null;
  sceneId: SceneId | null;
}

declare global {
  interface Window {
    __enableSceneRuntimeDebug?: boolean;
    __sceneRuntimeDebug?: SceneRuntimeDebugPort;
    __sceneRuntimeTestHooks?: {
      readonly afterModelDecode?: (url: string) => Promise<void> | void;
    };
  }
}

export function sceneRuntimeDebugEnabled() {
  if (typeof window === "undefined") return false;
  return (
    window.__enableSceneRuntimeDebug === true ||
    (window.location.pathname === "/scene-capture" &&
      new URLSearchParams(window.location.search).get("controls") === "1")
  );
}

export function connectSceneRuntimeDebug(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  invalidate: () => void,
  sceneId: SceneId,
): void {
  if (!sceneRuntimeDebugEnabled()) return;

  let port = window.__sceneRuntimeDebug;
  if (!port || port.renderer !== renderer) {
    const frames: SceneRuntimeDebugFrame[] = [];
    port = {
      canvas: renderer.domElement,
      context: renderer.getContext() as WebGL2RenderingContext,
      renderer,
      frames,
      clearFrames: () => {
        frames.length = 0;
      },
      camera: null,
      invalidate: null,
      scene: null,
      sceneId: null,
    };
    window.__sceneRuntimeDebug = port;
  }

  port.camera = camera;
  port.invalidate = invalidate;
  port.scene = scene;
  port.sceneId = sceneId;
}

export function disconnectSceneRuntimeDebug(
  invalidate: () => void,
  sceneId: SceneId,
): void {
  const port = window.__sceneRuntimeDebug;
  if (!port || port.invalidate !== invalidate || port.sceneId !== sceneId) {
    return;
  }
  port.camera = null;
  port.invalidate = null;
  port.scene = null;
  port.sceneId = null;
}

export function recordSceneRuntimeDebugFrame(
  renderer: WebGLRenderer,
  scene: Scene,
  sceneId: SceneId,
): void {
  const port = window.__sceneRuntimeDebug;
  if (!port || port.renderer !== renderer || port.sceneId !== sceneId) return;

  const rootName = `scene-root:${sceneId}`;
  const root = scene.getObjectByName(rootName);
  const canvas = renderer.domElement;
  port.frames.push({
    at: performance.now(),
    bufferHeight: canvas.height,
    bufferWidth: canvas.width,
    calls: renderer.info.render.calls,
    cssHeight: canvas.clientHeight,
    cssWidth: canvas.clientWidth,
    frame: renderer.info.render.frame,
    pitch: root?.rotation.x ?? null,
    pixelRatio: renderer.getPixelRatio(),
    renderTarget: renderer.getRenderTarget() === null ? "screen" : "offscreen",
    roll: root?.rotation.z ?? null,
    rootName: root?.name ?? null,
    sceneId,
    shadowMapEnabled: renderer.shadowMap.enabled,
    yaw: root?.rotation.y ?? null,
  });
  if (port.frames.length > 256) port.frames.splice(0, port.frames.length - 256);
}
