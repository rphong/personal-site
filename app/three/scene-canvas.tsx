"use client";

import {
  Canvas,
  type RootState,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACESFilmicToneMapping,
  Box3,
  type BufferGeometry,
  Color,
  LinearSRGBColorSpace,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  type RectAreaLight,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Object3D,
  type Scene,
  Vector3,
  type WebGLRendererParameters,
} from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { AuthoredGroundShadow } from "./authored-ground-shadow";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { SceneErrorBoundary } from "./scene-error-boundary";
import { SceneModel } from "./scene-model";
import {
  connectSceneRuntimeDebug,
  disconnectSceneRuntimeDebug,
  recordSceneRuntimeDebugFrame,
} from "./scene-runtime-debug";
import {
  captureSceneRuntimeTraceMoment,
  compareSceneRenderTraceCoherence,
  sceneRuntimeTraceEnabled,
  sceneTraceIdentity,
  subscribeSceneRuntimeTraceEnable,
  traceSceneRuntime,
  type SceneRenderTraceIdentity,
} from "./scene-runtime-trace-core";
import {
  getLoadedSceneAlphaCaptureModule,
  getLoadedSceneRuntimeTraceModule,
  prepareSceneRuntimeTrace,
  type SceneAlphaCaptureModule,
  type SceneRuntimeTraceModule,
} from "./scene-runtime-trace-loader";
import type {
  SceneDefinition,
  SceneFailureReason,
  SceneRotation,
} from "./types";

RectAreaLightUniformsLib.init();

function snapshotSceneCanvasDom(canvas: HTMLCanvasElement) {
  return (
    getLoadedSceneRuntimeTraceModule()?.snapshotSceneCanvasDom(canvas) ?? null
  );
}

function traceSceneStageSnapshot(
  ...args: Parameters<SceneRuntimeTraceModule["traceSceneStageSnapshot"]>
) {
  getLoadedSceneRuntimeTraceModule()?.traceSceneStageSnapshot(...args);
}

function captureSceneAlphaTraceFrame(
  ...args: Parameters<SceneAlphaCaptureModule["captureSceneAlphaTraceFrame"]>
) {
  getLoadedSceneAlphaCaptureModule()?.captureSceneAlphaTraceFrame(...args);
}

export interface SceneCanvasPortProps {
  readonly scene: SceneDefinition;
  readonly rotation: SceneRotation;
  readonly activationVersion: number;
  readonly adoptionVersion?: number;
  readonly renderVersion: number;
  readonly loadEnabled: boolean;
  readonly preloadReady: boolean;
  readonly debugActive?: boolean;
  readonly onFirstFrame: () => void;
  readonly onFailure: (reason: SceneFailureReason) => void;
  readonly onContextLost: () => void;
  readonly onContextRestored: () => void;
}

type SceneRendererDefaults = Omit<WebGLRendererParameters, "canvas"> & {
  readonly canvas: NonNullable<WebGLRendererParameters["canvas"]>;
};
type RendererCreator = (defaults: SceneRendererDefaults) => WebGLRenderer;
type SceneRendererFactory = (
  defaults: SceneRendererDefaults,
) => Promise<WebGLRenderer>;

type WebGLRendererConstructor = (
  parameters: WebGLRendererParameters,
) => WebGLRenderer;

const WEBGL2_ATTRIBUTES = {
  alpha: true,
  antialias: true,
  depth: true,
  failIfMajorPerformanceCaveat: false,
  powerPreference: "high-performance",
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  stencil: false,
} as const satisfies WebGLContextAttributes;

export const ACTIVE_SCENE_DPR: [number, number] = [1, 1.5];
export const INACTIVE_SCENE_DPR = 0.75;

export function createDisabledSceneEventManager() {
  // Scene interaction is owned by SceneRotationArea outside the R3F tree.
  // Leaving the default manager enabled lets Canvas's async configure task
  // reconnect to a wrapper that may already be unmounted during rapid toggles.
  return {
    enabled: false,
    priority: 0,
  };
}

export function createWebGL2Renderer(
  defaults: SceneRendererDefaults,
  construct: WebGLRendererConstructor = (parameters) =>
    new WebGLRenderer(parameters),
): WebGLRenderer {
  const canvas = defaults.canvas as HTMLCanvasElement;
  const context = canvas.getContext(
    "webgl2",
    WEBGL2_ATTRIBUTES,
  ) as WebGL2RenderingContext | null;
  if (!context) throw new Error("WebGL2 renderer context unavailable");

  const listeners: Array<{
    readonly listener: EventListenerOrEventListenerObject;
    readonly options?: AddEventListenerOptions | boolean;
    readonly type: string;
  }> = [];
  const addEventListener = canvas.addEventListener;
  const removeEventListener = canvas.removeEventListener;
  const intercept = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) => {
    listeners.push({ type, listener, options });
    addEventListener.call(canvas, type, listener, options);
  }) as typeof canvas.addEventListener;
  let interceptionInstalled = false;

  try {
    canvas.addEventListener = intercept;
    interceptionInstalled = true;
    const renderer = construct({
      ...defaults,
      ...WEBGL2_ATTRIBUTES,
      context,
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    return renderer;
  } catch (error) {
    for (const { type, listener, options } of listeners) {
      removeEventListener.call(canvas, type, listener, options);
    }
    try {
      context.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // A failed renderer no longer owns a usable context to release.
    }
    throw error;
  } finally {
    if (interceptionInstalled) canvas.addEventListener = addEventListener;
  }
}

export function createWebGL2RendererFactory(
  reportFailure: (reason: SceneFailureReason) => void,
  createRenderer: RendererCreator = createWebGL2Renderer,
): SceneRendererFactory {
  let result: Promise<WebGLRenderer> | null = null;

  return (defaults) => {
    if (result) return result;
    try {
      result = Promise.resolve(createRenderer(defaults));
    } catch {
      // R3F's configure task must settle to release its props closure. The
      // availability gate keeps all scene/cache children out of this inert root.
      result = Promise.resolve(createUnavailableRenderer(defaults.canvas));
      try {
        reportFailure("webgl2-unavailable");
      } catch {
        // Renderer construction must never become R3F's unhandled async rejection.
      }
    }
    return result;
  };
}

function createUnavailableRenderer(
  canvas: SceneRendererDefaults["canvas"],
): WebGLRenderer {
  return {
    domElement: canvas,
    forceContextLoss: () => undefined,
    render: () => undefined,
    renderLists: { dispose: () => undefined },
    setPixelRatio: () => undefined,
    setSize: () => undefined,
  } as unknown as WebGLRenderer;
}

function ResponsiveCamera({ scene }: { readonly scene: SceneDefinition }) {
  const camera = useThree((state) => state.camera);
  const renderer = useThree((state) => state.gl) as WebGLRenderer;
  const height = useThree((state) => state.size.height);
  const width = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const frame = cameraFrameForEnvironment(scene, width);
    const tracing = sceneRuntimeTraceEnabled();
    const before = tracing ? traceCamera(camera, frame) : null;
    applyCameraFrame(
      camera,
      frame,
      height > 0 ? width / height : undefined,
    );
    camera.updateMatrixWorld();
    if (tracing) {
      traceSceneRuntime("camera:responsive-layout", {
        after: traceCamera(camera, frame),
        before,
        canvasDom: snapshotSceneCanvasDom(renderer.domElement),
        canvasSize: {
          height: renderer.domElement.clientHeight,
          width: renderer.domElement.clientWidth,
        },
        expectedFrame: traceCameraFrame(frame),
        mode: frame === scene.mobile ? "mobile" : "desktop",
        r3fSize: { height, width },
        sceneId: scene.id,
      });
    }
    invalidate();
  }, [camera, height, invalidate, renderer, scene, width]);

  return null;
}

