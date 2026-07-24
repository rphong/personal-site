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
  Color,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  type RectAreaLight,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
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
  sceneRuntimeTraceEnabled,
  sceneTraceIdentity,
  traceSceneRuntime,
  traceSceneStageSnapshot,
} from "./scene-runtime-trace";
import type {
  SceneDefinition,
  SceneFailureReason,
  SceneRotation,
} from "./types";

RectAreaLightUniformsLib.init();

export interface SceneCanvasPortProps {
  readonly scene: SceneDefinition;
  readonly rotation: SceneRotation;
  readonly activationVersion: number;
  readonly adoptionVersion?: number;
  readonly renderVersion: number;
  readonly loadEnabled: boolean;
  readonly preloadReady: boolean;
  readonly debugActive?: boolean;
  readonly onFirstFrame: (transitionFrame?: string) => void;
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
  const width = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    applyCameraFrame(camera, cameraFrameForWidth(scene, width));
    invalidate();
  }, [camera, invalidate, scene, width]);

  return null;
}

function cameraFrameForWidth(scene: SceneDefinition, width: number) {
  return width <= 767 ? scene.mobile : scene.desktop;
}

function applyCameraFrame(
  camera: Camera,
  frame: SceneDefinition["desktop"],
): void {
  camera.position.set(...frame.cameraPosition);
  camera.lookAt(...frame.cameraTarget);
  if (camera instanceof PerspectiveCamera) {
    camera.fov = frame.fov;
    camera.updateProjectionMatrix();
  }
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
}: Pick<SceneCanvasPortProps, "onContextLost" | "onContextRestored"> & {
  readonly health: ContextHealth;
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
      health.markLost();
      callbacks.reportLost();
    };
    const restored = () => {
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
  }, [callbacks, gl, health, invalidate]);

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

function traceCamera(camera: Camera) {
  return {
    aspect:
      "aspect" in camera && typeof camera.aspect === "number"
        ? camera.aspect
        : null,
    far:
      "far" in camera && typeof camera.far === "number" ? camera.far : null,
    fov:
      "fov" in camera && typeof camera.fov === "number" ? camera.fov : null,
    near:
      "near" in camera && typeof camera.near === "number"
        ? camera.near
        : null,
    position: [camera.position.x, camera.position.y, camera.position.z],
  };
}

function traceModelScreenBounds(
  scene: Scene,
  sceneId: SceneDefinition["id"],
  camera: Camera,
  canvas: HTMLCanvasElement,
) {
  const instance = scene.getObjectByName(`scene-instance:${sceneId}`);
  if (!instance) return null;
  const bounds = new Box3().setFromObject(instance);
  if (bounds.isEmpty()) return null;

  const corners = [
    new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ].map((corner) => corner.project(camera));
  const minX = Math.min(...corners.map(({ x }) => x));
  const maxX = Math.max(...corners.map(({ x }) => x));
  const minY = Math.min(...corners.map(({ y }) => y));
  const maxY = Math.max(...corners.map(({ y }) => y));

  return {
    height: ((maxY - minY) / 2) * canvas.clientHeight,
    maxX: ((maxX + 1) / 2) * canvas.clientWidth,
    maxY: ((1 - minY) / 2) * canvas.clientHeight,
    minX: ((minX + 1) / 2) * canvas.clientWidth,
    minY: ((1 - maxY) / 2) * canvas.clientHeight,
    width: ((maxX - minX) / 2) * canvas.clientWidth,
  };
}

function presentRenderedAdoption(
  canvas: HTMLCanvasElement,
  sceneId: SceneDefinition["id"],
  adoptionVersion: number,
) {
  const stage = canvas.closest<HTMLElement>("[data-scene-resident-stage]");
  if (
    !stage ||
    stage.dataset.scenePoolState !== "adopting" ||
    stage.dataset.sceneAdoptionVersion !== String(adoptionVersion)
  ) {
    return false;
  }

  stage.dataset.sceneRenderedAdoptionVersion = String(adoptionVersion);
  stage.dataset.scenePoolState = "assigned";
  traceSceneStageSnapshot(
    "canvas:adoption-presented",
    stage,
    sceneTraceIdentity(sceneId, adoptionVersion),
  );
  return true;
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
    (gl: WebGLRenderer, scene: typeof renderedScene, activeCamera: Camera) => {
      if (
        failed.current ||
        !sceneModelIsAttached(scene, sceneId) ||
        health.isLost() ||
        rendererContextIsLost(gl)
      ) {
        return;
      }

      const generation = health.getGeneration();
      const frameBefore = gl.info.render.frame;
      const tracing = sceneRuntimeTraceEnabled();
      if (tracing) {
        traceSceneRuntime("canvas:render-before", {
          ...sceneTraceIdentity(sceneId, adoptionVersion),
          buffer: {
            height: gl.domElement.height,
            width: gl.domElement.width,
          },
          camera: traceCamera(activeCamera),
          css: {
            height: gl.domElement.clientHeight,
            width: gl.domElement.clientWidth,
          },
          rendererFrame: frameBefore,
        });
      }
      try {
        gl.render(scene, activeCamera);
        if (
          health.isLost() ||
          health.getGeneration() !== generation ||
          rendererContextIsLost(gl) ||
          gl.info.render.frame <= frameBefore
        ) {
          return;
        }

        recordSceneRuntimeDebugFrame(gl, scene, sceneId);
        if (tracing) {
          traceSceneRuntime("canvas:render-after", {
            ...sceneTraceIdentity(sceneId, adoptionVersion),
            buffer: {
              height: gl.domElement.height,
              width: gl.domElement.width,
            },
            camera: traceCamera(activeCamera),
            css: {
              height: gl.domElement.clientHeight,
              width: gl.domElement.clientWidth,
            },
            modelScreenBounds: traceModelScreenBounds(
              scene,
              sceneId,
              activeCamera,
              gl.domElement,
            ),
            rendererFrame: gl.info.render.frame,
          });
        }
        if (
          presentedAdoptionVersion.current !== adoptionVersion &&
          presentRenderedAdoption(gl.domElement, sceneId, adoptionVersion)
        ) {
          presentedAdoptionVersion.current = adoptionVersion;
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
      } catch {
        failed.current = true;
        onFailure("unknown");
      }
    },
    [adoptionVersion, health, onFailure, onFirstFrame, sceneId],
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
            cameraFrameForWidth(
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
        cameraFrameForWidth(sceneDefinition, bounds.width),
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
            cameraFrameForWidth(sceneDefinition, bounds?.width ?? 0) ===
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
    renderFrame(renderer, renderedScene, camera);
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
    renderFrame(gl as WebGLRenderer, scene, camera);
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
    ({ camera, size }: RootState) => {
      // Canvas otherwise renders once from its desktop-only camera prop before
      // ResponsiveCamera's layout effect can apply the measured breakpoint.
      // Configure the complete registry frame during root creation so even the
      // first possible WebGL render matches the poster and later live frames.
      applyCameraFrame(camera, cameraFrameForWidth(props.scene, size.width));
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
      onCreated={initializeCamera}
    >
      <SceneCanvasGate availability={availability} props={props} />
    </Canvas>
  );
}
