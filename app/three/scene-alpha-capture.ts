"use client";

import type { WebGLRenderer } from "three";
import {
  captureSceneRuntimeTraceMoment,
  resolveFrozenScenePosterSilhouette,
  snapshotSceneAlphaGeometry,
  traceSceneRuntime,
} from "./scene-runtime-trace";
import type { SceneId } from "./types";

const ALPHA_THRESHOLD = 8;
const CAPTURES_PER_ADOPTION = 3;
export const MAX_TRACKED_ALPHA_ADOPTIONS = 16;
const TARGET_IDLE_RELEASE_MS = 1_000;
const POSTER_SAMPLE_WAIT_LIMIT_MS = 2_000;
const POSTER_SAMPLE_WAIT_INTERVAL_MS = 16;

interface CaptureTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly height: number;
  readonly texture: WebGLTexture;
  readonly width: number;
  busy: boolean;
}

interface CaptureState {
  activeAdoptionKey: string | null;
  blockedAdoptions: Set<string>;
  captureCounts: Map<string, number>;
  contextGeneration: number;
  epoch: number;
  idleReleaseTimer: number | null;
  targets: CaptureTarget[];
}

interface CaptureDetails {
  readonly adoptionVersion: number;
  readonly contextGeneration: number;
  readonly renderReason: string;
  readonly rendererFrame: number;
  readonly sceneId: SceneId;
}

interface ResolvedCaptureDetails extends CaptureDetails {
  readonly residentKey: string | null;
}

export interface SceneAlphaAdoptionState {
  readonly adoptionVersion: string | null;
  readonly ownerSceneId: string | null;
  readonly poolKey: string | null;
  readonly poolState: string | null;
  readonly renderedAdoptionVersion: string | null;
}

export function sceneAlphaAdoptionStateIsPresented(
  state: SceneAlphaAdoptionState,
  expected: Readonly<{
    adoptionVersion: string;
    ownerSceneId: string;
    poolKey: string | null;
  }>,
) {
  return (
    state.adoptionVersion === expected.adoptionVersion &&
    state.ownerSceneId === expected.ownerSceneId &&
    expected.poolKey !== null &&
    state.poolKey === expected.poolKey &&
    state.poolState === "assigned" &&
    state.renderedAdoptionVersion === expected.adoptionVersion
  );
}

export function sceneAlphaAdoptionSnapshotsAreCurrent(
  capture: SceneAlphaAdoptionState,
  current: SceneAlphaAdoptionState &
    Readonly<{ sectionSceneId: string | null }>,
  expected: Readonly<{
    adoptionVersion: string;
    ownerSceneId: string;
    poolKey: string | null;
  }>,
) {
  return (
    sceneAlphaAdoptionStateIsPresented(capture, expected) &&
    sceneAlphaAdoptionStateIsPresented(current, expected) &&
    current.sectionSceneId === expected.ownerSceneId
  );
}

