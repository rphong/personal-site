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
  readonly adoptionVersion?: number;
  readonly active?: boolean;
  readonly showPoster?: boolean;
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
  adoptionVersion = 0,
  active = true,
  showPoster = true,
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
  }, [
    descriptor,
    getCurrentAttempt,
    onStatusChange,
    renderVersion,
  ]);

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
      data-transition-frame="none"
      data-transition-poster="retired"
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
            adoptionVersion={adoptionVersion}
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

export const MAX_CONNECTED_LIVE_SCENES = 8;

interface ResidentStage {
  readonly activationVersion: number;
  adoptionVersion: number;
  readonly key: string;
  lastSeen: number;
  readonly scene: LiveSceneDefinition;
  section: HTMLElement | null;
  readonly stage: HTMLElement;
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
        entry.adoptionVersion === right[index]?.adoptionVersion &&
        entry.key === right[index]?.key &&
        entry.scene.id === right[index]?.scene.id &&
        entry.section === right[index]?.section &&
        entry.stage === right[index]?.stage,
    )
  );
}

function useResidentStages(
  pathname: string,
  activeSceneId: SceneId,
  poolElement: HTMLDivElement | null,
) {
  const [stages, setStages] = useState<readonly ResidentStage[]>([]);
  const residents = useRef<ResidentStage[]>([]);
  const nextStageIdentity = useRef(0);
  const lastSeenClock = useRef(0);
  const pathnameRef = useRef(pathname);
  const activeSceneIdRef = useRef(activeSceneId);
  const lastActiveSceneId = useRef<SceneId | null>(null);
  const syncStagesRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!poolElement) return;

    const park = (resident: ResidentStage) => {
      resident.section = null;
      resident.stage.dataset.scenePoolState = "pooled";
      poolElement.append(resident.stage);
    };

    const touch = (resident: ResidentStage) => {
      lastSeenClock.current += 1;
      resident.lastSeen = lastSeenClock.current;
      resident.stage.dataset.scenePoolLastSeen = String(resident.lastSeen);
    };

    const createResident = (scene: LiveSceneDefinition) => {
      while (residents.current.length >= MAX_CONNECTED_LIVE_SCENES) {
        const eviction = residents.current
          .filter((candidate) => candidate.section === null)
          .sort((left, right) => left.lastSeen - right.lastSeen)[0];
        if (!eviction) return null;
        residents.current = residents.current.filter(
          (candidate) => candidate !== eviction,
        );
        eviction.stage.dataset.scenePoolState = "evicted";
        eviction.stage.remove();
      }

      const activationVersion = nextStageIdentity.current;
      nextStageIdentity.current += 1;
      const stage = document.createElement("div");
      stage.className = "scene-stage scene-stage--resident";
      stage.setAttribute("aria-hidden", "true");
      stage.dataset.sceneResidentStage = "true";
      stage.dataset.sceneOwnerId = scene.id;
      stage.dataset.sceneFor = scene.id;
      stage.dataset.scenePoolKey = `resident-stage-${activationVersion}`;
      stage.dataset.scenePoolState = "pooled";
      const resident: ResidentStage = {
        activationVersion,
        adoptionVersion: 0,
        key: `resident-stage-${activationVersion}`,
        lastSeen: 0,
        scene,
        section: null,
        stage,
      };
      residents.current.push(resident);
      poolElement.append(stage);
      return resident;
    };

    const syncStages = () => {
      const currentPathname = pathnameRef.current;
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>(
          'section.scene-section[data-required-live="true"]',
        ),
      ).filter((section) => {
        const sceneId = section.dataset.sceneId;
        if (!sceneId || !isSceneId(sceneId)) return false;
        const scene = getSceneDefinition(sceneId);
        return (
          scene.requiredLive &&
          (currentPathname === "/scene-capture" ||
            scene.route === currentPathname)
        );
      });
      const eligibleSections = new Set(
        sections.slice(0, MAX_CONNECTED_LIVE_SCENES),
      );

      for (const resident of residents.current) {
        if (
          resident.section &&
          (!eligibleSections.has(resident.section) ||
            resident.section.dataset.sceneId !== resident.scene.id)
        ) {
          park(resident);
        }
      }

      const assigned = new Set<ResidentStage>();
      for (const section of eligibleSections) {
        const sceneId = section.dataset.sceneId;
        if (!sceneId || !isSceneId(sceneId)) continue;
        const scene = getSceneDefinition(sceneId);
        if (!scene.requiredLive) continue;
        let resident = residents.current.find(
          (candidate) =>
            candidate.section === section && candidate.scene.id === scene.id,
        );
        if (!resident) {
          resident = residents.current
            .filter(
              (candidate) =>
                candidate.section === null &&
                candidate.scene.id === scene.id &&
                !assigned.has(candidate),
            )
            .sort((left, right) => right.lastSeen - left.lastSeen)[0];
        }
        resident ??= createResident(scene) ?? undefined;
        if (!resident) continue;

        if (resident.section !== section) {
          resident.section = section;
          resident.adoptionVersion += 1;
          touch(resident);
        }
        resident.stage.dataset.scenePoolState = "assigned";
        resident.stage.dataset.scenePoolLastSeen = String(resident.lastSeen);
        const content = section.querySelector(":scope > .scene-section__content");
        if (
          resident.stage.parentElement !== section ||
          resident.stage.nextSibling !== content
        ) {
          section.insertBefore(resident.stage, content);
        }
        assigned.add(resident);
      }

      const currentActiveSceneId = activeSceneIdRef.current;
      if (lastActiveSceneId.current !== currentActiveSceneId) {
        lastActiveSceneId.current = currentActiveSceneId;
        for (const resident of assigned) {
          if (resident.scene.id === currentActiveSceneId) touch(resident);
        }
      }

      for (const resident of residents.current) {
        if (resident.section && !assigned.has(resident)) park(resident);
      }

      const next = residents.current.map((resident) => ({ ...resident }));
      setStages((current) =>
        residentStageListsMatch(current, next) ? current : next,
      );
    };

    syncStagesRef.current = syncStages;
    syncStages();
    const observer = new MutationObserver(syncStages);
    observer.observe(document.body, {
      attributeFilter: ["data-required-live", "data-scene-id"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => {
      syncStagesRef.current = null;
      observer.disconnect();
      for (const resident of residents.current) resident.stage.remove();
      residents.current = [];
    };
  }, [poolElement]);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    activeSceneIdRef.current = activeSceneId;
    syncStagesRef.current?.();
  }, [activeSceneId, pathname, poolElement]);

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
  adoptionVersion,
  canvasEnabled,
  initialActivationVersion,
  preferredStatus,
  activeRotation,
  onActiveStatus,
  onRotate,
}: {
  readonly scene: LiveSceneDefinition;
  readonly active: boolean;
  readonly adoptionVersion: number;
  readonly canvasEnabled: boolean;
  readonly initialActivationVersion: number;
  readonly preferredStatus: ThreeStatus;
  readonly activeRotation: SceneRotation;
  readonly onActiveStatus: (sceneId: LiveSceneId, status: ThreeStatus) => void;
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
      adoptionVersion={adoptionVersion}
      active={active}
      showPoster
      onStatusChange={setStatus}
      onRotate={onRotate}
      CanvasComponent={SceneCanvasBoundary}
    />
  );
}

