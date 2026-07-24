"use client";

import {
  sceneRuntimeTraceEnabled,
  traceSceneRuntime,
} from "./scene-runtime-trace-core";

export type SceneRuntimeTraceModule = typeof import("./scene-runtime-trace");
export type SceneAlphaCaptureModule = typeof import("./scene-alpha-capture");

let loadedTraceModule: SceneRuntimeTraceModule | null = null;
let traceModulePromise: Promise<SceneRuntimeTraceModule> | null = null;
let loadedAlphaCaptureModule: SceneAlphaCaptureModule | null = null;
let alphaCaptureModulePromise: Promise<SceneAlphaCaptureModule> | null = null;
const reportedModuleLoadErrors = new Set<"alpha-capture" | "runtime-trace">();

function reportTraceModuleLoadError(
  moduleName: "alpha-capture" | "runtime-trace",
  error: unknown,
) {
  if (reportedModuleLoadErrors.has(moduleName)) return;
  reportedModuleLoadErrors.add(moduleName);
  traceSceneRuntime("trace-module:load-error", {
    error: error instanceof Error ? error.message : String(error),
    moduleName,
  });
}

export function getLoadedSceneRuntimeTraceModule() {
  return sceneRuntimeTraceEnabled() ? loadedTraceModule : null;
}

export function loadSceneRuntimeTraceModule() {
  if (!sceneRuntimeTraceEnabled()) {
    return Promise.resolve<SceneRuntimeTraceModule | null>(null);
  }
  if (loadedTraceModule) return Promise.resolve(loadedTraceModule);
  traceModulePromise ??= import("./scene-runtime-trace")
    .then((module) => {
      loadedTraceModule = module;
      return module;
    })
    .catch((error: unknown) => {
      traceModulePromise = null;
      throw error;
    });
  return traceModulePromise;
}

export function warmSceneRuntimeTraceModule() {
  if (!sceneRuntimeTraceEnabled()) return;
  void loadSceneRuntimeTraceModule().catch((error: unknown) => {
    reportTraceModuleLoadError("runtime-trace", error);
  });
}

export function runWithSceneRuntimeTraceModule(
  callback: (module: SceneRuntimeTraceModule) => void,
) {
  if (!sceneRuntimeTraceEnabled()) return;
  if (loadedTraceModule) {
    callback(loadedTraceModule);
    return;
  }
  void loadSceneRuntimeTraceModule()
    .then((module) => {
      if (module) callback(module);
    })
    .catch((error: unknown) => {
      reportTraceModuleLoadError("runtime-trace", error);
    });
}

export function getLoadedSceneAlphaCaptureModule() {
  return sceneRuntimeTraceEnabled() ? loadedAlphaCaptureModule : null;
}

export function loadSceneAlphaCaptureModule() {
  if (!sceneRuntimeTraceEnabled()) {
    return Promise.resolve<SceneAlphaCaptureModule | null>(null);
  }
  if (loadedAlphaCaptureModule) {
    return Promise.resolve(loadedAlphaCaptureModule);
  }
  alphaCaptureModulePromise ??= import("./scene-alpha-capture")
    .then((module) => {
      loadedAlphaCaptureModule = module;
      return module;
    })
    .catch((error: unknown) => {
      alphaCaptureModulePromise = null;
      throw error;
    });
  return alphaCaptureModulePromise;
}

export function warmSceneAlphaCaptureModule() {
  if (!sceneRuntimeTraceEnabled()) return;
  void loadSceneAlphaCaptureModule().catch((error: unknown) => {
    reportTraceModuleLoadError("alpha-capture", error);
  });
}

export async function prepareSceneRuntimeTrace() {
  if (!sceneRuntimeTraceEnabled()) return;

  await Promise.all([
    loadSceneRuntimeTraceModule()
      .then((module) => {
        module?.installSceneRuntimeTraceObservers();
      })
      .catch((error: unknown) => {
        reportTraceModuleLoadError("runtime-trace", error);
      }),
    loadSceneAlphaCaptureModule().catch((error: unknown) => {
      reportTraceModuleLoadError("alpha-capture", error);
    }),
  ]);
}