function cameraFrameForWidth(scene: SceneDefinition, width: number) {
  return width <= 767 ? scene.mobile : scene.desktop;
}

function cameraModeForViewport() {
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(max-width: 767px)").matches
    ? "mobile"
    : "desktop";
}

function cameraFrameForEnvironment(
  scene: SceneDefinition,
  fallbackWidth: number,
) {
  const viewportMode = cameraModeForViewport();
  if (viewportMode === "mobile") return scene.mobile;
  if (viewportMode === "desktop") return scene.desktop;
  return cameraFrameForWidth(scene, fallbackWidth);
}

function applyCameraFrame(
  camera: Camera,
  frame: SceneDefinition["desktop"],
  aspect?: number,
): void {
  camera.position.set(...frame.cameraPosition);
  camera.lookAt(...frame.cameraTarget);
  if (camera instanceof PerspectiveCamera) {
    camera.fov = frame.fov;
    if (aspect !== undefined && Number.isFinite(aspect) && aspect > 0) {
      camera.aspect = aspect;
    }
    camera.updateProjectionMatrix();
  }
}

function synchronizeCameraForCanvas(
  camera: Camera,
  scene: SceneDefinition,
  canvas: HTMLCanvasElement,
  fallbackSize?: Readonly<{ height: number; width: number }>,
) {
  const width =
    canvas.clientWidth > 0 ? canvas.clientWidth : fallbackSize?.width ?? 0;
  const height =
    canvas.clientHeight > 0
      ? canvas.clientHeight
      : fallbackSize?.height ?? 0;
  const frame = cameraFrameForEnvironment(scene, width);
  applyCameraFrame(camera, frame, height > 0 ? width / height : undefined);
  camera.updateMatrixWorld();
  return frame === scene.mobile ? "mobile" : "desktop";
}

function SceneRendererSettings({
  scene,
}: {
  readonly scene: SceneDefinition;
}) {
  const renderer = useThree((state) => state.gl) as WebGLRenderer;
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    // Three.js renderers are mutable imperative objects by design.
    // eslint-disable-next-line react-hooks/immutability
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = scene.lighting.exposure;
    invalidate();
  }, [invalidate, renderer, scene.lighting.exposure]);

  return null;
}

function SceneAreaKey({ scene }: { readonly scene: SceneDefinition }) {
  const light = useRef<RectAreaLight>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    light.current?.lookAt(...scene.lighting.key.target);
    light.current?.updateMatrixWorld();
    invalidate();
  }, [invalidate, scene.lighting.key]);

  return (
    <rectAreaLight
      ref={light}
      name="source-area-key"
      color={scene.lighting.key.color}
      intensity={scene.lighting.key.intensity}
      position={scene.lighting.key.position}
      width={scene.lighting.key.width}
      height={scene.lighting.key.height}
    />
  );
}

function SceneLights({ scene }: { readonly scene: SceneDefinition }) {
  const worldColor = useMemo(
    () =>
      new Color().setRGB(
        ...scene.lighting.world.linearColor,
        LinearSRGBColorSpace,
      ),
    [scene.lighting.world.linearColor],
  );

  return (
    <>
      <ambientLight
        name="source-world-fill"
        color={worldColor}
        // AmbientLight is expressed as irradiance; Blender's world is
        // radiance. A constant hemisphere integrates to PI steradians.
        intensity={scene.lighting.world.strength * Math.PI}
      />
      <SceneAreaKey scene={scene} />
    </>
  );
}

interface ContextHealth {
  readonly getGeneration: () => number;
  readonly isLost: () => boolean;
  readonly markLost: () => void;
  readonly markRestored: () => void;
}

function createContextHealth(): ContextHealth {
  let generation = 0;
  let lost = false;
  return {
    getGeneration: () => generation,
    isLost: () => lost,
    markLost: () => {
      lost = true;
      generation += 1;
    },
    markRestored: () => {
      lost = false;
      generation += 1;
    },
  };
}

