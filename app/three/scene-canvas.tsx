"use client";

import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  PerspectiveCamera,
  WebGLRenderer,
  type Camera,
  type WebGLRendererParameters,
} from "three";
import { AdjacentScenePreloader } from "./adjacent-scene-preloader";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { SceneErrorBoundary } from "./scene-error-boundary";
import { SceneModel } from "./scene-model";
import type {
  SceneDefinition,
  SceneFailureReason,
  SceneRotation,
} from "./types";

export interface SceneCanvasPortProps {
  readonly scene: SceneDefinition;
  readonly rotation: SceneRotation;
  readonly activationVersion: number;
  readonly renderVersion: number;
  readonly loadEnabled: boolean;
  readonly preloadReady: boolean;
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
    return construct({
      ...defaults,
      ...WEBGL2_ATTRIBUTES,
      context,
    });
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
    const frame = width <= 767 ? scene.mobile : scene.desktop;
    applyCameraFrame(camera, frame);
    invalidate();
  }, [camera, invalidate, scene, width]);

  return null;
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

function SceneLights({ scene }: { readonly scene: SceneDefinition }) {
  return (
    <>
      <ambientLight
        color={scene.lighting.ambient.color}
        intensity={scene.lighting.ambient.intensity}
      />
      <directionalLight
        color={scene.lighting.key.color}
        intensity={scene.lighting.key.intensity}
        position={scene.lighting.key.position}
        castShadow={false}
      />
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

function DemandRenderer({
  health,
  sceneId,
  onFirstFrame,
  onFailure,
}: Pick<SceneCanvasPortProps, "onFirstFrame" | "onFailure"> & {
  readonly health: ContextHealth;
  readonly sceneId: SceneDefinition["id"];
}) {
  const reported = useRef(false);
  const failed = useRef(false);
  const frameTimes = useRef<number[]>([]);

  useFrame(({ gl, scene, camera }) => {
    if (
      failed.current ||
      health.isLost() ||
      rendererContextIsLost(gl as WebGLRenderer)
    ) {
      return;
    }

    const renderer = gl as WebGLRenderer;
    const generation = health.getGeneration();
    const frameBefore = renderer.info.render.frame;
    try {
      gl.render(scene, camera);
      if (
        health.isLost() ||
        health.getGeneration() !== generation ||
        rendererContextIsLost(renderer) ||
        renderer.info.render.frame <= frameBefore
      ) {
        return;
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
      <DemandRenderer
        health={health}
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
      <SceneLights scene={props.scene} />
      <ContextLifecycle
        health={health}
        onContextLost={props.onContextLost}
        onContextRestored={props.onContextRestored}
      />
      <AdjacentScenePreloader
        activeSceneId={props.scene.id}
        enabled={props.loadEnabled}
        ready={props.preloadReady}
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

  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={[1, 1.5]}
      shadows={false}
      camera={{
        position: [...props.scene.desktop.cameraPosition],
        fov: props.scene.desktop.fov,
      }}
      gl={rendererFactory}
    >
      <SceneCanvasGate availability={availability} props={props} />
    </Canvas>
  );
}