interface ViewportAlphaBounds {
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

const captureStates = new WeakMap<WebGL2RenderingContext, CaptureState>();

export function sceneAlphaCaptureSetComplete(captureCount: number) {
  return captureCount >= CAPTURES_PER_ADOPTION;
}

export function retainedSceneAlphaAdoptionKeys(
  keys: readonly string[],
  currentKey: string,
  limit = MAX_TRACKED_ALPHA_ADOPTIONS,
) {
  const unique = [...new Set(keys)].filter((key) => key !== currentKey);
  return [
    ...unique.slice(-Math.max(0, limit - 1)),
    currentKey,
  ].slice(-Math.max(1, limit));
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function roundedRatio(value: number) {
  return Math.round(value * 100_000) / 100_000;
}

function safeTrace(
  phase: string,
  details: Readonly<Record<string, unknown>>,
  moment?: ReturnType<typeof captureSceneRuntimeTraceMoment>,
) {
  try {
    traceSceneRuntime(phase, details, moment);
  } catch (error) {
    window.setTimeout(() => {
      console.warn(
        "[scene-runtime-trace] alpha capture telemetry failed",
        error,
      );
    }, 0);
  }
}

function deleteTarget(
  context: WebGL2RenderingContext,
  target: CaptureTarget,
) {
  try {
    context.deleteFramebuffer(target.framebuffer);
    context.deleteTexture(target.texture);
  } catch {
    // Context loss and teardown are expected to invalidate debug resources.
  }
}

function stateFor(
  context: WebGL2RenderingContext,
  contextGeneration: number,
) {
  let state = captureStates.get(context);
  if (!state) {
    state = {
      activeAdoptionKey: null,
      blockedAdoptions: new Set(),
      captureCounts: new Map(),
      contextGeneration,
      epoch: 0,
      idleReleaseTimer: null,
      targets: [],
    };
    captureStates.set(context, state);
    return state;
  }
  if (state.contextGeneration === contextGeneration) return state;

  state.epoch += 1;
  if (state.idleReleaseTimer !== null) {
    window.clearTimeout(state.idleReleaseTimer);
    state.idleReleaseTimer = null;
  }
  for (const target of state.targets) deleteTarget(context, target);
  state.targets = [];
  state.captureCounts.clear();
  state.blockedAdoptions.clear();
  state.activeAdoptionKey = null;
  state.contextGeneration = contextGeneration;
  return state;
}

function deleteIdleTargets(
  context: WebGL2RenderingContext,
  state: CaptureState,
) {
  const idle = state.targets.filter((target) => !target.busy);
  for (const target of idle) {
    deleteTarget(context, target);
    state.targets.splice(state.targets.indexOf(target), 1);
  }
}

function clearIdleTargetRelease(state: CaptureState) {
  if (state.idleReleaseTimer === null) return;
  window.clearTimeout(state.idleReleaseTimer);
  state.idleReleaseTimer = null;
}

function scheduleIdleTargetRelease(
  context: WebGL2RenderingContext,
  state: CaptureState,
) {
  clearIdleTargetRelease(state);
  const epoch = state.epoch;
  state.idleReleaseTimer = window.setTimeout(() => {
    state.idleReleaseTimer = null;
    if (state.epoch !== epoch || context.isContextLost()) return;
    deleteIdleTargets(context, state);
  }, TARGET_IDLE_RELEASE_MS);
}

function pruneAdoptionKeys(state: CaptureState, currentKey: string) {
  const retained = new Set(
    retainedSceneAlphaAdoptionKeys(
      [
        ...state.captureCounts.keys(),
        ...state.blockedAdoptions,
      ],
      currentKey,
    ),
  );
  for (const key of state.captureCounts.keys()) {
    if (!retained.has(key)) state.captureCounts.delete(key);
  }
  for (const key of state.blockedAdoptions) {
    if (!retained.has(key)) state.blockedAdoptions.delete(key);
  }
}

function blockAdoption(state: CaptureState, adoptionKey: string) {
  state.blockedAdoptions.add(adoptionKey);
  pruneAdoptionKeys(state, adoptionKey);
}

function releaseCaptureTarget(
  context: WebGL2RenderingContext,
  state: CaptureState,
  target: CaptureTarget,
  adoptionKey: string,
  force = false,
) {
  target.busy = false;
  if (
    force ||
    state.activeAdoptionKey !== adoptionKey ||
    sceneAlphaCaptureSetComplete(
      state.captureCounts.get(adoptionKey) ?? 0,
    )
  ) {
    clearIdleTargetRelease(state);
    deleteIdleTargets(context, state);
  } else {
    scheduleIdleTargetRelease(context, state);
  }
}

function restoreFramebufferBindings(
  context: WebGL2RenderingContext,
  read: WebGLFramebuffer | null,
  draw: WebGLFramebuffer | null,
) {
  context.bindFramebuffer(context.READ_FRAMEBUFFER, read);
  context.bindFramebuffer(context.DRAW_FRAMEBUFFER, draw);
}

function createTarget(
  context: WebGL2RenderingContext,
  width: number,
  height: number,
): CaptureTarget | null {
  const texture = context.createTexture();
  const framebuffer = context.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) context.deleteTexture(texture);
    if (framebuffer) context.deleteFramebuffer(framebuffer);
    return null;
  }