function createContextCallbackPort(
  initialLost: SceneCanvasPortProps["onContextLost"],
  initialRestored: SceneCanvasPortProps["onContextRestored"],
) {
  let lost = initialLost;
  let restored = initialRestored;
  return {
    reportLost: () => lost(),
    reportRestored: () => restored(),
    update: (
      nextLost: SceneCanvasPortProps["onContextLost"],
      nextRestored: SceneCanvasPortProps["onContextRestored"],
    ) => {
      lost = nextLost;
      restored = nextRestored;
    },
  };
}

function ContextLifecycle({
  health,
  onContextLost,
  onContextRestored,
  sceneId,
}: Pick<SceneCanvasPortProps, "onContextLost" | "onContextRestored"> & {
  readonly health: ContextHealth;
  readonly sceneId: SceneDefinition["id"];
}) {
  const gl = useThree((state) => state.gl) as WebGLRenderer;
  const invalidate = useThree((state) => state.invalidate);
  const [callbacks] = useState(() =>
    createContextCallbackPort(onContextLost, onContextRestored),
  );

  useLayoutEffect(() => {
    callbacks.update(onContextLost, onContextRestored);
  }, [callbacks, onContextLost, onContextRestored]);

  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      if (sceneRuntimeTraceEnabled()) {
        traceSceneRuntime("canvas:webgl-context-lost", {
          canvasDom: snapshotSceneCanvasDom(canvas),
          sceneId,
        });
      }
      health.markLost();
      callbacks.reportLost();
    };
    const restored = () => {
      if (sceneRuntimeTraceEnabled()) {
        traceSceneRuntime("canvas:webgl-context-restored", {
          canvasDom: snapshotSceneCanvasDom(canvas),
          sceneId,
        });
      }
      health.markRestored();
      callbacks.reportRestored();
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [callbacks, gl, health, invalidate, sceneId]);

  return null;
}

function rendererContextIsLost(gl: WebGLRenderer): boolean {
  try {
    return gl.getContext().isContextLost();
  } catch {
    return true;
  }
}

export function sceneModelIsAttached(
  scene: Scene,
  sceneId: SceneDefinition["id"],
): boolean {
  const instance = scene.getObjectByName(`scene-instance:${sceneId}`);
  return Boolean(instance?.children.length);
}

function traceRounded(value: number) {
  return Math.round(value * 100_000) / 100_000;
}

function traceNumberArray(values: ArrayLike<number>) {
  return Array.from(values, traceRounded);
}

function traceVector(vector: Vector3) {
  return [
    traceRounded(vector.x),
    traceRounded(vector.y),
    traceRounded(vector.z),
  ];
}

function traceCameraFrame(frame: SceneDefinition["desktop"]) {
  return {
    cameraPosition: traceNumberArray(frame.cameraPosition),
    cameraTarget: traceNumberArray(frame.cameraTarget),
    fov: traceRounded(frame.fov),
  };
}

function traceCamera(
  camera: Camera,
  expectedFrame?: SceneDefinition["desktop"],
) {
  const worldMatrix = camera.matrixWorld.elements;
  const direction = new Vector3(
    -worldMatrix[8],
    -worldMatrix[9],
    -worldMatrix[10],
  ).normalize();
  return {
    aspect:
      "aspect" in camera && typeof camera.aspect === "number"
        ? traceRounded(camera.aspect)
        : null,
    far:
      "far" in camera && typeof camera.far === "number"
        ? traceRounded(camera.far)
        : null,
    fov:
      "fov" in camera && typeof camera.fov === "number"
        ? traceRounded(camera.fov)
        : null,
    matrix: traceNumberArray(camera.matrix.elements),
    matrixWorld: traceNumberArray(camera.matrixWorld.elements),
    matrixWorldInverse: traceNumberArray(camera.matrixWorldInverse.elements),
    near:
      "near" in camera && typeof camera.near === "number"
        ? traceRounded(camera.near)
        : null,
    position: traceVector(camera.position),
    projectionMatrix: traceNumberArray(camera.projectionMatrix.elements),
    projectionMatrixInverse: traceNumberArray(
      camera.projectionMatrixInverse.elements,
    ),
    quaternion: [
      traceRounded(camera.quaternion.x),
      traceRounded(camera.quaternion.y),
      traceRounded(camera.quaternion.z),
      traceRounded(camera.quaternion.w),
    ],
    rotation: [
      traceRounded(camera.rotation.x),
      traceRounded(camera.rotation.y),
      traceRounded(camera.rotation.z),
      camera.rotation.order,
    ],
    up: traceVector(camera.up),
    worldDirection: traceVector(direction),
    zoom:
      "zoom" in camera && typeof camera.zoom === "number"
        ? traceRounded(camera.zoom)
        : null,
    expectedFrame: expectedFrame ? traceCameraFrame(expectedFrame) : null,
  };
}

type TraceCameraSnapshot = ReturnType<typeof traceCamera>;

const traceGeometryBounds = new WeakMap<BufferGeometry, Box3>();

function observationalGeometryBounds(geometry: BufferGeometry) {
  const cached = traceGeometryBounds.get(geometry);
  if (cached) return cached;
  if (geometry.boundingBox) {
    const bounds = geometry.boundingBox.clone();
    traceGeometryBounds.set(geometry, bounds);
    return bounds;
  }
  const position = geometry.getAttribute("position");
  if (!position || position.itemSize < 3 || position.count === 0) {
    return null;
  }
  const bounds = new Box3().makeEmpty();
  const point = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.set(
      position.getX(index),
      position.getY(index),
      position.getZ(index),
    );
    bounds.expandByPoint(point);
  }
  if (bounds.isEmpty()) return null;
  traceGeometryBounds.set(geometry, bounds);
  return bounds;
}

function observationalWorldBounds(object: Object3D | null) {
  if (!object) return null;
  const bounds = new Box3().makeEmpty();
  object.traverse((child) => {
    const geometry = (
      child as Object3D & { readonly geometry?: BufferGeometry }
    ).geometry;
    if (!geometry?.isBufferGeometry) return;
    const localBounds = observationalGeometryBounds(geometry);
    if (!localBounds) return;
    bounds.union(localBounds.clone().applyMatrix4(child.matrixWorld));
  });
  return bounds.isEmpty() ? null : bounds;
}

