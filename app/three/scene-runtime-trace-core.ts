"use client";

import type { SceneId } from "./types";

export interface SceneRuntimeTraceEntry {
  readonly at: number;
  readonly details: Readonly<Record<string, unknown>>;
  readonly path: string;
  readonly phase: string;
  readonly sequence: number;
  readonly wallTime: number;
}

export interface SceneRuntimeTraceMoment {
  readonly at: number;
  readonly path: string;
  readonly wallTime: number;
}

export interface SceneRenderTraceIdentity {
  readonly adoptionVersion: string | null;
  readonly canvasConnected: boolean;
  readonly ownerSceneId: string | null;
  readonly path: string;
  readonly poolKey: string | null;
  readonly poolState: string | null;
  readonly renderedAdoptionVersion: string | null;
  readonly sectionSceneId: string | null;
  readonly stageConnected: boolean;
}

export interface SceneRenderTraceCoherence {
  readonly coherent: boolean;
  readonly identityFields: {
    readonly adoptionVersion: boolean;
    readonly canvasConnected: boolean;
    readonly ownerSceneId: boolean;
    readonly path: boolean;
    readonly poolKey: boolean;
    readonly poolState: boolean;
    readonly renderedAdoptionVersion: boolean;
    readonly sectionSceneId: boolean;
    readonly stageConnected: boolean;
  };
  readonly identityMatches: boolean;
  readonly auditIdentityValid: boolean;
  readonly renderedIdentityValid: boolean;
  readonly rendererFrameMatches: boolean;
}

declare global {
  interface Window {
    __enableSceneRuntimeTrace?: boolean;
    __sceneRuntimeTrace?: SceneRuntimeTraceEntry[];
    __sceneRuntimeTraceObserverCleanup?: () => void;
  }
}

const TRACE_QUERY_KEY = "sceneTrace";
const TRACE_LIMIT = 4_096;
const TRACE_CONSOLE_BATCH_SIZE = 8;

let traceLatched = false;
let lastEvaluatedSearch: string | null = null;
let traceSequence = 0;
let traceConsoleFlushScheduled = false;
const pendingTraceConsoleEntries: SceneRuntimeTraceEntry[] = [];
const traceEnableListeners = new Set<() => void>();
let traceEnableValue = false;

const readTraceEnableValue = () => traceEnableValue;
const writeTraceEnableValue = (value: boolean | undefined) => {
  traceEnableValue = value === true;
  if (!traceEnableValue || traceLatched) return;
  traceLatched = true;
  for (const listener of traceEnableListeners) {
    try {
      listener();
    } catch {
      // Enabling diagnostics must never interfere with the application.
    }
  }
};

