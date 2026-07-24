"use client";

import {
  sceneRuntimeTraceEnabled,
  traceSceneRuntime,
  type SceneRuntimeTraceMoment,
} from "./scene-runtime-trace-core";

export {
  captureSceneRuntimeTraceMoment,
  compareSceneRenderTraceCoherence,
  sceneRuntimeTraceEnabled,
  sceneTraceIdentity,
  traceSceneRuntime,
  type SceneRenderTraceCoherence,
  type SceneRenderTraceIdentity,
  type SceneRuntimeTraceEntry,
  type SceneRuntimeTraceMoment,
} from "./scene-runtime-trace-core";

const HERO_TRACE_FRAME_COUNT = 12;
// Trace-only silhouette comparisons need pixel-level agreement with the
// authored 1920x1080 and 585x1266 hero posters. Keep their native resolution
// instead of introducing several CSS pixels of uncertainty by downsampling.
const POSTER_ALPHA_SAMPLE_LIMIT = 2_048;
const TRACE_RESIZE_SELECTORS = [
  ".site-shell",
  ".site-shell__content",
  ".page-hero",
  ".page-hero__copy",
  ".page-hero h1",
  ".page-hero > .scene-stage--resident",
  ".page-hero .scene-runtime",
  ".page-hero .scene-runtime__poster",
  ".page-hero .scene-runtime__poster img",
  ".page-hero .scene-runtime__canvas",
  ".page-hero .scene-runtime__resident-canvas",
  ".page-hero canvas",
  ".page-hero > .scene-section__poster",
  ".page-hero > .scene-section__poster img",
].join(",");
function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function roundedRatio(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function rectSnapshot(
  rect: Pick<DOMRectReadOnly, "height" | "width" | "x" | "y">,
) {
  return {
    height: rounded(rect.height),
    width: rounded(rect.width),
    x: rounded(rect.x),
    y: rounded(rect.y),
  };
}

function styleSnapshot(element: Element | null) {
  if (!(element instanceof Element)) return null;
  const style = window.getComputedStyle(element);
  return {
    backgroundColor: style.backgroundColor,
    bottom: style.bottom,
    clipPath: style.clipPath,
    color: style.color,
    contain: style.contain,
    boxSizing: style.boxSizing,
    display: style.display,
    flex: style.flex,
    filter: style.filter,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    height: style.height,
    inset: style.inset,
    isolation: style.isolation,
    left: style.left,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    margin: style.margin,
    maxHeight: style.maxHeight,
    maxWidth: style.maxWidth,
    mixBlendMode: style.mixBlendMode,
    minHeight: style.minHeight,
    minWidth: style.minWidth,
    opacity: style.opacity,
    objectFit: style.objectFit,
    objectPosition: style.objectPosition,
    overflow: style.overflow,
    padding: style.padding,
    perspective: style.perspective,
    pointerEvents: style.pointerEvents,
    position: style.position,
    right: style.right,
    rotate: style.getPropertyValue("rotate"),
    scale: style.getPropertyValue("scale"),
    textAlign: style.textAlign,
    top: style.top,
    transform: style.transform,
    transformOrigin: style.transformOrigin,
    translate: style.getPropertyValue("translate"),
    visibility: style.visibility,
    width: style.width,
    willChange: style.willChange,
    zIndex: style.zIndex,
  };
}

function elementIdentity(element: Element | null) {
  if (!(element instanceof Element)) return null;
  return {
    className: element.getAttribute("class") ?? "",
    id: element.id || null,
    sceneId:
      element instanceof HTMLElement
        ? element.dataset.sceneId ??
          element.dataset.sceneFor ??
          element.dataset.sceneOwnerId ??
          null
        : null,
    tagName: element.tagName.toLowerCase(),
  };
}

function stackingContextReasons(
  element: Element,
  style: CSSStyleDeclaration,
) {
  const reasons: string[] = [];
  if (element === document.documentElement) reasons.push("root");
  if (style.position === "fixed" || style.position === "sticky") {
    reasons.push(`position:${style.position}`);
  }
  if (
    style.zIndex !== "auto" &&
    ["absolute", "fixed", "relative", "sticky"].includes(style.position)
  ) {
    reasons.push(`positioned-z-index:${style.zIndex}`);
  }
  if (Number.parseFloat(style.opacity) < 1) reasons.push("opacity");
  if (style.transform !== "none") reasons.push("transform");
  if (style.filter !== "none") reasons.push("filter");
  if (style.perspective !== "none") reasons.push("perspective");
  if (style.isolation === "isolate") reasons.push("isolation");
  if (style.mixBlendMode !== "normal") reasons.push("mix-blend-mode");
  if (/(layout|paint|strict|content)/.test(style.contain)) {
    reasons.push(`contain:${style.contain}`);
  }
  if (/(transform|opacity|filter|perspective)/.test(style.willChange)) {
    reasons.push(`will-change:${style.willChange}`);
  }
  return reasons;
}

function stackingAncestorSnapshot(element: Element) {
  const ancestors = [];
  let current = element.parentElement;
  while (current && ancestors.length < 16) {
    const style = window.getComputedStyle(current);
    const reasons = stackingContextReasons(current, style);
    if (reasons.length > 0) {
      ancestors.push({
        ...elementIdentity(current),
        reasons,
        rect: rectSnapshot(current.getBoundingClientRect()),
        style: {
          contain: style.contain,
          filter: style.filter,
          isolation: style.isolation,
          mixBlendMode: style.mixBlendMode,
          opacity: style.opacity,
          position: style.position,
          transform: style.transform,
          willChange: style.willChange,
          zIndex: style.zIndex,
        },
      });
    }
    current = current.parentElement;
  }
  return ancestors;
}

function elementSnapshot(element: Element | null) {
  if (!(element instanceof Element)) return null;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const parent = element.parentElement;
  const checkVisibility =
    "checkVisibility" in element &&
    typeof element.checkVisibility === "function"
      ? element.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })
      : null;
  return {
    ...elementIdentity(element),
    childIndex: parent ? Array.from(parent.children).indexOf(element) : null,
    dataset:
      element instanceof HTMLElement ? { ...element.dataset } : undefined,
    offsetParent:
      element instanceof HTMLElement
        ? elementIdentity(element.offsetParent)
        : null,
    parent: elementIdentity(parent),
    rect: rectSnapshot(rect),
    checkVisibility,
    intersectsViewport:
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth,
    stackingAncestors: stackingAncestorSnapshot(element),
    stackingContextReasons: stackingContextReasons(element, style),
    style: styleSnapshot(element),
    text:
      element.matches("h1")
        ? element.textContent?.trim().slice(0, 120) ?? ""
        : undefined,
    visible:
      checkVisibility !== false &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0,
  };
}