function traceBounds(bounds: Box3 | null) {
  if (!bounds) return null;
  const center = new Vector3();
  const size = new Vector3();
  bounds.getCenter(center);
  bounds.getSize(size);
  return {
    center: traceVector(center),
    max: traceVector(bounds.max),
    min: traceVector(bounds.min),
    size: traceVector(size),
  };
}

function traceObjectState(
  object: Object3D | null,
  bounds: Box3 | null = null,
) {
  if (!object) return null;
  const worldPosition = new Vector3();
  const worldQuaternion = new Quaternion();
  const worldScale = new Vector3();
  object.matrixWorld.decompose(
    worldPosition,
    worldQuaternion,
    worldScale,
  );
  return {
    children: object.children.slice(0, 24).map((child) => ({
      childCount: child.children.length,
      name: child.name,
      type: child.type,
      uuid: child.uuid,
      visible: child.visible,
    })),
    local: {
      matrix: traceNumberArray(object.matrix.elements),
      position: traceVector(object.position),
      quaternion: [
        traceRounded(object.quaternion.x),
        traceRounded(object.quaternion.y),
        traceRounded(object.quaternion.z),
        traceRounded(object.quaternion.w),
      ],
      rotation: [
        traceRounded(object.rotation.x),
        traceRounded(object.rotation.y),
        traceRounded(object.rotation.z),
        object.rotation.order,
      ],
      scale: traceVector(object.scale),
    },
    matrixAutoUpdate: object.matrixAutoUpdate,
    matrixWorld: traceNumberArray(object.matrixWorld.elements),
    name: object.name,
    parent: object.parent
      ? {
          name: object.parent.name,
          type: object.parent.type,
          uuid: object.parent.uuid,
        }
      : null,
    type: object.type,
    uuid: object.uuid,
    visible: object.visible,
    world: {
      bounds: traceBounds(bounds),
      position: traceVector(worldPosition),
      quaternion: [
        traceRounded(worldQuaternion.x),
        traceRounded(worldQuaternion.y),
        traceRounded(worldQuaternion.z),
        traceRounded(worldQuaternion.w),
      ],
      scale: traceVector(worldScale),
    },
  };
}

function traceModelState(
  scene: Scene,
  sceneId: SceneDefinition["id"],
  modelBounds: Box3 | null = null,
) {
  const root = scene.getObjectByName(`scene-root:${sceneId}`);
  const instance = scene.getObjectByName(`scene-instance:${sceneId}`);
  return {
    instance: traceObjectState(instance ?? null, modelBounds),
    root: traceObjectState(root ?? null),
    sceneChildren: scene.children.map((child) => ({
      childCount: child.children.length,
      name: child.name,
      type: child.type,
      uuid: child.uuid,
      visible: child.visible,
    })),
  };
}

function traceModelWorldBounds(
  scene: Scene,
  sceneId: SceneDefinition["id"],
) {
  return observationalWorldBounds(
    scene.getObjectByName(`scene-instance:${sceneId}`) ?? null,
  );
}

function traceModelScreenBounds(
  bounds: Box3 | null,
  camera: Pick<
    TraceCameraSnapshot,
    "matrixWorldInverse" | "projectionMatrix"
  >,
  canvas: HTMLCanvasElement,
) {
  if (!bounds) return null;

  const matrixWorldInverse = new Matrix4().fromArray(camera.matrixWorldInverse);
  const projectionMatrix = new Matrix4().fromArray(camera.projectionMatrix);
  const corners = [
    new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ].map((corner) =>
    corner.applyMatrix4(matrixWorldInverse).applyMatrix4(projectionMatrix),
  );
  const minX = Math.min(...corners.map(({ x }) => x));
  const maxX = Math.max(...corners.map(({ x }) => x));
  const minY = Math.min(...corners.map(({ y }) => y));
  const maxY = Math.max(...corners.map(({ y }) => y));
  const canvasRect = canvas.getBoundingClientRect();
  const localMinX = ((minX + 1) / 2) * canvas.clientWidth;
  const localMaxX = ((maxX + 1) / 2) * canvas.clientWidth;
  const localMinY = ((1 - maxY) / 2) * canvas.clientHeight;
  const localMaxY = ((1 - minY) / 2) * canvas.clientHeight;
  const viewportMinX = canvasRect.left + ((minX + 1) / 2) * canvasRect.width;
  const viewportMaxX = canvasRect.left + ((maxX + 1) / 2) * canvasRect.width;
  const viewportMinY = canvasRect.top + ((1 - maxY) / 2) * canvasRect.height;
  const viewportMaxY = canvasRect.top + ((1 - minY) / 2) * canvasRect.height;

  return {
    canvasRect: {
      height: traceRounded(canvasRect.height),
      width: traceRounded(canvasRect.width),
      x: traceRounded(canvasRect.x),
      y: traceRounded(canvasRect.y),
    },
    centerX: traceRounded((localMinX + localMaxX) / 2),
    centerY: traceRounded((localMinY + localMaxY) / 2),
    height: traceRounded(localMaxY - localMinY),
    local: {
      centerX: traceRounded((localMinX + localMaxX) / 2),
      centerY: traceRounded((localMinY + localMaxY) / 2),
      maxX: traceRounded(localMaxX),
      maxY: traceRounded(localMaxY),
      minX: traceRounded(localMinX),
      minY: traceRounded(localMinY),
    },
    maxX: traceRounded(localMaxX),
    maxY: traceRounded(localMaxY),
    minX: traceRounded(localMinX),
    minY: traceRounded(localMinY),
    ndc: {
      maxX: traceRounded(maxX),
      maxY: traceRounded(maxY),
      minX: traceRounded(minX),
      minY: traceRounded(minY),
    },
    viewport: {
      centerX: traceRounded((viewportMinX + viewportMaxX) / 2),
      centerY: traceRounded((viewportMinY + viewportMaxY) / 2),
      height: traceRounded(viewportMaxY - viewportMinY),
      maxX: traceRounded(viewportMaxX),
      maxY: traceRounded(viewportMaxY),
      minX: traceRounded(viewportMinX),
      minY: traceRounded(viewportMinY),
      width: traceRounded(viewportMaxX - viewportMinX),
    },
    width: traceRounded(localMaxX - localMinX),
  };
}

