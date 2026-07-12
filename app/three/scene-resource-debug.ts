import { sceneRuntimeDebugEnabled } from "./scene-runtime-debug";

export type SceneResourceDebugAction =
  | "activate"
  | "preload"
  | "clear"
  | "clear-all"
  | "host-acquire"
  | "host-release"
  | "load-start"
  | "load-resolved"
  | "load-rejected"
  | "dispose"
  | "dispose-late-decoded";

export interface SceneResourceDebugEvent {
  readonly action: SceneResourceDebugAction;
  readonly at: number;
  readonly owner?: string;
  readonly size: number;
  readonly url?: string;
}

export interface SceneResourceDebugPort {
  readonly clearEvents: () => void;
  readonly events: SceneResourceDebugEvent[];
  size: number;
}

declare global {
  interface Window {
    __sceneResourceDebug?: SceneResourceDebugPort;
  }
}

export function recordSceneResourceDebug(
  action: SceneResourceDebugAction,
  size: number,
  url?: string,
  owner?: string,
): void {
  if (!sceneRuntimeDebugEnabled()) return;

  let port = window.__sceneResourceDebug;
  if (!port) {
    const events: SceneResourceDebugEvent[] = [];
    port = {
      events,
      size,
      clearEvents: () => {
        events.length = 0;
      },
    };
    window.__sceneResourceDebug = port;
  }

  port.size = size;
  port.events.push({ action, at: performance.now(), owner, size, url });
  if (port.events.length > 512) {
    port.events.splice(0, port.events.length - 512);
  }
}

export async function runSceneModelAfterDecodeHook(url: string): Promise<void> {
  if (!sceneRuntimeDebugEnabled()) return;
  await window.__sceneRuntimeTestHooks?.afterModelDecode?.(url);
}