  const previousActiveTexture = context.getParameter(
    context.ACTIVE_TEXTURE,
  ) as number;
  context.activeTexture(context.TEXTURE0);
  const previousTexture = context.getParameter(
    context.TEXTURE_BINDING_2D,
  ) as WebGLTexture | null;
  const previousRead = context.getParameter(
    context.READ_FRAMEBUFFER_BINDING,
  ) as WebGLFramebuffer | null;
  const previousDraw = context.getParameter(
    context.DRAW_FRAMEBUFFER_BINDING,
  ) as WebGLFramebuffer | null;

  try {
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MIN_FILTER,
      context.NEAREST,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MAG_FILTER,
      context.NEAREST,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_S,
      context.CLAMP_TO_EDGE,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_T,
      context.CLAMP_TO_EDGE,
    );
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RGBA8,
      width,
      height,
      0,
      context.RGBA,
      context.UNSIGNED_BYTE,
      null,
    );
    context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
    context.framebufferTexture2D(
      context.FRAMEBUFFER,
      context.COLOR_ATTACHMENT0,
      context.TEXTURE_2D,
      texture,
      0,
    );
    if (
      context.checkFramebufferStatus(context.FRAMEBUFFER) !==
      context.FRAMEBUFFER_COMPLETE
    ) {
      context.deleteFramebuffer(framebuffer);
      context.deleteTexture(texture);
      return null;
    }
  } catch (error) {
    context.deleteFramebuffer(framebuffer);
    context.deleteTexture(texture);
    throw error;
  } finally {
    restoreFramebufferBindings(context, previousRead, previousDraw);
    context.bindTexture(context.TEXTURE_2D, previousTexture);
    context.activeTexture(previousActiveTexture);
  }

  return {
    busy: false,
    framebuffer,
    height,
    texture,
    width,
  };
}

function acquireTarget(
  context: WebGL2RenderingContext,
  state: CaptureState,
  width: number,
  height: number,
) {
  const reusable = state.targets.find(
    (target) =>
      !target.busy &&
      target.width === width &&
      target.height === height,
  );
  if (reusable) {
    reusable.busy = true;
    return { allocated: false, setupMs: 0, target: reusable };
  }

  const stale = state.targets.filter(
    (target) =>
      !target.busy &&
      (target.width !== width || target.height !== height),
  );
  for (const target of stale) {
    deleteTarget(context, target);
    state.targets.splice(state.targets.indexOf(target), 1);
  }

  const setupStartedAt = performance.now();
  const target = createTarget(context, width, height);
  const setupMs = performance.now() - setupStartedAt;
  if (!target) return null;
  target.busy = true;
  state.targets.push(target);
  return { allocated: true, setupMs, target };
}

function viewportBoundsFor(
  normalized: Readonly<{
    bottom: number;
    left: number;
    right: number;
    top: number;
  }>,
  canvasRect: Readonly<{
    height: number;
    width: number;
    x: number;
    y: number;
  }>,
): ViewportAlphaBounds {
  const left = canvasRect.x + normalized.left * canvasRect.width;
  const right = canvasRect.x + normalized.right * canvasRect.width;
  const top = canvasRect.y + normalized.top * canvasRect.height;
  const bottom = canvasRect.y + normalized.bottom * canvasRect.height;
  return {
    bottom: rounded(bottom),
    centerX: rounded((left + right) / 2),
    centerY: rounded((top + bottom) / 2),
    height: rounded(bottom - top),
    left: rounded(left),
    right: rounded(right),
    top: rounded(top),
    width: rounded(right - left),
  };
}