function presentRenderedAdoption(
  canvas: HTMLCanvasElement,
  adoptionVersion: number,
) {
  const stage = canvas.closest<HTMLElement>("[data-scene-resident-stage]");
  if (
    !stage ||
    stage.dataset.scenePoolState !== "adopting" ||
    stage.dataset.sceneAdoptionVersion !== String(adoptionVersion)
  ) {
    return null;
  }

  stage.dataset.sceneRenderedAdoptionVersion = String(adoptionVersion);
  stage.dataset.scenePoolState = "assigned";
  return stage;
}

function snapshotSceneRenderIdentity(
  canvas: HTMLCanvasElement,
  path: string,
): SceneRenderTraceIdentity {
  const stage = canvas.closest<HTMLElement>("[data-scene-resident-stage]");
  const section = stage?.parentElement?.closest<HTMLElement>(
    "[data-scene-id]",
  );
  return {
    adoptionVersion: stage?.dataset.sceneAdoptionVersion ?? null,
    canvasConnected: canvas.isConnected,
    ownerSceneId: stage?.dataset.sceneOwnerId ?? null,
    path,
    poolKey: stage?.dataset.scenePoolKey ?? null,
    poolState: stage?.dataset.scenePoolState ?? null,
    renderedAdoptionVersion:
      stage?.dataset.sceneRenderedAdoptionVersion ?? null,
    sectionSceneId: section?.dataset.sceneId ?? null,
    stageConnected: stage?.isConnected ?? false,
  };
}

type SceneRenderReason = "adoption-layout" | "demand-frame";

function reportSceneTraceFailure(error: unknown) {
  window.setTimeout(() => {
    console.warn(
      "[scene-runtime-trace] telemetry assembly failed",
      error,
    );
  }, 0);
}

