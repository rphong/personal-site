"use client";

import { usePathname } from "next/navigation";
import type { ComponentType, CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdjacentScenePreloader } from "./adjacent-scene-preloader";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { SceneCanvasBoundary } from "./scene-canvas-boundary";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { clearSceneModel } from "./scene-loader";
import { getSceneDefinition, isSceneId } from "./scene-registry";
import { ScenePoster } from "./scene-poster";
import { SceneRotationArea } from "./scene-rotation-area";
import { useSceneRuntime } from "./scene-runtime-context";
import type {
  LiveSceneDefinition,
  LiveSceneId,
  SceneDefinition,
  SceneFailureReason,
  SceneFrameSnapshot,
  SceneId,
  SceneRotation,
  SiteRoute,
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
  readonly active?: boolean;
  readonly showPoster?: boolean;
  readonly transitionFrame?: SceneFrameSnapshot | null;
  readonly onFrameProven?: (frame: SceneFrameSnapshot) => void;
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
  active = true,
  showPoster = true,
  transitionFrame: suppliedTransitionFrame = null,
  onFrameProven,
  onStatusChange,
  onRotate,
  CanvasComponent,
}: SceneRuntimeHostViewProps) {
  const [renderVersion, setRenderVersion] = useState(0);
  const [capturedFrame, setCapturedFrame] =
    useState<SceneFrameSnapshot | null>(null);
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
      if (!cycle || cycle.terminalFailure) return false;
      if (requiredPhase && cycle.phase !== requiredPhase) return false;
      if (cycle.phase !== "loading" && cycle.phase !== "ready") {
        return false;
      }

      cycle.terminalFailure = true;
      cycle.phase = "error";
      onStatusChange("error");
      if (!cycle.failureEventSent) {
        cycle.failureEventSent = true;
        emitSceneRuntimeEvent({
          status: "failure",
          sceneId: candidate.sceneId,
          reason,
          durationMs: activationDuration(cycle),
        });
      }
      return true;
    },
    [getCurrentAttempt, onStatusChange],
  );

  const reportFailure = useCallback(
    (reason: SceneFailureReason) => {
      failAttempt(descriptor, renderVersion, reason);
    },
    [descriptor, failAttempt, renderVersion],
  );

  const firstFrame = useCallback(
    (snapshot?: string) => {
      const cycle = getCurrentAttempt(descriptor, renderVersion);
      if (!cycle || cycle.terminalFailure) return;

      if (typeof snapshot === "string" && scene.requiredLive) {
        const frame: SceneFrameSnapshot = {
          dataUrl: snapshot,
          route: scene.route,
          sceneId: scene.id,
        };
        setCapturedFrame(frame);
        onFrameProven?.(frame);
      }
      if (cycle.phase !== "loading") return;

      cycle.phase = "ready";
      onStatusChange("ready");
      if (cycle.readyEventSent) return;
      cycle.readyEventSent = true;
      emitSceneRuntimeEvent({
        status: "ready",
        sceneId: descriptor.sceneId,
        durationMs: activationDuration(cycle),
      });
    },
    [
      descriptor,
      getCurrentAttempt,
      onFrameProven,
      onStatusChange,
      renderVersion,
      scene,
    ],
  );

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

    const timeout = window.setTimeout(() => {
      if (!failAttempt(descriptor, renderVersion, "timeout", "loading")) {
        return;
      }
      clearSceneModel(scene.modelUrl);
    }, LIVE_LOAD_TIMEOUT_MS);
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

  const transitionFrame = suppliedTransitionFrame ?? capturedFrame;
  const visibleTransitionFrame =
    status === "loading" && transitionFrame?.route !== scene.route
      ? transitionFrame
      : null;
  const suppressTransitionPoster = Boolean(visibleTransitionFrame);
  const canvasClassName = active
    ? "scene-runtime__canvas"
    : "scene-runtime__resident-canvas";

  return (
    <div
      aria-hidden="true"
      className="scene-runtime scene-runtime--resident"
      data-testid={active ? "scene-runtime-host" : undefined}
      data-scene-runtime-host
      data-three-status={status}
      data-active-scene-id={scene.id}
      data-scene-active={active ? "true" : "false"}
      data-scene-for={scene.id}
      data-poster-ready={posterReady ? "true" : "false"}
      data-transition-frame={transitionFrame ? "available" : "none"}
      data-transition-poster={suppressTransitionPoster ? "suppressed" : "visible"}
      style={{ "--scene-background": scene.background } as CSSProperties}
    >
      {showPoster ? (
        <ScenePoster
          key={activationToken}
          scene={scene}
          className="scene-runtime__poster"
          onLoad={posterLoaded}
          priority
        />
      ) : null}
      {visibleTransitionFrame ? (
        <div
          className="scene-runtime__transition-frame"
          data-scene-occupant="stand-in"
          data-scene-for={scene.id}
          data-scene-frame-for={visibleTransitionFrame.sceneId}
          data-scene-frame-state="ready"
          style={{
            backgroundImage: `url("${visibleTransitionFrame.dataUrl}")`,
          }}
        />
      ) : null}
      {canvasEnabled ? (
        <div
          className={canvasClassName}
          data-scene-occupant="canvas"
          data-scene-for={scene.id}
          data-scene-frame-for={status === "ready" ? scene.id : "none"}
          data-scene-frame-state={status}
        >
          <CanvasComponent
            scene={scene}
            rotation={rotation}
            activationVersion={activationVersion}
            renderVersion={renderVersion}
            loadEnabled={status !== "error"}
            preloadReady={status === "ready"}
            debugActive={active}
            onFirstFrame={firstFrame}
            onFailure={reportFailure}
            onContextLost={contextLost}
            onContextRestored={contextRestored}
          />
        </div>
      ) : null}
      {active && status === "ready" ? (
        <SceneRotationArea
          desktop={scene.desktop.rotationArea}
          mobile={scene.mobile.rotationArea}
          onDelta={onRotate}
        />
      ) : null}
    </div>
  );
}

