"use client";

import type { SceneId } from "./types";

export interface SceneRuntimeTraceEntry {
  readonly at: number;
  readonly details: Readonly<Record<string, unknown>>;
  readonly path: string;
  readonly phase: string;
  readonly sequence: number;
}

declare global {
  interface Window {
    __enableSceneRuntimeTrace?: boolean;
    __sceneRuntimeTrace?: SceneRuntimeTraceEntry[];
  }
}

const TRACE_QUERY_KEY = "sceneTrace";
const TRACE_LIMIT = 1_000;
let traceLatched = false;
let lastEvaluatedSearch: string | null = null;
let traceSequence = 0;

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function rectSnapshot(rect: DOMRect) {
  return {
    height: rounded(rect.height),
    width: rounded(rect.width),
    x: rounded(rect.x),
    y: rounded(rect.y),
  };
}

function visibilitySnapshot(element: Element | null) {
  if (!(element instanceof HTMLElement)) return null;
  const style = window.getComputedStyle(element);
  return {
    display: style.display,
    opacity: style.opacity,
    visibility: style.visibility,
  };
}

function imageSnapshot(element: Element | null) {
  if (!(element instanceof HTMLImageElement)) return null;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const heightScale =
    element.naturalHeight > 0 ? rect.height / element.naturalHeight : null;
  const widthScale =
    element.naturalWidth > 0 ? rect.width / element.naturalWidth : null;
  const coverScale =
    heightScale !== null && widthScale !== null
      ? Math.max(heightScale, widthScale)
      : null;
  return {
    coverToVerticalScale:
      coverScale !== null && heightScale
        ? rounded(coverScale / heightScale)
        : null,
    currentSrc: element.currentSrc,
    heightScale: heightScale === null ? null : rounded(heightScale),
    naturalHeight: element.naturalHeight,
    naturalWidth: element.naturalWidth,
    objectFit: style.objectFit,
    objectPosition: style.objectPosition,
    rect: rectSnapshot(rect),
    widthScale: widthScale === null ? null : rounded(widthScale),
  };
}

export function sceneRuntimeTraceEnabled() {
  if (typeof window === "undefined") return false;
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

export function traceSceneRuntime(
  phase: string,
  details: Readonly<Record<string, unknown>> = {},
) {
  if (!sceneRuntimeTraceEnabled()) return;

  const serialized = JSON.stringify({
    at: rounded(performance.now()),
    details,
    path: window.location.pathname,
    phase,
    sequence: (traceSequence += 1),
  });
  const entry = JSON.parse(serialized) as SceneRuntimeTraceEntry;
  const trace = window.__sceneRuntimeTrace ?? [];
  trace.push(entry);
  if (trace.length > TRACE_LIMIT) {
    trace.splice(0, trace.length - TRACE_LIMIT);
  }
  window.__sceneRuntimeTrace = trace;
  console.log(`[scene-runtime-trace] ${serialized}`);
}

export function traceSceneStageSnapshot(
  phase: string,
  stage: HTMLElement,
  details: Readonly<Record<string, unknown>> = {},
) {
  if (!sceneRuntimeTraceEnabled()) return;

  const canvas = stage.querySelector("canvas");
  const runtime = stage.querySelector<HTMLElement>("[data-three-status]");
  const section = stage.parentElement?.closest<HTMLElement>("[data-scene-id]");
  const outerPoster = section?.querySelector(
    ":scope > .scene-section__poster",
  );
  const runtimePoster = runtime?.querySelector(".scene-runtime__poster");
  const outerPosterImage = outerPoster?.querySelector("img");
  const runtimePosterImage = runtimePoster?.querySelector("img");
  const stageRect = stage.getBoundingClientRect();
  const canvasContainer = canvas?.parentElement ?? null;

  traceSceneRuntime(phase, {
    ...details,
    canvas:
      canvas instanceof HTMLCanvasElement
        ? {
            bufferHeight: canvas.height,
            bufferWidth: canvas.width,
            className: canvas.className,
            containerRect: canvasContainer
              ? rectSnapshot(canvasContainer.getBoundingClientRect())
              : null,
            rect: rectSnapshot(canvas.getBoundingClientRect()),
            style: visibilitySnapshot(canvas),
          }
        : null,
    documentVisibility: document.visibilityState,
    matchesMobileMedia: window.matchMedia("(max-width: 767px)").matches,
    currentAdoptionVersion: stage.dataset.sceneAdoptionVersion ?? null,
    ownerSceneId: stage.dataset.sceneOwnerId ?? null,
    parentSceneId: section?.dataset.sceneId ?? null,
    poolState: stage.dataset.scenePoolState ?? null,
    runtimePoster: {
      image: imageSnapshot(runtimePosterImage ?? null),
      style: visibilitySnapshot(runtimePoster ?? null),
    },
    runtimeStatus: runtime?.dataset.threeStatus ?? null,
    renderedAdoptionVersion:
      stage.dataset.sceneRenderedAdoptionVersion ?? null,
    sectionActive: section?.dataset.sceneActive ?? null,
    sectionPoster: {
      image: imageSnapshot(outerPosterImage ?? null),
      style: visibilitySnapshot(outerPoster ?? null),
    },
    stageConnected: stage.isConnected,
    stageIntersectsViewport:
      stageRect.bottom > 0 &&
      stageRect.right > 0 &&
      stageRect.top < window.innerHeight &&
      stageRect.left < window.innerWidth,
    stageRect: rectSnapshot(stageRect),
    viewport: {
      devicePixelRatio: window.devicePixelRatio,
      height: window.innerHeight,
      visualHeight: window.visualViewport
        ? rounded(window.visualViewport.height)
        : null,
      visualScale: window.visualViewport?.scale ?? null,
      visualWidth: window.visualViewport
        ? rounded(window.visualViewport.width)
        : null,
      width: window.innerWidth,
    },
  });
}

export function traceSceneStageTimeline(
  phase: string,
  stage: HTMLElement,
  details: Readonly<Record<string, unknown>> = {},
) {
  if (!sceneRuntimeTraceEnabled()) return;

  traceSceneStageSnapshot(`${phase}:sync`, stage, details);
  queueMicrotask(() => {
    traceSceneStageSnapshot(`${phase}:microtask`, stage, details);
  });
  requestAnimationFrame(() => {
    traceSceneStageSnapshot(`${phase}:raf-1`, stage, details);
    requestAnimationFrame(() => {
      traceSceneStageSnapshot(`${phase}:raf-2`, stage, details);
    });
  });
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