function DemandRenderer({
  adoptionVersion = 0,
  debugActive = true,
  health,
  sceneDefinition,
  sceneId,
  onFirstFrame,
  onFailure,
}: Pick<
  SceneCanvasPortProps,
  "adoptionVersion" | "debugActive" | "onFirstFrame" | "onFailure"
> & {
  readonly health: ContextHealth;
  readonly sceneDefinition: SceneDefinition;
  readonly sceneId: SceneDefinition["id"];
}) {
  const reported = useRef(false);
  const failed = useRef(false);
  const frameTimes = useRef<number[]>([]);
  const presentedAdoptionVersion = useRef<number | null>(null);
  const renderer = useThree((state) => state.gl) as WebGLRenderer;
  const renderedScene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const getRootState = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const setSize = useThree((state) => state.setSize);

  useEffect(() => {
    let active = true;
    const prepare = () => {
      void prepareSceneRuntimeTrace()
        .then(() => {
          if (active) invalidate();
        })
        .catch(reportSceneTraceFailure);
    };
    const unsubscribe = subscribeSceneRuntimeTraceEnable(prepare);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [invalidate]);

  useLayoutEffect(() => {
    if (!debugActive) return;
    connectSceneRuntimeDebug(
      renderer,
      renderedScene,
      camera,
      invalidate,
      sceneId,
    );
    return () => disconnectSceneRuntimeDebug(invalidate, sceneId);
  }, [camera, debugActive, invalidate, renderedScene, renderer, sceneId]);

  const renderFrame = useCallback(
    (
      gl: WebGLRenderer,
      scene: typeof renderedScene,
      activeCamera: Camera,
      renderReason: SceneRenderReason,
    ) => {
      const tracing = sceneRuntimeTraceEnabled();
      const modelAttached = sceneModelIsAttached(scene, sceneId);
      const healthLost = health.isLost();
      const contextLost = healthLost ? true : rendererContextIsLost(gl);
      const rootSize = getRootState().size;
      const renderWidth =
        gl.domElement.clientWidth > 0
          ? gl.domElement.clientWidth
          : rootSize.width;
      const expectedFrame = cameraFrameForEnvironment(
        sceneDefinition,
        renderWidth,
      );
      const cameraBeforeSynchronization = tracing
        ? traceCamera(activeCamera, expectedFrame)
        : null;
      const skipReasons = [
        failed.current ? "renderer-failed" : null,
        !modelAttached ? "model-detached" : null,
        healthLost ? "health-lost" : null,
        contextLost ? "context-lost" : null,
      ].filter((reason): reason is string => reason !== null);
      if (skipReasons.length > 0) {
        if (tracing) {
          traceSceneRuntime("canvas:render-skipped", {
            ...sceneTraceIdentity(sceneId, adoptionVersion),
            camera: cameraBeforeSynchronization,
            canvasDom: snapshotSceneCanvasDom(gl.domElement),
            expectedFrame: traceCameraFrame(expectedFrame),
            model: modelAttached
              ? traceModelState(scene, sceneId)
              : null,
            renderReason,
            r3fSize: rootSize,
            skipReasons,
          });
        }
        return;
      }

      const cameraFrame = synchronizeCameraForCanvas(
        activeCamera,
        sceneDefinition,
        gl.domElement,
        rootSize,
      );
      const viewportCameraMode = cameraModeForViewport();
      const generation = health.getGeneration();
      const frameBefore = gl.info.render.frame;
      const renderBeforeMoment = tracing
        ? captureSceneRuntimeTraceMoment()
        : null;
      const renderBeforeDetails = tracing
        ? {
            ...sceneTraceIdentity(sceneId, adoptionVersion),
            buffer: {
              height: gl.domElement.height,
              width: gl.domElement.width,
            },
            camera: traceCamera(activeCamera, expectedFrame),
            cameraBeforeSynchronization,
            cameraFrame,
            cameraModeMatchesViewport:
              viewportCameraMode === null
                ? null
                : cameraFrame === viewportCameraMode,
            expectedFrame: traceCameraFrame(expectedFrame),
            model: traceModelState(scene, sceneId),
            pixelRatio: gl.getPixelRatio(),
            renderReason,
            rendererFrame: frameBefore,
            r3fSize: { ...rootSize },
          }
        : null;
      let renderBeforeTraceEmitted = false;
      const emitRenderBeforeTrace = () => {
        if (
          renderBeforeTraceEmitted ||
          !renderBeforeDetails ||
          !renderBeforeMoment
        ) {
          return;
        }
        renderBeforeTraceEmitted = true;
        try {
          traceSceneRuntime(
            "canvas:render-before",
            renderBeforeDetails,
            renderBeforeMoment,
          );
        } catch (error) {
          reportSceneTraceFailure(error);
        }
      };
      let presentedStage: HTMLElement | null = null;
      let presentedMoment: ReturnType<
        typeof captureSceneRuntimeTraceMoment
      > | null = null;
      let renderAfterMoment: ReturnType<
        typeof captureSceneRuntimeTraceMoment
      > | null = null;
      let renderedIdentity: SceneRenderTraceIdentity | null = null;
      try {
        gl.render(scene, activeCamera);
        if (
          health.isLost() ||
          health.getGeneration() !== generation ||
          rendererContextIsLost(gl) ||
          gl.info.render.frame <= frameBefore
        ) {
          emitRenderBeforeTrace();
          return;
        }

        recordSceneRuntimeDebugFrame(gl, scene, sceneId);
        if (
          presentedAdoptionVersion.current !== adoptionVersion
        ) {
          presentedStage = presentRenderedAdoption(
            gl.domElement,
            adoptionVersion,
          );
          if (presentedStage) {
            presentedAdoptionVersion.current = adoptionVersion;
            presentedMoment = tracing
              ? captureSceneRuntimeTraceMoment()
              : null;
          }
        }
        if (tracing) {
          renderAfterMoment = captureSceneRuntimeTraceMoment();
          renderedIdentity = snapshotSceneRenderIdentity(
            gl.domElement,
            renderAfterMoment.path,
          );
        }

        const now = performance.now();
        const previous = frameTimes.current.at(-1);
        if (previous !== undefined && now - previous > 250) {
          frameTimes.current = [];
        }
        frameTimes.current.push(now);
        if (frameTimes.current.length >= 12) {
          const first = frameTimes.current[0];
          const last = frameTimes.current.at(-1) ?? first;
          const fps = Math.round(
            ((frameTimes.current.length - 1) * 1_000) /
              Math.max(1, last - first),
          );
          emitSceneRuntimeEvent({ status: "rotation-health", sceneId, fps });
          frameTimes.current = [];
        }
        if (!reported.current) {
          reported.current = true;
          onFirstFrame();
        }
        if (tracing) {
          // The default framebuffer remains readable until this task yields.
          // Resolve it only after the adoption state and first-frame callback
          // have advanced, so trace-only setup cannot delay that handoff.
          captureSceneAlphaTraceFrame(gl, {
            adoptionVersion,
            contextGeneration: generation,
            renderReason,
            rendererFrame: gl.info.render.frame,
            sceneId,
          });
        }
      } catch (error) {
        failed.current = true;
        onFailure("unknown");
        emitRenderBeforeTrace();
        if (tracing) {
          try {
            traceSceneRuntime("canvas:render-error", {
              ...sceneTraceIdentity(sceneId, adoptionVersion),
              camera: traceCamera(activeCamera, expectedFrame),
              canvasDom: snapshotSceneCanvasDom(gl.domElement),
              error: error instanceof Error ? error.message : String(error),
              model: traceModelState(
                scene,
                sceneId,
                traceModelWorldBounds(scene, sceneId),
              ),
              renderReason,
            });
          } catch (traceError) {
            reportSceneTraceFailure(traceError);
          }
        }
        return;
      }

      emitRenderBeforeTrace();
      if (tracing && renderAfterMoment && renderedIdentity) {
        try {
          const cameraAfterRender = traceCamera(activeCamera, expectedFrame);
          const renderedFrame = gl.info.render.frame;
          const renderedRootSize = { ...rootSize };
          const renderedTelemetrySequence = traceSceneRuntime(
            "canvas:render-after",
            {
              ...sceneTraceIdentity(sceneId, adoptionVersion),
              auditScheduled: true,
              buffer: {
                height: gl.domElement.height,
                width: gl.domElement.width,
              },
              camera: cameraAfterRender,
              cameraBeforeSynchronization,
              cameraFrame,
              cameraModeMatchesViewport:
                viewportCameraMode === null
                  ? null
                  : cameraFrame === viewportCameraMode,
              expectedFrame: traceCameraFrame(expectedFrame),
              pixelRatio: gl.getPixelRatio(),
              renderIdentity: renderedIdentity,
              renderReason,
              rendererFrame: renderedFrame,
              r3fSize: renderedRootSize,
            },
            renderAfterMoment,
          );
          const renderedStage = gl.domElement.closest<HTMLElement>(
            "[data-scene-resident-stage]",
          );
          if (renderedStage && renderedTelemetrySequence !== null) {
            renderedStage.dataset.sceneLastRenderSequence = String(
              renderedTelemetrySequence,
            );
          }
          const auditScheduledAt = performance.now();
          requestAnimationFrame(() => {
            const auditAnimationFrameAt = performance.now();
            window.setTimeout(() => {
              try {
                if (presentedStage) {
                  traceSceneStageSnapshot(
                    "canvas:adoption-presented",
                    presentedStage,
                    sceneTraceIdentity(sceneId, adoptionVersion),
                    presentedMoment ?? undefined,
                  );
                }
                const modelBoundsAfterRender = traceModelWorldBounds(
                  scene,
                  sceneId,
                );
                const modelScreenBounds = traceModelScreenBounds(
                  modelBoundsAfterRender,
                  cameraAfterRender,
                  gl.domElement,
                );
                const modelScreenBoundsBeforeSynchronization =
                  cameraBeforeSynchronization
                    ? traceModelScreenBounds(
                        modelBoundsAfterRender,
                        cameraBeforeSynchronization,
                        gl.domElement,
                      )
                    : null;
                const auditAt = performance.now();
                const rendererFrameAtAudit = gl.info.render.frame;
                const auditIdentity = snapshotSceneRenderIdentity(
                  gl.domElement,
                  window.location.pathname,
                );
                const auditCoherence =
                  compareSceneRenderTraceCoherence(
                    renderedIdentity,
                    auditIdentity,
                    renderedFrame,
                    rendererFrameAtAudit,
                  );
                traceSceneRuntime(
                  "canvas:render-audit",
                  {
                    ...sceneTraceIdentity(sceneId, adoptionVersion),
                    auditCoherence,
                    auditCoherentWithRenderedFrame:
                      auditCoherence.coherent,
                    auditIdentity,
                    auditMatchesRenderedFrame:
                      auditCoherence.rendererFrameMatches,
                    auditTiming: {
                      afterAnimationFrameMs: traceRounded(
                        auditAt - auditAnimationFrameAt,
                      ),
                      afterRenderMs: traceRounded(
                        auditAt - auditScheduledAt,
                      ),
                      animationFrameAt: traceRounded(
                        auditAnimationFrameAt,
                      ),
                      auditAt: traceRounded(auditAt),
                      scheduledAt: traceRounded(auditScheduledAt),
                    },
                    buffer: {
                      height: gl.domElement.height,
                      width: gl.domElement.width,
                    },
                    camera: cameraAfterRender,
                    cameraBeforeSynchronization,
                    cameraFrame,
                    cameraModeMatchesViewport:
                      viewportCameraMode === null
                        ? null
                        : cameraFrame === viewportCameraMode,
                    canvasDom: snapshotSceneCanvasDom(gl.domElement),
                    css: {
                      height: gl.domElement.clientHeight,
                      width: gl.domElement.clientWidth,
                    },
                    expectedFrame: traceCameraFrame(expectedFrame),
                    model: traceModelState(
                      scene,
                      sceneId,
                      modelBoundsAfterRender,
                    ),
                    modelScreenBounds,
                    modelScreenBoundsBeforeSynchronization,
                    pixelRatio: gl.getPixelRatio(),
                    renderAfterSequence: renderedTelemetrySequence,
                    renderIdentity: renderedIdentity,
                    renderedStageStillCurrent: Boolean(
                      renderedStage &&
                        renderedStage.isConnected &&
                        gl.domElement.isConnected &&
                        auditCoherence.auditIdentityValid &&
                        renderedStage ===
                          gl.domElement.closest(
                            "[data-scene-resident-stage]",
                          ),
                    ),
                    renderReason,
                    rendererFrame: renderedFrame,
                    rendererFrameAtAudit,
                    r3fSize: renderedRootSize,
                  },
                  renderAfterMoment,
                );
              } catch (error) {
                reportSceneTraceFailure(error);
              }
            }, 0);
          });
        } catch (error) {
          reportSceneTraceFailure(error);
        }
      }
    },
    [
      adoptionVersion,
      getRootState,
      health,
      onFailure,
      onFirstFrame,
      sceneDefinition,
      sceneId,
    ],
  );

  useLayoutEffect(() => {
    // The model's preceding layout effect has already cloned and sampled its
    // static pose. A pooled canvas still carries the pool's renderer size until
    // R3F's ResizeObserver runs, so reconcile its assigned wrapper and camera
    // synchronously before the first visible adoption frame.
    const container = renderer.domElement.parentElement;
    const tracing = sceneRuntimeTraceEnabled();
    const stage = tracing
      ? renderer.domElement.closest<HTMLElement>(
          "[data-scene-resident-stage]",
        )
      : null;
    if (stage) {
      traceSceneStageSnapshot(
        "canvas:adoption-layout-before",
        stage,
        {
          ...sceneTraceIdentity(sceneId, adoptionVersion),
          camera: traceCamera(camera),
          cameraFrame:
            cameraFrameForEnvironment(
              sceneDefinition,
              container?.getBoundingClientRect().width ?? 0,
            ) === sceneDefinition.mobile
              ? "mobile"
              : "desktop",
          debugActive,
          pixelRatio: renderer.getPixelRatio(),
          r3fSize: getRootState().size,
        },
      );
    }
    const bounds = container?.getBoundingClientRect();
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      setSize(bounds.width, bounds.height, bounds.top, bounds.left);
      applyCameraFrame(
        camera,
        cameraFrameForEnvironment(sceneDefinition, bounds.width),
        bounds.width / bounds.height,
      );
    }
    if (stage) {
      traceSceneStageSnapshot(
        "canvas:adoption-layout-sized",
        stage,
        {
          ...sceneTraceIdentity(sceneId, adoptionVersion),
          camera: traceCamera(camera),
          cameraFrame:
            cameraFrameForEnvironment(sceneDefinition, bounds?.width ?? 0) ===
            sceneDefinition.mobile
              ? "mobile"
              : "desktop",
          debugActive,
          measuredContainer: bounds
            ? {
                height: bounds.height,
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
              }
            : null,
          pixelRatio: renderer.getPixelRatio(),
          r3fSize: getRootState().size,
        },
      );
    }
    renderFrame(
      renderer,
      renderedScene,
      camera,
      "adoption-layout",
    );
    if (stage) {
      traceSceneStageSnapshot(
        "canvas:adoption-layout-rendered",
        stage,
        {
          ...sceneTraceIdentity(sceneId, adoptionVersion),
          camera: traceCamera(camera),
          debugActive,
          pixelRatio: renderer.getPixelRatio(),
          r3fSize: getRootState().size,
        },
      );
    }
  }, [
    adoptionVersion,
    camera,
    debugActive,
    getRootState,
    renderFrame,
    renderedScene,
    renderer,
    sceneDefinition,
    sceneId,
    setSize,
  ]);

  useFrame(({ gl, scene, camera }) => {
    renderFrame(
      gl as WebGLRenderer,
      scene,
      camera,
      "demand-frame",
    );
  }, 1);

  return null;
}

