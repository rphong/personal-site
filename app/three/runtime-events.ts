import type { SceneFailureReason, SceneId } from "./types";

export const SCENE_RUNTIME_EVENT_NAME = "site:scene-runtime" as const;

export type SceneRuntimeEventDetail =
  | {
      readonly status: "ready";
      readonly sceneId: SceneId;
      readonly durationMs: number;
    }
  | {
      readonly status: "failure";
      readonly sceneId: SceneId;
      readonly reason: SceneFailureReason;
      readonly durationMs: number;
    }
  | {
      readonly status: "context-lost";
      readonly sceneId: SceneId;
      readonly reason: "context-lost";
    }
  | {
      readonly status: "rotation-health";
      readonly sceneId: SceneId;
      readonly fps: number;
    };

declare global {
  interface WindowEventMap {
    "site:scene-runtime": CustomEvent<SceneRuntimeEventDetail>;
  }
}

export function emitSceneRuntimeEvent(detail: SceneRuntimeEventDetail): void {
  if (typeof window === "undefined") return;

  if (detail.status === "ready") {
    performance.mark(`scene-ready:${detail.sceneId}`);
  }

  window.dispatchEvent(
    new CustomEvent<SceneRuntimeEventDetail>(SCENE_RUNTIME_EVENT_NAME, {
      detail,
    }),
  );
}