function posterComparison(
  live: ViewportAlphaBounds,
  poster:
    | Readonly<{
        viewportBounds: Readonly<{
          bottom: number;
          centerX: number;
          centerY: number;
          left: number;
          right: number;
          top: number;
        }> | null;
      }>
    | null,
) {
  const bounds = poster?.viewportBounds;
  if (!bounds) return null;
  const edge = {
    bottom: rounded(live.bottom - bounds.bottom),
    left: rounded(live.left - bounds.left),
    right: rounded(live.right - bounds.right),
    top: rounded(live.top - bounds.top),
  };
  const center = {
    x: rounded(live.centerX - bounds.centerX),
    y: rounded(live.centerY - bounds.centerY),
  };
  const size = {
    height: rounded(
      live.height - (bounds.bottom - bounds.top),
    ),
    width: rounded(
      live.width - (bounds.right - bounds.left),
    ),
  };
  return {
    center,
    edge,
    maxAbsCenter: rounded(
      Math.max(Math.abs(center.x), Math.abs(center.y)),
    ),
    maxAbsEdge: rounded(
      Math.max(
        Math.abs(edge.bottom),
        Math.abs(edge.left),
        Math.abs(edge.right),
        Math.abs(edge.top),
      ),
    ),
    size,
  };
}

function validateCapturedAdoption(
  canvas: HTMLCanvasElement,
  geometry: ReturnType<typeof snapshotSceneAlphaGeometry>,
  details: ResolvedCaptureDetails,
) {
  const stage = canvas.closest<HTMLElement>("[data-scene-resident-stage]");
  const section = stage?.parentElement?.closest<HTMLElement>(
    "[data-scene-id]",
  );
  const actual = {
    adoptionVersion: stage?.dataset.sceneAdoptionVersion ?? null,
    ownerSceneId: stage?.dataset.sceneOwnerId ?? null,
    poolKey: stage?.dataset.scenePoolKey ?? null,
    poolState: stage?.dataset.scenePoolState ?? null,
    renderedAdoptionVersion:
      stage?.dataset.sceneRenderedAdoptionVersion ?? null,
    sectionSceneId: section?.dataset.sceneId ?? null,
  };
  const expected = {
    adoptionVersion: String(details.adoptionVersion),
    ownerSceneId: details.sceneId,
    poolKey: details.residentKey,
    sectionSceneId: details.sceneId,
  };
  const fields = {
    adoptionVersion:
      actual.adoptionVersion === expected.adoptionVersion &&
      geometry.state.adoptionVersion === expected.adoptionVersion,
    ownerSceneId:
      actual.ownerSceneId === expected.ownerSceneId &&
      geometry.state.ownerSceneId === expected.ownerSceneId,
    poolKey:
      actual.poolKey === expected.poolKey &&
      geometry.state.poolKey === expected.poolKey,
    poolState: actual.poolState === geometry.state.poolState,
    renderedAdoptionVersion:
      actual.renderedAdoptionVersion ===
      geometry.state.renderedAdoptionVersion,
    sectionSceneId: actual.sectionSceneId === expected.sectionSceneId,
  };
  return {
    actual,
    canvasConnected: canvas.isConnected,
    capturePresented: sceneAlphaAdoptionStateIsPresented(
      geometry.state,
      expected,
    ),
    currentPresented: sceneAlphaAdoptionStateIsPresented(actual, expected),
    expected,
    fields,
    valid:
      canvas.isConnected &&
      sceneAlphaAdoptionSnapshotsAreCurrent(
        geometry.state,
        actual,
        expected,
      ) &&
      Object.values(fields).every(Boolean),
  };
}