function ModelLayer({
  attemptKey,
  health,
  props,
}: {
  readonly attemptKey: string;
  readonly health: ContextHealth;
  readonly props: SceneCanvasPortProps;
}) {
  if (!(props.loadEnabled && props.scene.modelUrl)) return null;

  return (
    <Suspense fallback={null}>
      <SceneModel
        attemptKey={attemptKey}
        scene={props.scene}
        rotation={props.rotation}
      />
      {props.scene.groundShadow ? (
        <AuthoredGroundShadow definition={props.scene.groundShadow} />
      ) : null}
      <DemandRenderer
        adoptionVersion={props.adoptionVersion}
        debugActive={props.debugActive}
        health={health}
        sceneDefinition={props.scene}
        sceneId={props.scene.id}
        onFirstFrame={props.onFirstFrame}
        onFailure={props.onFailure}
      />
    </Suspense>
  );
}

export function SceneCanvasContents(props: SceneCanvasPortProps) {
  const [health] = useState(createContextHealth);
  const resetKey = `${props.scene.id}:${props.activationVersion}:${props.renderVersion}`;

  return (
    <>
      <ResponsiveCamera scene={props.scene} />
      <SceneRendererSettings scene={props.scene} />
      <SceneLights scene={props.scene} />
      <ContextLifecycle
        health={health}
        onContextLost={props.onContextLost}
        onContextRestored={props.onContextRestored}
        sceneId={props.scene.id}
      />
      <SceneErrorBoundary resetKey={resetKey} onError={props.onFailure}>
        <ModelLayer
          key={resetKey}
          attemptKey={resetKey}
          health={health}
          props={props}
        />
      </SceneErrorBoundary>
    </>
  );
}

