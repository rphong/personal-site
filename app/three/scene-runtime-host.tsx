"use client";

import type { ComponentType, CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { SceneCanvasBoundary } from "./scene-canvas-boundary";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { ScenePoster } from "./scene-poster";
import { SceneRotationArea } from "./scene-rotation-area";
import { useSceneRuntime } from "./scene-runtime-context";
import type {
  SceneDefinition,
  SceneFailureReason,
  SceneId,
  SceneRotation,
  ThreeStatus,
} from "./types";

const LIVE_LOAD_TIMEOUT_MS = 10_000;

interface ActivationDescriptor {
  readonly token: string;
  readonly sceneId: SceneId;
}

interface ActivationCycle {
  readonly startedAt: number;
  committed: boolean;
  generation: number;
  phase: ThreeStatus;
  readyEventSent: boolean;
  failureEventSent: boolean;
  terminalFailure: boolean;
}

interface CurrentAttempt {
  readonly descriptor: ActivationDescriptor;
  readonly cycle: ActivationCycle;
}

function createActivationCycle(generation: number): ActivationCycle {
  return {
    startedAt: performance.now(),
    committed: false,
    generation,
    phase: "poster",
    readyEventSent: false,
    failureEventSent: false,
    terminalFailure: false,
  };
}

function activationDuration(cycle: ActivationCycle) {
  return Math.max(0, Math.round(performance.now() - cycle.startedAt));
}

export interface SceneRuntimeHostViewProps {
  readonly scene: SceneDefinition;
  readonly status: ThreeStatus;
  readonly canvasEnabled: boolean;
  readonly rotation: SceneRotation;
  readonly activationVersion: number;
  readonly onStatusChange: (status: ThreeStatus) => void;
  readonly onRotate: (
    deltaX: number,
    deltaY: number,
    allowPitch: boolean,
  ) => void;
  readonly CanvasComponent: ComponentType<SceneCanvasPortProps>;
}

export function SceneRuntimeHostView({
  scene,
  status,
  canvasEnabled,
  rotation,
  activationVersion,
  onStatusChange,
  onRotate,
  CanvasComponent,
}: SceneRuntimeHostViewProps) {
  const [renderVersion, setRenderVersion] = useState(0);
  const activationToken = `${scene.id}:${activationVersion}`;
  const [posterReadyToken, setPosterReadyToken] = useState<string | null>(null);
  const posterReady = posterReadyToken === activationToken;
  const activePosterToken = useRef(activationToken);
  const descriptor = useMemo<ActivationDescriptor>(
    () => ({ token: activationToken, sceneId: scene.id }),
    [activationToken, scene.id],
  );
  const renderVersionRef = useRef(renderVersion);
  const currentAttempt = useRef<CurrentAttempt | null>(null);

  useLayoutEffect(() => {
    activePosterToken.current = activationToken;
  }, [activationToken]);

  const posterLoaded = useCallback(
    (image: HTMLImageElement) => {
      const candidateToken = activationToken;
      const markReady = () => {
        if (
          activePosterToken.current === candidateToken &&
          image.isConnected
        ) {
          setPosterReadyToken(candidateToken);
        }
      };

      if (typeof image.decode !== "function") {
        markReady();
        return;
      }

      void image.decode().then(markReady, () => {
        // Keep the section-owned poster visible when decoding fails.
      });
    },
    [activationToken],
  );

  useLayoutEffect(() => {
    renderVersionRef.current = renderVersion;
  }, [renderVersion]);

  useLayoutEffect(() => {
    let attempt = currentAttempt.current;
    if (!attempt || attempt.descriptor !== descriptor) {
      attempt = {
        descriptor,
        cycle: createActivationCycle(renderVersionRef.current),
      };
      currentAttempt.current = attempt;
    }
    attempt.cycle.committed = true;
    return () => {
      attempt.cycle.committed = false;
    };
  }, [descriptor]);

  useLayoutEffect(() => {
    const attempt = currentAttempt.current;
    if (
      attempt?.descriptor !== descriptor ||
      !attempt.cycle.committed ||
      attempt.cycle.terminalFailure
    ) {
      return;
    }

    const { cycle } = attempt;
    cycle.phase = status;
    if (status === "ready") cycle.readyEventSent = true;
    if (status === "error") cycle.terminalFailure = true;
  }, [descriptor, status]);

  const getCurrentAttempt = useCallback(
    (
      candidate: ActivationDescriptor,
      candidateGeneration: number,
    ): ActivationCycle | null => {
      const attempt = currentAttempt.current;
      if (
        attempt?.descriptor !== candidate ||
        !attempt.cycle.committed ||
        attempt.cycle.generation !== candidateGeneration
      ) {
        return null;
      }
      return attempt.cycle;
    },
    [],
  );

  const failAttempt = useCallback(
    (
      candidate: ActivationDescriptor,
      candidateGeneration: number,
      reason: SceneFailureReason,
      requiredPhase?: ThreeStatus,
    ) => {
      const cycle = getCurrentAttempt(candidate, candidateGeneration);
      if (!cycle || cycle.terminalFailure) return;
      if (requiredPhase && cycle.phase !== requiredPhase) return;
      if (cycle.phase !== "loading" && cycle.phase !== "ready") {
        return;
      }

      cycle.terminalFailure = true;
      cycle.phase = "error";
      onStatusChange("error");
      if (cycle.failureEventSent) return;
      cycle.failureEventSent = true;
      emitSceneRuntimeEvent({
        status: "failure",
        sceneId: candidate.sceneId,
        reason,
        durationMs: activationDuration(cycle),
      });
    },
    [getCurrentAttempt, onStatusChange],
  );

  const reportFailure = useCallback(
    (reason: SceneFailureReason) => {
      failAttempt(descriptor, renderVersion, reason);
    },
    [descriptor, failAttempt, renderVersion],
  );

  const firstFrame = useCallback(() => {
    const cycle = getCurrentAttempt(descriptor, renderVersion);
    if (!cycle || cycle.terminalFailure || cycle.phase !== "loading") return;

    cycle.phase = "ready";
    onStatusChange("ready");
    if (cycle.readyEventSent) return;
    cycle.readyEventSent = true;
    emitSceneRuntimeEvent({
      status: "ready",
      sceneId: descriptor.sceneId,
      durationMs: activationDuration(cycle),
    });
  }, [descriptor, getCurrentAttempt, onStatusChange, renderVersion]);

  const contextLost = useCallback(() => {
    const cycle = getCurrentAttempt(descriptor, renderVersion);
    if (!cycle || cycle.terminalFailure || cycle.phase === "context-lost") {
      return;
    }
    if (
      cycle.phase === "error" ||
      cycle.phase === "unsupported" ||
      cycle.phase === "disabled"
    ) {
      return;
    }

    cycle.phase = "context-lost";
    onStatusChange("context-lost");
    emitSceneRuntimeEvent({
      status: "context-lost",
      sceneId: descriptor.sceneId,
      reason: "context-lost",
    });
  }, [descriptor, getCurrentAttempt, onStatusChange, renderVersion]);

  const contextRestored = useCallback(() => {
    const cycle = getCurrentAttempt(descriptor, renderVersion);
    if (!cycle || cycle.terminalFailure || cycle.phase !== "context-lost") {
      return;
    }

    const nextRenderVersion = renderVersion + 1;
    cycle.generation = nextRenderVersion;
    cycle.phase = scene.modelUrl ? "loading" : "poster";
    onStatusChange(cycle.phase);
    setRenderVersion(nextRenderVersion);
  }, [
    descriptor,
    getCurrentAttempt,
    onStatusChange,
    renderVersion,
    scene.modelUrl,
  ]);

  useEffect(() => {
    if (
      status !== "loading" ||
      !canvasEnabled ||
      !scene.modelUrl ||
      !getCurrentAttempt(descriptor, renderVersion)
    ) {
      return;
    }

    const timeout = window.setTimeout(
      () => failAttempt(descriptor, renderVersion, "timeout", "loading"),
      LIVE_LOAD_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [
    canvasEnabled,
    descriptor,
    failAttempt,
    getCurrentAttempt,
    renderVersion,
    scene.modelUrl,
    status,
  ]);

  useEffect(() => {
    if (status !== "unsupported") return;
    const cycle = getCurrentAttempt(descriptor, renderVersion);
    if (!cycle || cycle.failureEventSent) return;

    cycle.terminalFailure = true;
    cycle.failureEventSent = true;
    emitSceneRuntimeEvent({
      status: "failure",
      sceneId: descriptor.sceneId,
      reason: "webgl2-unavailable",
      durationMs: activationDuration(cycle),
    });
  }, [descriptor, getCurrentAttempt, renderVersion, status]);

  return (
    <div
      aria-hidden="true"
      className="scene-runtime"
      data-testid="scene-runtime-host"
      data-three-status={status}
      data-active-scene-id={scene.id}
      data-poster-ready={posterReady ? "true" : "false"}
      style={{ "--scene-background": scene.background } as CSSProperties}
    >
      <ScenePoster
        key={activationToken}
        scene={scene}
        className="scene-runtime__poster"
        onLoad={posterLoaded}
        priority
      />
      {canvasEnabled ? (
        <div className="scene-runtime__canvas">
          <CanvasComponent
            scene={scene}
            rotation={rotation}
            activationVersion={activationVersion}
            renderVersion={renderVersion}
            loadEnabled={status !== "error"}
            preloadReady={status === "ready"}
            onFirstFrame={firstFrame}
            onFailure={reportFailure}
            onContextLost={contextLost}
            onContextRestored={contextRestored}
          />
        </div>
      ) : null}
      {status === "ready" ? (
        <SceneRotationArea
          desktop={scene.desktop.rotationArea}
          mobile={scene.mobile.rotationArea}
          onDelta={onRotate}
        />
      ) : null}
    </div>
  );
}

export function SceneRuntimeHost() {
  const runtime = useSceneRuntime();
  return (
    <SceneRuntimeHostView
      scene={runtime.activeScene}
      status={runtime.status}
      canvasEnabled={
        runtime.sceneActivationAllowed &&
        runtime.threeInitialized &&
        runtime.threeEnabled &&
        runtime.threeSupported
      }
      rotation={runtime.rotation}
      activationVersion={runtime.activationVersion}
      onStatusChange={runtime.setStatus}
      onRotate={runtime.rotateBy}
      CanvasComponent={SceneCanvasBoundary}
    />
  );
}