function finishCapture(
  context: WebGL2RenderingContext,
  state: CaptureState,
  epoch: number,
  target: CaptureTarget,
  canvas: HTMLCanvasElement,
  geometry: ReturnType<typeof snapshotSceneAlphaGeometry>,
  details: ResolvedCaptureDetails,
  adoptionKey: string,
  captureIndex: number,
  captureMoment: ReturnType<typeof captureSceneRuntimeTraceMoment>,
  copy: Readonly<Record<string, unknown>>,
  scheduledAt: number,
  animationFrameAt: number,
) {
  if (state.epoch !== epoch || context.isContextLost()) {
    if (state.epoch === epoch) {
      releaseCaptureTarget(
        context,
        state,
        target,
        adoptionKey,
        true,
      );
    } else {
      target.busy = false;
    }
    safeTrace("canvas:alpha-capture-skipped", {
      ...details,
      adoptionKey,
      captureIndex,
      reason:
        state.epoch !== epoch
          ? "context-generation-changed"
          : "context-lost-before-read",
    });
    return;
  }

  const pixels = new Uint8Array(target.width * target.height * 4);
  const previousRead = context.getParameter(
    context.READ_FRAMEBUFFER_BINDING,
  ) as WebGLFramebuffer | null;
  const previousDraw = context.getParameter(
    context.DRAW_FRAMEBUFFER_BINDING,
  ) as WebGLFramebuffer | null;
  const readStartedAt = performance.now();
  let readFinishedAt = readStartedAt;
  let readRestoredAt = readStartedAt;
  let bindingsRestored = false;
  let resourcesAfterRead = {
    idleTargets: state.targets.filter(({ busy }) => !busy).length,
    targetRetained: true,
    targets: state.targets.length,
  };
  try {
    context.bindFramebuffer(context.READ_FRAMEBUFFER, target.framebuffer);
    context.readPixels(
      0,
      0,
      target.width,
      target.height,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );
    readFinishedAt = performance.now();
  } catch (error) {
    safeTrace("canvas:alpha-capture-failed", {
      ...details,
      adoptionKey,
      captureIndex,
      error: error instanceof Error ? error.message : String(error),
      phase: "read",
    });
    return;
  } finally {
    restoreFramebufferBindings(context, previousRead, previousDraw);
    bindingsRestored =
      context.getParameter(context.READ_FRAMEBUFFER_BINDING) ===
        previousRead &&
      context.getParameter(context.DRAW_FRAMEBUFFER_BINDING) ===
        previousDraw;
    readRestoredAt = performance.now();
    releaseCaptureTarget(context, state, target, adoptionKey);
    resourcesAfterRead = {
      idleTargets: state.targets.filter(({ busy }) => !busy).length,
      targetRetained: state.targets.includes(target),
      targets: state.targets.length,
    };
  }

  const scanStartedAt = performance.now();
  let alphaPixels = 0;
  let minX = target.width;
  let minY = target.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      if (pixels[(y * target.width + x) * 4 + 3] <= ALPHA_THRESHOLD) {
        continue;
      }
      alphaPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const scanFinishedAt = performance.now();
  const normalized =
    maxX >= minX && maxY >= minY
      ? {
          bottom: roundedRatio(
            (target.height - minY) / target.height,
          ),
          left: roundedRatio(minX / target.width),
          right: roundedRatio((maxX + 1) / target.width),
          top: roundedRatio(
            (target.height - 1 - maxY) / target.height,
          ),
        }
      : null;
  const viewportBounds = normalized
    ? viewportBoundsFor(normalized, geometry.canvasRect)
    : null;

  const liveSilhouette = {
    alphaCoverage: roundedRatio(
      alphaPixels / Math.max(1, target.width * target.height),
    ),
    alphaPixels,
    normalized,
    threshold: ALPHA_THRESHOLD,
    viewportBounds,
  };
  const posterWaitStartedAt = performance.now();
  const emitWhenPosterSamplesAreReady = () => {
    try {
      const adoptionValidation = validateCapturedAdoption(
        canvas,
        geometry,
        details,
      );
      const posterSilhouettes = {
        outer:
          geometry.posterSilhouettes.outer ??
          resolveFrozenScenePosterSilhouette(
            geometry.posterGeometry.outer,
          ),
        runtime:
          geometry.posterSilhouettes.runtime ??
          resolveFrozenScenePosterSilhouette(
            geometry.posterGeometry.runtime,
          ),
      };
      const posterWaitMs = performance.now() - posterWaitStartedAt;
      if (
        adoptionValidation.valid &&
        (!posterSilhouettes.outer || !posterSilhouettes.runtime) &&
        posterWaitMs < POSTER_SAMPLE_WAIT_LIMIT_MS
      ) {
        window.setTimeout(
          emitWhenPosterSamplesAreReady,
          POSTER_SAMPLE_WAIT_INTERVAL_MS,
        );
        return;
      }

      safeTrace(
        "canvas:alpha-silhouette",
        {
          ...details,
          adoptionKey,
          buffer: {
            height: target.height,
            width: target.width,
          },
          adoptionValidation,
          captureIndex,
          captureMoment,
          copy,
          deferred: {
            animationFrameAt: rounded(animationFrameAt),
            posterWaitMs: rounded(posterWaitMs),
            readDelayMs: rounded(readStartedAt - captureMoment.at),
            scheduledAt: rounded(scheduledAt),
            taskAt: rounded(readStartedAt),
          },
          geometry: {
            ...geometry,
            posterSilhouettes,
          },
          liveSilhouette,
          posterComparisons: viewportBounds
            ? {
                outer: posterComparison(
                  viewportBounds,
                  posterSilhouettes.outer,
                ),
                runtime: posterComparison(
                  viewportBounds,
                  posterSilhouettes.runtime,
                ),
              }
            : { outer: null, runtime: null },
          read: {
            bindingsRestored,
            durationMs: rounded(readFinishedAt - readStartedAt),
            totalDurationMs: rounded(readRestoredAt - readStartedAt),
          },
          resourcesAfterRead,
          scan: {
            durationMs: rounded(scanFinishedAt - scanStartedAt),
          },
        },
        captureMoment,
      );
    } catch (error) {
      safeTrace("canvas:alpha-capture-failed", {
        ...details,
        adoptionKey,
        captureIndex,
        error: error instanceof Error ? error.message : String(error),
        phase: "poster-comparison",
      });
    }
  };
  emitWhenPosterSamplesAreReady();
}