function createFailurePort(
  initial: SceneCanvasPortProps["onFailure"],
): {
  readonly report: SceneCanvasPortProps["onFailure"];
  readonly update: (next: SceneCanvasPortProps["onFailure"]) => void;
} {
  let current = initial;
  return {
    report: (reason) => current(reason),
    update: (next) => {
      current = next;
    },
  };
}

function createActivationFailureGate() {
  let reportedKey: string | null = null;
  return {
    report: (key: string, callback: () => void) => {
      if (reportedKey === key) return;
      reportedKey = key;
      callback();
    },
  };
}

interface RendererAvailability {
  readonly isFailed: () => boolean;
  readonly markFailed: () => void;
}

function createRendererAvailability(): RendererAvailability {
  let failed = false;
  return {
    isFailed: () => failed,
    markFailed: () => {
      failed = true;
    },
  };
}

function SceneCanvasGate({
  availability,
  props,
}: {
  readonly availability: RendererAvailability;
  readonly props: SceneCanvasPortProps;
}) {
  return availability.isFailed() ? null : (
    <SceneCanvasContents {...props} />
  );
}

export function SceneCanvas(props: SceneCanvasPortProps) {
  const [failurePort] = useState(() => createFailurePort(props.onFailure));
  const [failureGate] = useState(createActivationFailureGate);
  const [availability] = useState(createRendererAvailability);
  const [rendererFailed, setRendererFailed] = useState(false);
  useLayoutEffect(() => {
    failurePort.update(props.onFailure);
  }, [failurePort, props.onFailure]);
  const [rendererFactory] = useState(() =>
    createWebGL2RendererFactory(() => {
      availability.markFailed();
      setRendererFailed(true);
    }),
  );

  useEffect(() => {
    if (!rendererFailed) return;
    failureGate.report(
      `${props.scene.id}:${props.activationVersion}`,
      () => failurePort.report("webgl2-unavailable"),
    );
  }, [
    failureGate,
    failurePort,
    props.activationVersion,
    props.scene.id,
    rendererFailed,
  ]);
  const initializeCamera = useCallback(
    ({ camera, gl, size }: RootState) => {
      // Canvas otherwise renders once from its desktop-only camera prop before
      // ResponsiveCamera's layout effect can apply the measured breakpoint.
      // Configure the complete registry frame during root creation so even the
      // first possible WebGL render matches the poster and later live frames.
      const frame = cameraFrameForEnvironment(props.scene, size.width);
      const tracing = sceneRuntimeTraceEnabled();
      const before = tracing ? traceCamera(camera, frame) : null;
      applyCameraFrame(
        camera,
        frame,
        size.height > 0 ? size.width / size.height : undefined,
      );
      camera.updateMatrixWorld();
      if (tracing && gl instanceof WebGLRenderer) {
        traceSceneRuntime("camera:root-created", {
          after: traceCamera(camera, frame),
          before,
          canvasDom: snapshotSceneCanvasDom(gl.domElement),
          expectedFrame: traceCameraFrame(frame),
          mode: frame === props.scene.mobile ? "mobile" : "desktop",
          r3fSize: size,
          sceneId: props.scene.id,
        });
      }
    },
    [props.scene],
  );

  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={
        props.debugActive === false
          ? INACTIVE_SCENE_DPR
          : ACTIVE_SCENE_DPR
      }
      resize={{ scroll: false }}
      shadows={false}
      camera={{
        position: [...props.scene.desktop.cameraPosition],
        fov: props.scene.desktop.fov,
      }}
      gl={rendererFactory}
      events={createDisabledSceneEventManager}
      onCreated={initializeCamera}
    >
      <SceneCanvasGate availability={availability} props={props} />
    </Canvas>
  );
}