export function SceneRuntimeHost() {
  const runtime = useSceneRuntime();
  const pathname = usePathname();
  const [poolElement, setPoolElement] = useState<HTMLDivElement | null>(null);
  const stages = useResidentStages(pathname, runtime.activeSceneId, poolElement);
  const preferredStatus = statusForRuntime({
    initialized: runtime.threeInitialized,
    enabled: runtime.threeEnabled,
    supported: runtime.threeSupported,
  });
  const canvasEnabled =
    runtime.sceneActivationAllowed && preferredStatus === "loading";

  const activeStatusChanged = useCallback(
    (sceneId: LiveSceneId, status: ThreeStatus) => {
      if (sceneId !== runtime.activeSceneId) return;
      runtime.setStatus(status);
    },
    [runtime],
  );

  return (
    <>
      <div
        aria-hidden="true"
        className="scene-resident-pool"
        data-scene-resident-pool
        data-scene-context-cap={MAX_CONNECTED_LIVE_SCENES}
        ref={setPoolElement}
      />
      <AdjacentScenePreloader
        activeSceneId={runtime.activeSceneId}
        enabled={canvasEnabled}
        ready={runtime.status === "ready"}
      />
      {stages.map(
        ({
          activationVersion,
          adoptionVersion,
          key,
          scene,
          stage,
        }) =>
          createPortal(
            <SceneResidentSlot
              key={key}
              scene={scene}
              active={runtime.activeSceneId === scene.id}
              adoptionVersion={adoptionVersion}
              canvasEnabled={canvasEnabled}
              initialActivationVersion={activationVersion}
              preferredStatus={preferredStatus}
              activeRotation={runtime.rotation}
              onActiveStatus={activeStatusChanged}
              onRotate={runtime.rotateBy}
            />,
            stage,
            key,
          ),
      )}
    </>
  );
}