export function captureSceneAlphaTraceFrame(
  renderer: WebGLRenderer,
  details: CaptureDetails,
) {
  let captureContext: WebGL2RenderingContext | null = null;
  let reservedTarget: CaptureTarget | null = null;
  let captureState: CaptureState | null = null;
  let captureAdoptionKey: string | null = null;
  let traceDetails: ResolvedCaptureDetails = {
    ...details,
    residentKey: null,
  };
  try {
    const context = renderer.getContext();
    if (
      !(context instanceof WebGL2RenderingContext) ||
      context.isContextLost()
    ) {
      return;
    }
    captureContext = context;

    const canvas = renderer.domElement;
    const residentKey =
      canvas.closest<HTMLElement>("[data-scene-resident-stage]")?.dataset
        .scenePoolKey ?? null;
    traceDetails = { ...details, residentKey };
    const state = stateFor(context, details.contextGeneration);
    const adoptionKey = `${residentKey ?? "unkeyed"}:${details.sceneId}:${details.adoptionVersion}:${details.contextGeneration}`;
    captureState = state;
    captureAdoptionKey = adoptionKey;
    if (state.activeAdoptionKey !== adoptionKey) {
      clearIdleTargetRelease(state);
      deleteIdleTargets(context, state);
      state.activeAdoptionKey = adoptionKey;
    }
    pruneAdoptionKeys(state, adoptionKey);
    if (state.blockedAdoptions.has(adoptionKey)) return;
    const captured = state.captureCounts.get(adoptionKey) ?? 0;
    if (captured >= CAPTURES_PER_ADOPTION) return;

    const width = canvas.width;
    const height = canvas.height;
    if (
      width <= 0 ||
      height <= 0 ||
      renderer.getRenderTarget() !== null
    ) {
      return;
    }

    const captureStartedAt = performance.now();
    const acquired = acquireTarget(context, state, width, height);
    if (!acquired) {
      blockAdoption(state, adoptionKey);
      safeTrace("canvas:alpha-capture-failed", {
        ...traceDetails,
        adoptionKey,
        phase: "target-setup",
      });
      return;
    }

    const { allocated, setupMs, target } = acquired;
    reservedTarget = target;
    const captureIndex = captured + 1;
    const captureMoment = captureSceneRuntimeTraceMoment();
    const geometryStartedAt = performance.now();
    const geometry = snapshotSceneAlphaGeometry(canvas);
    const geometryFinishedAt = performance.now();
    const previousRead = context.getParameter(
      context.READ_FRAMEBUFFER_BINDING,
    ) as WebGLFramebuffer | null;
    const previousDraw = context.getParameter(
      context.DRAW_FRAMEBUFFER_BINDING,
    ) as WebGLFramebuffer | null;
    const copyStartedAt = performance.now();
    let blitFinishedAt = copyStartedAt;
    let copyFinishedAt = copyStartedAt;
    let bindingsRestored = false;
    try {
      context.bindFramebuffer(context.READ_FRAMEBUFFER, null);
      context.bindFramebuffer(
        context.DRAW_FRAMEBUFFER,
        target.framebuffer,
      );
      context.blitFramebuffer(
        0,
        0,
        width,
        height,
        0,
        0,
        width,
        height,
        context.COLOR_BUFFER_BIT,
        context.NEAREST,
      );
      blitFinishedAt = performance.now();
    } finally {
      restoreFramebufferBindings(context, previousRead, previousDraw);
      bindingsRestored =
        context.getParameter(context.READ_FRAMEBUFFER_BINDING) ===
          previousRead &&
        context.getParameter(context.DRAW_FRAMEBUFFER_BINDING) ===
          previousDraw;
      copyFinishedAt = performance.now();
    }

    if (!bindingsRestored) {
      releaseCaptureTarget(
        context,
        state,
        target,
        adoptionKey,
        true,
      );
      reservedTarget = null;
      blockAdoption(state, adoptionKey);
      safeTrace("canvas:alpha-capture-failed", {
        ...traceDetails,
        adoptionKey,
        captureIndex,
        copyBindingsRestored: bindingsRestored,
        phase: "resolve",
      });
      return;
    }

    state.captureCounts.set(adoptionKey, captureIndex);
    pruneAdoptionKeys(state, adoptionKey);
    const epoch = state.epoch;
    const scheduledAt = performance.now();
    const copy = {
      allocated,
      bindingsRestored,
      blitDurationMs: rounded(blitFinishedAt - copyStartedAt),
      bufferBytes: width * height * 4,
      durationMs: rounded(copyFinishedAt - copyStartedAt),
      geometrySnapshotMs: rounded(
        geometryFinishedAt - geometryStartedAt,
      ),
      setupMs: rounded(setupMs),
      synchronousCaptureMs: rounded(
        copyFinishedAt - captureStartedAt,
      ),
    };
    window.requestAnimationFrame(() => {
      const animationFrameAt = performance.now();
      window.setTimeout(() => {
        try {
          finishCapture(
            context,
            state,
            epoch,
            target,
            canvas,
            geometry,
            traceDetails,
            adoptionKey,
            captureIndex,
            captureMoment,
            copy,
            scheduledAt,
            animationFrameAt,
          );
        } catch (error) {
          releaseCaptureTarget(
            context,
            state,
            target,
            adoptionKey,
            true,
          );
          safeTrace("canvas:alpha-capture-failed", {
            ...traceDetails,
            adoptionKey,
            captureIndex,
            error: error instanceof Error ? error.message : String(error),
            phase: "deferred-unexpected",
          });
        }
      }, 0);
    });
    reservedTarget = null;
  } catch (error) {
    if (
      reservedTarget &&
      captureContext &&
      captureState &&
      captureAdoptionKey
    ) {
      releaseCaptureTarget(
        captureContext,
        captureState,
        reservedTarget,
        captureAdoptionKey,
        true,
      );
    }
    if (captureState && captureAdoptionKey) {
      blockAdoption(captureState, captureAdoptionKey);
    }
    safeTrace("canvas:alpha-capture-failed", {
      ...traceDetails,
      error: error instanceof Error ? error.message : String(error),
      phase: "unexpected",
    });
  }
}
