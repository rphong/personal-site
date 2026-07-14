"use client";

import { createContext, useContext } from "react";
import type {
  SceneDefinition,
  SceneId,
  SceneRotation,
  SceneTuning,
  ThreeStatus,
} from "./types";

export interface SceneRuntimeContextValue {
  readonly activeSceneId: SceneId;
  readonly activeScene: SceneDefinition;
  readonly activeSectionElement: HTMLElement | null;
  readonly sceneStageElement: HTMLElement | null;
  readonly activationVersion: number;
  readonly sceneActivationAllowed: boolean;
  readonly status: ThreeStatus;
  readonly rotation: SceneRotation;
  readonly threeInitialized: boolean;
  readonly threeEnabled: boolean;
  readonly threeSupported: boolean;
  readonly activateScene: (sceneId: SceneId) => void;
  readonly registerSection: (
    sceneId: SceneId,
    element: HTMLElement,
  ) => () => void;
  readonly registerSceneStage: (element: HTMLElement | null) => void;
  readonly setStatus: (status: ThreeStatus) => void;
  readonly rotateBy: (
    deltaX: number,
    deltaY: number,
    allowPitch: boolean,
  ) => void;
  readonly setThreeEnabled: (enabled: boolean) => void;
  readonly setDebugTuning?: (
    sceneId: SceneId,
    tuning: SceneTuning | null,
  ) => void;
}

export const SceneRuntimeContext =
  createContext<SceneRuntimeContextValue | null>(null);

export function useOptionalSceneRuntime(): SceneRuntimeContextValue | null {
  return useContext(SceneRuntimeContext);
}

export function useSceneRuntime(): SceneRuntimeContextValue {
  const value = useOptionalSceneRuntime();
  if (!value) {
    throw new Error("useSceneRuntime must be used inside SceneProvider");
  }
  return value;
}