const MAX_LIVE_SCENE_OCCUPANTS = 4;

interface ResidentStage {
  readonly activationVersion: number;
  readonly key: string;
  readonly scene: LiveSceneDefinition;
  readonly section: HTMLElement;
  readonly stage: HTMLElement;
}

interface RouteBridge extends SceneFrameSnapshot {
  readonly destinationRoute: SiteRoute;
}

function residentStageListsMatch(
  left: readonly ResidentStage[],
  right: readonly ResidentStage[],
) {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.activationVersion === right[index]?.activationVersion &&
        entry.key === right[index]?.key &&
        entry.scene.id === right[index]?.scene.id &&
        entry.section === right[index]?.section &&
        entry.stage === right[index]?.stage,
    )
  );
}

function useResidentStages(pathname: string) {
  const [stages, setStages] = useState<readonly ResidentStage[]>([]);
  const ownedStages = useRef(new Map<HTMLElement, HTMLElement>());
  const stageIdentities = useRef(
    new WeakMap<HTMLElement, { activationVersion: number; key: string }>(),
  );
  const nextStageIdentity = useRef(0);

  useLayoutEffect(() => {
    const syncStages = () => {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>(
          'section.scene-section[data-required-live="true"]',
        ),
      );
      const next: ResidentStage[] = [];

      for (const section of sections) {
        const sceneId = section.dataset.sceneId;
        if (!sceneId || !isSceneId(sceneId)) continue;
        const scene = getSceneDefinition(sceneId);
        if (!scene.requiredLive) continue;
        if (pathname !== "/scene-capture" && scene.route !== pathname) continue;
        if (next.length >= MAX_LIVE_SCENE_OCCUPANTS) break;

        let stage = ownedStages.current.get(section);
        if (
          stage &&
          stage.isConnected &&
          stage.dataset.sceneOwnerId !== scene.id
        ) {
          stage.remove();
          ownedStages.current.delete(section);
          stage = undefined;
        }
        if (!stage || !stage.isConnected) {
          stage = document.createElement("div");
          stage.className = "scene-stage scene-stage--resident";
          stage.setAttribute("aria-hidden", "true");
          stage.dataset.sceneResidentStage = "true";
          stage.dataset.sceneOwnerId = scene.id;
          stage.dataset.sceneFor = scene.id;
          const content = section.querySelector(":scope > .scene-section__content");
          section.insertBefore(stage, content);
          ownedStages.current.set(section, stage);
        }
        let identity = stageIdentities.current.get(stage);
        if (!identity) {
          const activationVersion = nextStageIdentity.current;
          nextStageIdentity.current += 1;
          identity = {
            activationVersion,
            key: `resident-stage-${activationVersion}`,
          };
          stageIdentities.current.set(stage, identity);
        }
        next.push({ ...identity, scene, section, stage });
      }

      const retainedSections = new Set(next.map(({ section }) => section));
      for (const [section, stage] of ownedStages.current) {
        if (retainedSections.has(section)) continue;
        stage.remove();
        ownedStages.current.delete(section);
      }

      setStages((current) =>
        residentStageListsMatch(current, next) ? current : next,
      );
    };

    syncStages();
    const observer = new MutationObserver(syncStages);
    observer.observe(document.body, {
      attributeFilter: ["data-required-live", "data-scene-id"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      for (const stage of ownedStages.current.values()) stage.remove();
      ownedStages.current.clear();
    };
  }, [pathname]);

  return stages;
}

function statusForRuntime({
  initialized,
  enabled,
  supported,
}: {
  readonly initialized: boolean;
  readonly enabled: boolean;
  readonly supported: boolean;
}): ThreeStatus {
  if (!initialized) return "poster";
  if (!supported) return "unsupported";
  if (!enabled) return "disabled";
  return "loading";
}

function SceneResidentSlot({
  scene,
  active,
  bridge,
  canvasEnabled,
  initialActivationVersion,
  preferredStatus,
  activeRotation,
  onActiveStatus,
  onFrameProven,
  onRotate,
}: {
  readonly scene: LiveSceneDefinition;
  readonly active: boolean;
  readonly bridge: SceneFrameSnapshot | null;
  readonly canvasEnabled: boolean;
  readonly initialActivationVersion: number;
  readonly preferredStatus: ThreeStatus;
  readonly activeRotation: SceneRotation;
  readonly onActiveStatus: (sceneId: LiveSceneId, status: ThreeStatus) => void;
  readonly onFrameProven: (frame: SceneFrameSnapshot) => void;
  readonly onRotate: SceneRuntimeHostViewProps["onRotate"];
}) {
  const [status, setStatus] = useState<ThreeStatus>(preferredStatus);
  const [activationVersion, setActivationVersion] = useState(
    initialActivationVersion,
  );
  const previousPreferredStatus = useRef(preferredStatus);
  const wasActive = useRef(active);
  const rotation = active ? activeRotation : scene.rotation.default;

  useLayoutEffect(() => {
    const previous = previousPreferredStatus.current;
    previousPreferredStatus.current = preferredStatus;
    if (preferredStatus === "loading") {
      if (previous !== "loading") setActivationVersion((value) => value + 1);
      setStatus((current) =>
        current === "ready" && previous === "loading" ? current : "loading",
      );
      return;
    }
    setStatus(preferredStatus);
  }, [preferredStatus]);

  useLayoutEffect(() => {
    const becameActive = active && !wasActive.current;
    wasActive.current = active;
    if (
      !becameActive ||
      preferredStatus !== "loading" ||
      status !== "error"
    ) {
      return;
    }
    setActivationVersion((value) => value + 1);
    setStatus("loading");
  }, [active, preferredStatus, status]);

  useLayoutEffect(() => {
    if (active) onActiveStatus(scene.id, status);
  }, [active, onActiveStatus, scene.id, status]);

  return (
    <SceneRuntimeHostView
      scene={scene}
      status={status}
      canvasEnabled={canvasEnabled}
      rotation={rotation}
      activationVersion={activationVersion}
      active={active}
      showPoster
      transitionFrame={active ? bridge : null}
      onFrameProven={onFrameProven}
      onStatusChange={setStatus}
      onRotate={onRotate}
      CanvasComponent={SceneCanvasBoundary}
    />
  );
}

export function SceneRuntimeHost() {
  const runtime = useSceneRuntime();
  const pathname = usePathname();
  const stages = useResidentStages(pathname);
  const provenFrames = useRef(new Map<LiveSceneId, SceneFrameSnapshot>());
  const lastActiveFrame = useRef<SceneFrameSnapshot | null>(null);
  const previousActivation = useRef({
    route: runtime.activeScene.route,
    sceneId: runtime.activeSceneId,
  });
  const [routeBridge, setRouteBridge] = useState<RouteBridge | null>(null);
  const preferredStatus = statusForRuntime({
    initialized: runtime.threeInitialized,
    enabled: runtime.threeEnabled,
    supported: runtime.threeSupported,
  });
  const canvasEnabled =
    runtime.sceneActivationAllowed && preferredStatus === "loading";

  useLayoutEffect(() => {
    const previous = previousActivation.current;
    const nextRoute = runtime.activeScene.route;
    if (previous.route !== nextRoute) {
      const frame =
        provenFrames.current.get(previous.sceneId as LiveSceneId) ??
        lastActiveFrame.current;
      setRouteBridge(
        frame ? { ...frame, destinationRoute: nextRoute } : null,
      );
    }
    const currentFrame = provenFrames.current.get(
      runtime.activeSceneId as LiveSceneId,
    );
    if (currentFrame) lastActiveFrame.current = currentFrame;
    previousActivation.current = {
      route: nextRoute,
      sceneId: runtime.activeSceneId,
    };
  }, [runtime.activeScene.route, runtime.activeSceneId]);

  const frameProven = useCallback(
    (frame: SceneFrameSnapshot) => {
      provenFrames.current.set(frame.sceneId, frame);
      if (frame.sceneId === runtime.activeSceneId) {
        lastActiveFrame.current = frame;
      }
    },
    [runtime.activeSceneId],
  );

  const activeStatusChanged = useCallback(
    (sceneId: LiveSceneId, status: ThreeStatus) => {
      if (sceneId !== runtime.activeSceneId) return;
      runtime.setStatus(status);
      if (
        status === "ready" &&
        routeBridge?.destinationRoute === runtime.activeScene.route
      ) {
        setRouteBridge(null);
      }
    },
    [routeBridge, runtime],
  );

  return (
    <>
      <AdjacentScenePreloader
        activeSceneId={runtime.activeSceneId}
        enabled={canvasEnabled}
        ready={runtime.status === "ready"}
      />
      {stages.map(({ activationVersion, key, scene, stage }) =>
        createPortal(
          <SceneResidentSlot
            key={key}
            scene={scene}
            active={runtime.activeSceneId === scene.id}
            bridge={
              routeBridge?.destinationRoute === scene.route ? routeBridge : null
            }
            canvasEnabled={canvasEnabled}
            initialActivationVersion={activationVersion}
            preferredStatus={preferredStatus}
            activeRotation={runtime.rotation}
            onActiveStatus={activeStatusChanged}
            onFrameProven={frameProven}
            onRotate={runtime.rotateBy}
          />,
          stage,
          key,
        ),
      )}
    </>
  );
}