function installTraceEnableHook() {
  if (typeof window === "undefined") return;
  const descriptor = Object.getOwnPropertyDescriptor(
    window,
    "__enableSceneRuntimeTrace",
  );
  if (
    descriptor?.get === readTraceEnableValue &&
    descriptor.set === writeTraceEnableValue
  ) {
    return;
  }
  const initialValue = window.__enableSceneRuntimeTrace === true;
  if (descriptor && descriptor.configurable === false) {
    traceEnableValue = initialValue;
    return;
  }
  traceEnableValue = initialValue;
  Object.defineProperty(window, "__enableSceneRuntimeTrace", {
    configurable: true,
    enumerable: true,
    get: readTraceEnableValue,
    set: writeTraceEnableValue,
  });
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

export function sceneRuntimeTraceEnabled() {
  if (typeof window === "undefined") return false;
  installTraceEnableHook();
  if (traceLatched || window.__enableSceneRuntimeTrace === true) {
    traceLatched = true;
    return true;
  }
  if (lastEvaluatedSearch === window.location.search) return false;
  lastEvaluatedSearch = window.location.search;
  traceLatched =
    new URLSearchParams(lastEvaluatedSearch).get(TRACE_QUERY_KEY) === "1";
  return traceLatched;
}

export function subscribeSceneRuntimeTraceEnable(listener: () => void) {
  const enabled = sceneRuntimeTraceEnabled();
  traceEnableListeners.add(listener);
  if (enabled) listener();
  return () => {
    traceEnableListeners.delete(listener);
  };
}

export function captureSceneRuntimeTraceMoment(): SceneRuntimeTraceMoment {
  return {
    at: rounded(performance.now()),
    path: window.location.pathname,
    wallTime: Date.now(),
  };
}

export function compareSceneRenderTraceCoherence(
  renderedIdentity: SceneRenderTraceIdentity,
  auditIdentity: SceneRenderTraceIdentity,
  rendererFrame: number,
  rendererFrameAtAudit: number,
): SceneRenderTraceCoherence {
  const identityFields = {
    adoptionVersion:
      renderedIdentity.adoptionVersion === auditIdentity.adoptionVersion,
    canvasConnected:
      renderedIdentity.canvasConnected === auditIdentity.canvasConnected,
    ownerSceneId:
      renderedIdentity.ownerSceneId === auditIdentity.ownerSceneId,
    path: renderedIdentity.path === auditIdentity.path,
    poolKey: renderedIdentity.poolKey === auditIdentity.poolKey,
    poolState: renderedIdentity.poolState === auditIdentity.poolState,
    renderedAdoptionVersion:
      renderedIdentity.renderedAdoptionVersion ===
      auditIdentity.renderedAdoptionVersion,
    sectionSceneId:
      renderedIdentity.sectionSceneId === auditIdentity.sectionSceneId,
    stageConnected:
      renderedIdentity.stageConnected === auditIdentity.stageConnected,
  };
  const validIdentity = (identity: SceneRenderTraceIdentity) =>
    identity.canvasConnected &&
    identity.stageConnected &&
    identity.adoptionVersion !== null &&
    identity.ownerSceneId !== null &&
    identity.poolKey !== null &&
    identity.poolState === "assigned" &&
    identity.renderedAdoptionVersion === identity.adoptionVersion &&
    identity.sectionSceneId === identity.ownerSceneId;
  const renderedIdentityValid = validIdentity(renderedIdentity);
  const auditIdentityValid = validIdentity(auditIdentity);
  const identityMatches =
    renderedIdentityValid &&
    auditIdentityValid &&
    Object.values(identityFields).every(Boolean);
  const rendererFrameMatches = rendererFrame === rendererFrameAtAudit;
  return {
    auditIdentityValid,
    coherent: identityMatches && rendererFrameMatches,
    identityFields,
    identityMatches,
    renderedIdentityValid,
    rendererFrameMatches,
  };
}

function serializedConsoleEntry(entry: SceneRuntimeTraceEntry) {
  try {
    return JSON.stringify(entry);
  } catch (error) {
    const serializationError =
      error instanceof Error ? error.message : String(error);
    try {
      return JSON.stringify({
        at: entry.at,
        details: { serializationError },
        path: entry.path,
        phase: entry.phase,
        sequence: entry.sequence,
        wallTime: entry.wallTime,
      });
    } catch {
      return `{"phase":"trace:serialization-error","sequence":${entry.sequence}}`;
    }
  }
}

function flushTraceConsoleEntries() {
  traceConsoleFlushScheduled = false;
  const entries = pendingTraceConsoleEntries.splice(
    0,
    TRACE_CONSOLE_BATCH_SIZE,
  );
  for (const entry of entries) {
    try {
      console.log(
        `[scene-runtime-trace] ${serializedConsoleEntry(entry)}`,
      );
    } catch {
      // Trace delivery must never interfere with the application runtime.
    }
  }
  if (pendingTraceConsoleEntries.length > 0) {
    scheduleTraceConsoleFlush();
  }
}

function scheduleTraceConsoleFlush() {
  if (traceConsoleFlushScheduled) return;
  traceConsoleFlushScheduled = true;
  try {
    window.setTimeout(flushTraceConsoleEntries, 0);
  } catch {
    traceConsoleFlushScheduled = false;
    pendingTraceConsoleEntries.length = 0;
  }
}

export function traceSceneRuntime(
  phase: string,
  details: Readonly<Record<string, unknown>> = {},
  moment?: SceneRuntimeTraceMoment,
) {
  if (!sceneRuntimeTraceEnabled()) return null;

  const entry: SceneRuntimeTraceEntry = {
    at: moment?.at ?? rounded(performance.now()),
    details,
    path: moment?.path ?? window.location.pathname,
    phase,
    sequence: (traceSequence += 1),
    wallTime: moment?.wallTime ?? Date.now(),
  };
  const trace = window.__sceneRuntimeTrace ?? [];
  trace.push(entry);
  if (trace.length > TRACE_LIMIT) {
    trace.splice(0, trace.length - TRACE_LIMIT);
  }
  window.__sceneRuntimeTrace = trace;
  pendingTraceConsoleEntries.push(entry);
  scheduleTraceConsoleFlush();
  return entry.sequence;
}

export function sceneTraceIdentity(
  sceneId: SceneId,
  adoptionVersion: number,
  activationVersion?: number,
) {
  return {
    activationVersion: activationVersion ?? null,
    adoptionVersion,
    sceneId,
  };
}