function pointStackSnapshot(x: number, y: number) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x > window.innerWidth ||
    y > window.innerHeight
  ) {
    return null;
  }
  return {
    elements: document
      .elementsFromPoint(x, y)
      .slice(0, 16)
      .map((element) => ({
        ...elementIdentity(element),
        position: getComputedStyle(element).position,
        zIndex: getComputedStyle(element).zIndex,
      })),
    x: rounded(x),
    y: rounded(y),
  };
}

function elementCenterStackSnapshot(element: Element | null) {
  if (!(element instanceof Element)) return null;
  const rect = element.getBoundingClientRect();
  return pointStackSnapshot(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
}

function viewportSnapshot() {
  const matchesMedia = (query: string) =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : null;
  return {
    devicePixelRatio: window.devicePixelRatio,
    height: window.innerHeight,
    matchesMobileMedia: matchesMedia("(max-width: 767px)"),
    orientation: window.screen.orientation?.type ?? null,
    reducedMotion: matchesMedia("(prefers-reduced-motion: reduce)"),
    scrollX: rounded(window.scrollX),
    scrollY: rounded(window.scrollY),
    visualHeight: window.visualViewport
      ? rounded(window.visualViewport.height)
      : null,
    visualOffsetLeft: window.visualViewport
      ? rounded(window.visualViewport.offsetLeft)
      : null,
    visualOffsetTop: window.visualViewport
      ? rounded(window.visualViewport.offsetTop)
      : null,
    visualScale: window.visualViewport?.scale ?? null,
    visualWidth: window.visualViewport
      ? rounded(window.visualViewport.width)
      : null,
    width: window.innerWidth,
  };
}

function heroSnapshot(section: HTMLElement | null) {
  if (!section) return null;
  const stage = section.querySelector<HTMLElement>(
    ":scope > .scene-stage--resident",
  );
  const runtime = stage?.querySelector<HTMLElement>("[data-three-status]");
  const outerPoster = section.querySelector<HTMLElement>(
    ":scope > .scene-section__poster",
  );
  const runtimePoster =
    runtime?.querySelector<HTMLElement>(".scene-runtime__poster") ?? null;
  const runtimePosterImage =
    runtimePoster?.querySelector<HTMLImageElement>("img") ?? null;
  const outerPosterImage =
    outerPoster?.querySelector<HTMLImageElement>("img") ?? null;
  const canvasContainer =
    runtime?.querySelector<HTMLElement>(
      ":is(.scene-runtime__canvas, .scene-runtime__resident-canvas)",
    ) ?? null;
  const canvas = canvasContainer?.querySelector("canvas") ?? null;
  const content = section.querySelector<HTMLElement>(
    ":scope > .scene-section__content",
  );
  const copy = section.querySelector<HTMLElement>(".page-hero__copy");
  const heading = copy?.querySelector("h1") ?? null;
  const headingRect = heading?.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  const stageRect = stage?.getBoundingClientRect() ?? null;
  const outerPosterImageRect =
    outerPosterImage?.getBoundingClientRect() ?? null;
  const runtimePosterImageRect =
    runtimePosterImage?.getBoundingClientRect() ?? null;
  const sourceVisibility = {
    canvas: elementSnapshot(canvas)?.visible ?? false,
    outerPoster: elementSnapshot(outerPoster)?.visible ?? false,
    runtimePoster: elementSnapshot(runtimePoster)?.visible ?? false,
  };
  const geometryDelta = (rect: DOMRect | null) =>
    rect && stageRect
      ? {
          centerX:
            rounded(rect.left + rect.width / 2) -
            rounded(stageRect.left + stageRect.width / 2),
          centerY:
            rounded(rect.top + rect.height / 2) -
            rounded(stageRect.top + stageRect.height / 2),
          height: rounded(rect.height - stageRect.height),
          left: rounded(rect.left - stageRect.left),
          top: rounded(rect.top - stageRect.top),
          width: rounded(rect.width - stageRect.width),
        }
      : null;

  return {
    childOrder: Array.from(section.children).map(elementIdentity),
    fontStatus: "fonts" in document ? document.fonts.status : null,
    layers: {
      canvas: elementSnapshot(canvas),
      canvasContainer: elementSnapshot(canvasContainer),
      content: elementSnapshot(content),
      copy: elementSnapshot(copy),
      heading: elementSnapshot(heading),
      outerPoster: elementSnapshot(outerPoster),
      outerPosterImage: elementSnapshot(outerPosterImage),
      runtime: elementSnapshot(runtime ?? null),
      runtimePoster: elementSnapshot(runtimePoster),
      runtimePosterImage: elementSnapshot(runtimePosterImage),
      scrollCue: elementSnapshot(
        section.querySelector(".scroll-cue"),
      ),
      section: elementSnapshot(section),
      stage: elementSnapshot(stage ?? null),
      wash: elementSnapshot(section.querySelector(".page-hero__wash")),
    },
    hitTestStacks: {
      canvasCenter: elementCenterStackSnapshot(canvas),
      headingCenter: headingRect
        ? pointStackSnapshot(
            headingRect.left + headingRect.width / 2,
            headingRect.top + headingRect.height / 2,
          )
        : null,
      heroCenter: pointStackSnapshot(
        sectionRect.left + sectionRect.width / 2,
        sectionRect.top + sectionRect.height / 2,
      ),
      outerPosterCenter: elementCenterStackSnapshot(outerPosterImage),
      runtimePosterCenter: elementCenterStackSnapshot(runtimePosterImage),
      stageCenter: elementCenterStackSnapshot(stage ?? null),
      viewportCenter: pointStackSnapshot(
        window.innerWidth / 2,
        window.innerHeight / 2,
      ),
    },
    posterGeometry: {
      outerImageToStage: geometryDelta(outerPosterImageRect),
      runtimeImageToStage: geometryDelta(runtimePosterImageRect),
    },
    posterSilhouettes: {
      outer: posterSilhouetteSnapshot(
        outerPosterImage ?? null,
        stage ?? null,
      ),
      runtime: posterSilhouetteSnapshot(
        runtimePosterImage ?? null,
        stage ?? null,
      ),
    },
    route: {
      pathname: window.location.pathname,
      shell: elementSnapshot(document.querySelector(".site-shell")),
    },
    sceneId: section.dataset.sceneId ?? null,
    visibleSources: Object.entries(sourceVisibility)
      .filter(([, visible]) => visible)
      .map(([name]) => name),
    viewport: viewportSnapshot(),
  };
}

function activeHeroSection() {
  return (
    document.querySelector<HTMLElement>(
      '.page-hero[data-scene-active="true"]',
    ) ?? document.querySelector<HTMLElement>(".page-hero")
  );
}

function heroSections() {
  return Array.from(document.querySelectorAll<HTMLElement>(".page-hero"));
}

function compactHeroSnapshot(section: HTMLElement | null) {
  if (!section) return null;
  const stage = section.querySelector<HTMLElement>(
    ":scope > .scene-stage--resident",
  );
  const runtime = stage?.querySelector<HTMLElement>("[data-three-status]");
  const canvas = stage?.querySelector("canvas") ?? null;
  const outerPoster = section.querySelector<HTMLElement>(
    ":scope > .scene-section__poster",
  );
  const runtimePoster =
    runtime?.querySelector<HTMLElement>(".scene-runtime__poster") ?? null;
  const outerPosterImage =
    outerPoster?.querySelector<HTMLImageElement>("img") ?? null;
  const runtimePosterImage =
    runtimePoster?.querySelector<HTMLImageElement>("img") ?? null;
  return {
    active: section.dataset.sceneActive ?? null,
    layers: {
      canvas: compactElementSnapshot(canvas),
      copy: compactElementSnapshot(
        section.querySelector(".page-hero__copy"),
      ),
      outerPoster: compactElementSnapshot(outerPoster),
      runtimePoster: compactElementSnapshot(runtimePoster),
      section: compactElementSnapshot(section),
      stage: compactElementSnapshot(stage ?? null),
    },
    lastRenderedTelemetrySequence:
      stage?.dataset.sceneLastRenderSequence ?? null,
    pathname: window.location.pathname,
    posterSilhouettes: {
      outer: posterSilhouetteSnapshot(
        outerPosterImage,
        stage ?? null,
      ),
      runtime: posterSilhouetteSnapshot(
        runtimePosterImage,
        stage ?? null,
      ),
    },
    sceneId: section.dataset.sceneId ?? null,
    stageState: {
      adoptionVersion: stage?.dataset.sceneAdoptionVersion ?? null,
      ownerSceneId: stage?.dataset.sceneOwnerId ?? null,
      poolState: stage?.dataset.scenePoolState ?? null,
      renderedAdoptionVersion:
        stage?.dataset.sceneRenderedAdoptionVersion ?? null,
      runtimeStatus: runtime?.dataset.threeStatus ?? null,
    },
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

function compactElementSnapshot(element: Element | null) {
  if (!(element instanceof Element)) return null;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    ...elementIdentity(element),
    opacity: style.opacity,
    position: style.position,
    rect: rectSnapshot(rect),
    transform: style.transform,
    visibility: style.visibility,
    visible:
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0,
    zIndex: style.zIndex,
  };
}

export function snapshotSceneCanvasDom(canvas: HTMLCanvasElement) {
  const container = canvas.parentElement;
  const stage = canvas.closest<HTMLElement>("[data-scene-resident-stage]");
  const runtime = canvas.closest<HTMLElement>("[data-three-status]");
  const section = stage?.parentElement?.closest<HTMLElement>(
    "[data-scene-id]",
  );
  const copy =
    section?.querySelector<HTMLElement>(".page-hero__copy") ?? null;
  const outerPoster =
    section?.querySelector<HTMLElement>(
      ":scope > .scene-section__poster",
    ) ?? null;
  const runtimePoster =
    runtime?.querySelector<HTMLElement>(".scene-runtime__poster") ?? null;
  const outerPosterImage =
    outerPoster?.querySelector<HTMLImageElement>("img") ?? null;
  const runtimePosterImage =
    runtimePoster?.querySelector<HTMLImageElement>("img") ?? null;
  return {
    canvas: compactElementSnapshot(canvas),
    container: compactElementSnapshot(container),
    copy: compactElementSnapshot(copy),
    documentVisibility: document.visibilityState,
    lastRenderedTelemetrySequence:
      stage?.dataset.sceneLastRenderSequence ?? null,
    outerPoster: compactElementSnapshot(outerPoster),
    posterSilhouettes: {
      outer: posterSilhouetteSnapshot(outerPosterImage, stage),
      runtime: posterSilhouetteSnapshot(runtimePosterImage, stage),
    },
    runtime: compactElementSnapshot(runtime),
    runtimePoster: compactElementSnapshot(runtimePoster),
    section: compactElementSnapshot(section ?? null),
    stage: compactElementSnapshot(stage ?? null),
    state: {
      activeSceneId: runtime?.dataset.activeSceneId ?? null,
      adoptionVersion: stage?.dataset.sceneAdoptionVersion ?? null,
      ownerSceneId: stage?.dataset.sceneOwnerId ?? null,
      parentSceneId: section?.dataset.sceneId ?? null,
      poolState: stage?.dataset.scenePoolState ?? null,
      renderedAdoptionVersion:
        stage?.dataset.sceneRenderedAdoptionVersion ?? null,
      runtimeActive: runtime?.dataset.sceneActive ?? null,
      runtimeStatus: runtime?.dataset.threeStatus ?? null,
      sectionActive: section?.dataset.sceneActive ?? null,
    },
    viewport: viewportSnapshot(),
  };
}

export interface ScenePosterAlphaSample {
  readonly alphaCoverage: number;
  readonly normalized: {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  } | null;
  readonly sampleHeight: number;
  readonly sampleWidth: number;
}

export interface FrozenScenePosterGeometry {
  readonly imageRect: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
  readonly source: string;
  readonly stageRect: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
}

const posterAlphaSamplesBySource = new Map<
  string,
  ScenePosterAlphaSample
>();

function posterSourceKey(image: HTMLImageElement) {
  return image.currentSrc || image.src;
}

function freezeScenePosterGeometry(
  image: HTMLImageElement | null,
  stage: HTMLElement | null,
) {
  if (!image || !stage) return null;
  return {
    imageRect: rectSnapshot(image.getBoundingClientRect()),
    source: posterSourceKey(image),
    stageRect: rectSnapshot(stage.getBoundingClientRect()),
  } satisfies FrozenScenePosterGeometry;
}

export function resolveFrozenScenePosterSilhouette(
  geometry: FrozenScenePosterGeometry | null,
) {
  if (!geometry) return null;
  const sample = posterAlphaSamplesBySource.get(geometry.source);
  if (!sample) return null;
  return projectFrozenScenePosterSilhouette(geometry, sample);
}

export function projectFrozenScenePosterSilhouette(
  geometry: FrozenScenePosterGeometry,
  sample: ScenePosterAlphaSample,
) {
  const { imageRect, stageRect } = geometry;
  const viewportBounds = sample.normalized
    ? {
        bottom: rounded(
          imageRect.y + sample.normalized.bottom * imageRect.height,
        ),
        centerX: rounded(
          imageRect.x +
            ((sample.normalized.left + sample.normalized.right) / 2) *
              imageRect.width,
        ),
        centerY: rounded(
          imageRect.y +
            ((sample.normalized.top + sample.normalized.bottom) / 2) *
              imageRect.height,
        ),
        left: rounded(
          imageRect.x + sample.normalized.left * imageRect.width,
        ),
        right: rounded(
          imageRect.x + sample.normalized.right * imageRect.width,
        ),
        top: rounded(
          imageRect.y + sample.normalized.top * imageRect.height,
        ),
      }
    : null;
  return {
    ...sample,
    imageRect,
    source: geometry.source,
    stageCenterDelta: viewportBounds
      ? {
          x: rounded(
            viewportBounds.centerX -
              (stageRect.x + stageRect.width / 2),
          ),
          y: rounded(
            viewportBounds.centerY -
              (stageRect.y + stageRect.height / 2),
          ),
        }
      : null,
    viewportBounds,
  };
}

function posterSilhouetteSnapshot(
  image: HTMLImageElement | null,
  stage: HTMLElement | null,
) {
  return resolveFrozenScenePosterSilhouette(
    freezeScenePosterGeometry(image, stage),
  );
}

export function snapshotSceneAlphaGeometry(canvas: HTMLCanvasElement) {
  const stage = canvas.closest<HTMLElement>("[data-scene-resident-stage]");
  const section = stage?.parentElement?.closest<HTMLElement>(
    "[data-scene-id]",
  );
  const runtime = canvas.closest<HTMLElement>("[data-three-status]");
  const outerPosterImage =
    section
      ?.querySelector<HTMLElement>(":scope > .scene-section__poster")
      ?.querySelector<HTMLImageElement>("img") ?? null;
  const runtimePosterImage =
    runtime
      ?.querySelector<HTMLElement>(".scene-runtime__poster")
      ?.querySelector<HTMLImageElement>("img") ?? null;
  const posterGeometry = {
    outer: freezeScenePosterGeometry(outerPosterImage, stage ?? null),
    runtime: freezeScenePosterGeometry(runtimePosterImage, stage ?? null),
  };

  return {
    canvasRect: rectSnapshot(canvas.getBoundingClientRect()),
    posterGeometry,
    posterSilhouettes: {
      outer: resolveFrozenScenePosterSilhouette(posterGeometry.outer),
      runtime: resolveFrozenScenePosterSilhouette(posterGeometry.runtime),
    },
    stageRect: stage
      ? rectSnapshot(stage.getBoundingClientRect())
      : null,
    state: {
      adoptionVersion: stage?.dataset.sceneAdoptionVersion ?? null,
      ownerSceneId: stage?.dataset.sceneOwnerId ?? null,
      poolKey: stage?.dataset.scenePoolKey ?? null,
      poolState: stage?.dataset.scenePoolState ?? null,
      renderedAdoptionVersion:
        stage?.dataset.sceneRenderedAdoptionVersion ?? null,
    },
  };
}

export function traceScenePosterAlphaBounds(
  image: HTMLImageElement,
  stage: HTMLElement,
  details: Readonly<Record<string, unknown>> = {},
) {
  if (
    !sceneRuntimeTraceEnabled() ||
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0
  ) {
    return;
  }

  try {
    const source = posterSourceKey(image);
    if (!posterAlphaSamplesBySource.has(source)) {
      const sampleScale = Math.min(
        1,
        POSTER_ALPHA_SAMPLE_LIMIT /
          Math.max(image.naturalWidth, image.naturalHeight),
      );
      const sampleWidth = Math.max(
        1,
        Math.round(image.naturalWidth * sampleScale),
      );
      const sampleHeight = Math.max(
        1,
        Math.round(image.naturalHeight * sampleScale),
      );
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      const context = sampleCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (!context) throw new Error("2D canvas context unavailable");
      context.clearRect(0, 0, sampleWidth, sampleHeight);
      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      const pixels = context.getImageData(
        0,
        0,
        sampleWidth,
        sampleHeight,
      ).data;
      let alphaPixels = 0;
      let minX = sampleWidth;
      let minY = sampleHeight;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < sampleHeight; y += 1) {
        for (let x = 0; x < sampleWidth; x += 1) {
          if (pixels[(y * sampleWidth + x) * 4 + 3] <= 8) continue;
          alphaPixels += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      posterAlphaSamplesBySource.set(source, {
        alphaCoverage: roundedRatio(
          alphaPixels / Math.max(1, sampleWidth * sampleHeight),
        ),
        normalized:
          maxX >= minX && maxY >= minY
            ? {
                bottom: roundedRatio((maxY + 1) / sampleHeight),
                left: roundedRatio(minX / sampleWidth),
                right: roundedRatio((maxX + 1) / sampleWidth),
                top: roundedRatio(minY / sampleHeight),
              }
            : null,
        sampleHeight,
        sampleWidth,
      });
    }

    traceSceneStageSnapshot("poster:alpha-bounds", stage, {
      ...details,
      posterSilhouette: posterSilhouetteSnapshot(image, stage),
    });
  } catch (error) {
    traceSceneStageSnapshot("poster:alpha-bounds-error", stage, {
      ...details,
      error: error instanceof Error ? error.message : String(error),
      image: imageSnapshot(image),
    });
  }
}

export function snapshotSceneStage(stage: HTMLElement) {
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

  return {
    canvas:
      canvas instanceof HTMLCanvasElement
        ? {
            bufferHeight: canvas.height,
            bufferWidth: canvas.width,
            className: canvas.className,
            containerRect: canvasContainer
              ? rectSnapshot(canvasContainer.getBoundingClientRect())
              : null,
            element: elementSnapshot(canvas),
            rect: rectSnapshot(canvas.getBoundingClientRect()),
            style: styleSnapshot(canvas),
          }
        : null,
    documentVisibility: document.visibilityState,
    hero: section?.matches(".page-hero") ? heroSnapshot(section) : null,
    lastRenderedTelemetrySequence:
      stage.dataset.sceneLastRenderSequence ?? null,
    matchesMobileMedia:
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 767px)").matches
        : null,
    currentAdoptionVersion: stage.dataset.sceneAdoptionVersion ?? null,
    ownerSceneId: stage.dataset.sceneOwnerId ?? null,
    parentSceneId: section?.dataset.sceneId ?? null,
    poolState: stage.dataset.scenePoolState ?? null,
    posterSilhouettes: {
      outer: posterSilhouetteSnapshot(
        outerPosterImage instanceof HTMLImageElement
          ? outerPosterImage
          : null,
        stage,
      ),
      runtime: posterSilhouetteSnapshot(
        runtimePosterImage instanceof HTMLImageElement
          ? runtimePosterImage
          : null,
        stage,
      ),
    },
    runtimePoster: {
      element: elementSnapshot(runtimePoster ?? null),
      image: imageSnapshot(runtimePosterImage ?? null),
      style: styleSnapshot(runtimePoster ?? null),
    },
    runtimeElement: elementSnapshot(runtime ?? null),
    runtimeStatus: runtime?.dataset.threeStatus ?? null,
    renderedAdoptionVersion:
      stage.dataset.sceneRenderedAdoptionVersion ?? null,
    sectionActive: section?.dataset.sceneActive ?? null,
    sectionElement: elementSnapshot(section ?? null),
    sectionPoster: {
      element: elementSnapshot(outerPoster ?? null),
      image: imageSnapshot(outerPosterImage ?? null),
      style: styleSnapshot(outerPoster ?? null),
    },
    stageConnected: stage.isConnected,
    stageElement: elementSnapshot(stage),
    stageIntersectsViewport:
      stageRect.bottom > 0 &&
      stageRect.right > 0 &&
      stageRect.top < window.innerHeight &&
      stageRect.left < window.innerWidth,
    stageRect: rectSnapshot(stageRect),
    viewport: viewportSnapshot(),
  };
}

export function traceSceneStageSnapshot(
  phase: string,
  stage: HTMLElement,
  details: Readonly<Record<string, unknown>> = {},
  moment?: SceneRuntimeTraceMoment,
) {
  if (!sceneRuntimeTraceEnabled()) return;

  traceSceneRuntime(phase, {
    ...details,
    ...snapshotSceneStage(stage),
  }, moment);
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

export function traceActiveHeroSnapshot(
  phase: string,
  details: Readonly<Record<string, unknown>> = {},
) {
  if (!sceneRuntimeTraceEnabled()) return;
  traceSceneRuntime(phase, {
    ...details,
    hero: heroSnapshot(activeHeroSection()),
    heroCandidates: heroSections().map(heroSnapshot),
    viewport: viewportSnapshot(),
  });
}

function traceActiveHeroFrameSnapshot(
  phase: string,
  details: Readonly<Record<string, unknown>> = {},
) {
  if (!sceneRuntimeTraceEnabled()) return;
  traceSceneRuntime(phase, {
    ...details,
    hero: compactHeroSnapshot(activeHeroSection()),
    heroCandidates: heroSections().map(compactHeroSnapshot),
    viewport: viewportSnapshot(),
  });
}

export function reconcileSceneRuntimeTraceResizeTargets(
  resizeObserver: Pick<ResizeObserver, "observe" | "unobserve"> | null,
  observedTargets: Set<Element>,
  candidates: Iterable<Element>,
) {
  const connectedCandidates = new Set(
    Array.from(candidates).filter((element) => element.isConnected),
  );
  for (const element of observedTargets) {
    if (connectedCandidates.has(element)) continue;
    resizeObserver?.unobserve(element);
    observedTargets.delete(element);
  }
  for (const element of connectedCandidates) {
    if (observedTargets.has(element)) continue;
    observedTargets.add(element);
    resizeObserver?.observe(element);
  }
}

export function releaseSceneRuntimeTraceResizeTargets(
  resizeObserver: Pick<ResizeObserver, "unobserve"> | null,
  observedTargets: Set<Element>,
) {
  for (const element of observedTargets) {
    resizeObserver?.unobserve(element);
  }
  observedTargets.clear();
}

export function installSceneRuntimeTraceObservers() {
  if (!sceneRuntimeTraceEnabled() || typeof document === "undefined") return;
  if (window.__sceneRuntimeTraceObserverCleanup) return;

  let animationFrameId: number | null = null;
  let burstFrame = 0;
  let burstId = 0;
  let remainingFrames = 0;
  const burstReasons = new Set<string>();
  const observedResizeTargets = new Set<Element>();

  const runFrameBurst = () => {
    animationFrameId = null;
    burstFrame += 1;
    traceActiveHeroFrameSnapshot("observer:animation-frame", {
      burstFrame,
      burstId,
      reasons: [...burstReasons],
    });
    remainingFrames -= 1;
    if (remainingFrames > 0) {
      animationFrameId = requestAnimationFrame(runFrameBurst);
      return;
    }
    burstReasons.clear();
  };

  const scheduleFrameBurst = (reason: string) => {
    burstReasons.add(reason);
    remainingFrames = Math.max(remainingFrames, HERO_TRACE_FRAME_COUNT);
    if (animationFrameId !== null) return;
    burstId += 1;
    burstFrame = 0;
    animationFrameId = requestAnimationFrame(runFrameBurst);
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
    traceActiveHeroSnapshot("observer:resize", {
      entries: entries.map((entry) => ({
        borderBox: (() => {
          const raw = entry.borderBoxSize;
          const sizes = Array.isArray(raw)
            ? raw
            : raw
              ? [raw as unknown as ResizeObserverSize]
              : [];
          return sizes.map((size) => ({
            blockSize: rounded(size.blockSize),
            inlineSize: rounded(size.inlineSize),
          }));
        })(),
        contentRect: rectSnapshot(entry.contentRect),
        target: compactElementSnapshot(entry.target),
      })),
    });
    scheduleFrameBurst("resize-observer");
      });

  const refreshResizeTargets = () => {
    reconcileSceneRuntimeTraceResizeTargets(
      resizeObserver,
      observedResizeTargets,
      document.querySelectorAll(TRACE_RESIZE_SELECTORS),
    );
  };

  const mutationObserver = new MutationObserver((records) => {
    traceActiveHeroSnapshot("observer:mutation", {
      records: records.slice(0, 50).map((record) => ({
        added: Array.from(record.addedNodes)
          .filter((node): node is Element => node instanceof Element)
          .slice(0, 10)
          .map(elementIdentity),
        attributeName: record.attributeName,
        attributeValue:
          record.type === "attributes" &&
          record.attributeName &&
          record.target instanceof Element
            ? record.target.getAttribute(record.attributeName)
            : null,
        oldValue: record.oldValue,
        removed: Array.from(record.removedNodes)
          .filter((node): node is Element => node instanceof Element)
          .slice(0, 10)
          .map(elementIdentity),
        target:
          record.target instanceof Element
            ? compactElementSnapshot(record.target)
            : null,
        type: record.type,
      })),
      truncatedRecordCount: Math.max(0, records.length - 50),
    });
    refreshResizeTargets();
    scheduleFrameBurst("mutation");
  });

  mutationObserver.observe(document.documentElement, {
    attributeFilter: [
      "class",
      "style",
      "data-poster-ready",
      "data-route",
      "data-scene-active",
      "data-scene-adoption-version",
      "data-scene-pool-state",
      "data-scene-rendered-adoption-version",
      "data-scene-status",
      "data-three-status",
    ],
    attributeOldValue: true,
    attributes: true,
    childList: true,
    subtree: true,
  });
  refreshResizeTargets();

  const traceWindowEvent = (event: Event) => {
    traceActiveHeroSnapshot(`window:${event.type}`, {
      eventType: event.type,
    });
    scheduleFrameBurst(`window:${event.type}`);
  };
  window.addEventListener("resize", traceWindowEvent);
  window.addEventListener("orientationchange", traceWindowEvent);
  window.addEventListener("pageshow", traceWindowEvent);
  window.addEventListener("pagehide", traceWindowEvent);
  window.addEventListener("focus", traceWindowEvent);
  window.addEventListener("blur", traceWindowEvent);
  window.addEventListener("popstate", traceWindowEvent);
  window.addEventListener("hashchange", traceWindowEvent);
  document.addEventListener("visibilitychange", traceWindowEvent);
  window.visualViewport?.addEventListener("resize", traceWindowEvent);
  window.visualViewport?.addEventListener("scroll", traceWindowEvent);

  const traceInputEvent = (event: Event) => {
    const pointer =
      event instanceof PointerEvent
        ? {
            button: event.button,
            clientX: rounded(event.clientX),
            clientY: rounded(event.clientY),
            pointerId: event.pointerId,
            pointerType: event.pointerType,
          }
        : null;
    traceActiveHeroFrameSnapshot(`input:${event.type}`, {
      pointer,
      target:
        event.target instanceof Element
          ? compactElementSnapshot(event.target)
          : null,
    });
    scheduleFrameBurst(`input:${event.type}`);
  };
  document.addEventListener("pointerdown", traceInputEvent, true);
  document.addEventListener("click", traceInputEvent, true);

  const traceErrorEvent = (event: ErrorEvent) => {
    traceActiveHeroSnapshot("window:error", {
      column: event.colno,
      filename: event.filename,
      line: event.lineno,
      message: event.message,
    });
  };
  const traceRejectionEvent = (event: PromiseRejectionEvent) => {
    traceActiveHeroSnapshot("window:unhandledrejection", {
      reason:
        event.reason instanceof Error
          ? {
              message: event.reason.message,
              name: event.reason.name,
              stack: event.reason.stack,
            }
          : String(event.reason),
    });
  };
  window.addEventListener("error", traceErrorEvent);
  window.addEventListener("unhandledrejection", traceRejectionEvent);

  const traceFontEvent = (event: Event) => {
    traceActiveHeroSnapshot(`fonts:${event.type}`, {
      eventType: event.type,
      fontStatus: fontSet?.status ?? null,
    });
    scheduleFrameBurst(`fonts:${event.type}`);
  };
  const fontSet = "fonts" in document ? document.fonts : null;
  fontSet?.addEventListener("loading", traceFontEvent);
  fontSet?.addEventListener("loadingdone", traceFontEvent);
  fontSet?.addEventListener("loadingerror", traceFontEvent);

  const performanceObservers: PerformanceObserver[] = [];
  const installPerformanceObserver = (
    type: string,
    serialize: (entry: PerformanceEntry) => unknown,
  ) => {
    try {
      const observer = new PerformanceObserver((list) => {
        traceActiveHeroFrameSnapshot(`performance:${type}`, {
          entries: list.getEntries().map(serialize),
        });
        scheduleFrameBurst(`performance:${type}`);
      });
      observer.observe({ buffered: true, type });
      performanceObservers.push(observer);
    } catch {
      // Not every browser exposes every performance entry type.
    }
  };

  installPerformanceObserver("layout-shift", (entry) => {
    const layoutShift = entry as PerformanceEntry & {
      readonly hadRecentInput?: boolean;
      readonly sources?: readonly {
        readonly currentRect?: DOMRectReadOnly;
        readonly node?: Node | null;
        readonly previousRect?: DOMRectReadOnly;
      }[];
      readonly value?: number;
    };
    return {
      duration: rounded(entry.duration),
      hadRecentInput: layoutShift.hadRecentInput ?? null,
      sources:
        layoutShift.sources?.map((source) => ({
          currentRect: source.currentRect
            ? rectSnapshot(source.currentRect as DOMRect)
            : null,
          node:
            source.node instanceof Element
              ? elementSnapshot(source.node)
              : null,
          previousRect: source.previousRect
            ? rectSnapshot(source.previousRect as DOMRect)
            : null,
        })) ?? [],
      startTime: rounded(entry.startTime),
      value: layoutShift.value ?? null,
    };
  });
  installPerformanceObserver("longtask", (entry) => ({
    duration: rounded(entry.duration),
    name: entry.name,
    startTime: rounded(entry.startTime),
  }));

  scheduleFrameBurst("observer-installed");
  traceActiveHeroSnapshot("observer:installed");

  window.__sceneRuntimeTraceObserverCleanup = () => {
    mutationObserver.disconnect();
    releaseSceneRuntimeTraceResizeTargets(
      resizeObserver,
      observedResizeTargets,
    );
    resizeObserver?.disconnect();
    for (const observer of performanceObservers) observer.disconnect();
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    window.removeEventListener("resize", traceWindowEvent);
    window.removeEventListener("orientationchange", traceWindowEvent);
    window.removeEventListener("pageshow", traceWindowEvent);
    window.removeEventListener("pagehide", traceWindowEvent);
    window.removeEventListener("focus", traceWindowEvent);
    window.removeEventListener("blur", traceWindowEvent);
    window.removeEventListener("popstate", traceWindowEvent);
    window.removeEventListener("hashchange", traceWindowEvent);
    document.removeEventListener("visibilitychange", traceWindowEvent);
    window.visualViewport?.removeEventListener("resize", traceWindowEvent);
    window.visualViewport?.removeEventListener("scroll", traceWindowEvent);
    document.removeEventListener("pointerdown", traceInputEvent, true);
    document.removeEventListener("click", traceInputEvent, true);
    window.removeEventListener("error", traceErrorEvent);
    window.removeEventListener(
      "unhandledrejection",
      traceRejectionEvent,
    );
    fontSet?.removeEventListener("loading", traceFontEvent);
    fontSet?.removeEventListener("loadingdone", traceFontEvent);
    fontSet?.removeEventListener("loadingerror", traceFontEvent);
    delete window.__sceneRuntimeTraceObserverCleanup;
  };
}
