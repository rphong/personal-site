"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyRotationDelta, resetSceneRotation } from "./rotation";
import { SceneRuntimeBoundary } from "./scene-runtime-boundary";
import {
  getRouteHeroSceneId,
  getSceneDefinition,
} from "./scene-registry";
import {
  SceneRuntimeContext,
  type SceneRuntimeContextValue,
} from "./scene-runtime-context";
import { useThreePreference } from "./three-preference";
import { ThreePreferenceToggle } from "./three-preference-toggle";
import { SceneDebugPanel } from "./scene-debug-panel";
import { traceSceneRuntime } from "./scene-runtime-trace";
import { applySceneTuning } from "./scene-tuning";
import type {
  SceneId,
  SceneRotation,
  SceneTuning,
  ThreeStatus,
} from "./types";

interface Registration {
  readonly sceneId: SceneId;
  readonly pathname: string;
}

interface PreferenceSnapshot {
  readonly initialized: boolean;
  readonly supported: boolean;
  readonly enabled: boolean;
}

interface RuntimeState {
  readonly pathname: string;
  readonly activeSceneId: SceneId;
  readonly activationVersion: number;
  readonly activationAllowed: boolean;
  readonly status: ThreeStatus;
  readonly rotation: SceneRotation;
}

const SCENE_ACTIVATION_VIEWPORT_RATIO = 0.08;

function createRouteState(
  pathname: string,
  activationVersion: number,
): RuntimeState {
  const activeSceneId = getRouteHeroSceneId(pathname);
  const activeScene = getSceneDefinition(activeSceneId);
  return {
    pathname,
    activeSceneId,
    activationVersion,
    activationAllowed: activeScene.route === pathname,
    status: "poster",
    rotation: resetSceneRotation(activeScene.rotation),
  };
}

function preferredStatus(
  sceneId: SceneId,
  preference: PreferenceSnapshot,
  activationAllowed: boolean,
): ThreeStatus {
  if (!activationAllowed) return "poster";
  const scene = getSceneDefinition(sceneId);
  if (!scene.requiredLive) return "poster";
  if (!preference.initialized) return "poster";
  if (!preference.supported) return "unsupported";
  if (!preference.enabled) return "disabled";
  return "loading";
}

function effectiveStatus(
  state: RuntimeState,
  preference: PreferenceSnapshot,
): ThreeStatus {
  const preferred = preferredStatus(
    state.activeSceneId,
    preference,
    state.activationAllowed,
  );
  if (preferred !== "loading") return preferred;
  return state.status === "poster" ? "loading" : state.status;
}

export function SceneProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const preference = useThreePreference();
  const persistThreeEnabled = preference.setEnabled;
  const [state, setState] = useState<RuntimeState>(() =>
    createRouteState(pathname, 0),
  );
  const [activeSectionElement, setActiveSectionElement] =
    useState<HTMLElement | null>(null);
  const [sceneStageElement, setSceneStageElement] =
    useState<HTMLElement | null>(null);
  const sceneStageElementRef = useRef<HTMLElement | null>(null);
  const activeRegistrationRef = useRef({
    pathname: state.pathname,
    sceneId: state.activeSceneId,
  });
  useLayoutEffect(() => {
    activeRegistrationRef.current = {
      pathname: state.pathname,
      sceneId: state.activeSceneId,
    };
  }, [state.activeSceneId, state.pathname]);
  const [debugTuning, setDebugTuningState] = useState<{
    readonly sceneId: SceneId;
    readonly tuning: SceneTuning;
  } | null>(null);

  if (state.pathname !== pathname) {
    setState(createRouteState(pathname, state.activationVersion + 1));
  }

  const pathnameRef = useRef(pathname);
  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    traceSceneRuntime("provider:pathname-layout", {
      activeSceneId: state.activeSceneId,
      activationAllowed: state.activationAllowed,
      activationVersion: state.activationVersion,
      pathname,
      status: state.status,
    });
  }, [
    pathname,
    state.activeSceneId,
    state.activationAllowed,
    state.activationVersion,
    state.status,
  ]);

  const registrations = useRef(new Map<Element, Registration>());
  const observer = useRef<IntersectionObserver | null>(null);

  const activateScene = useCallback((sceneId: SceneId) => {
    const currentPathname = pathnameRef.current;
    const scene = getSceneDefinition(sceneId);
    if (
      currentPathname !== "/scene-capture" &&
      scene.route !== currentPathname
    ) {
      return;
    }
    const matchingElement = [...registrations.current.entries()].find(
      ([, registration]) =>
        registration.sceneId === sceneId &&
        registration.pathname === currentPathname,
    )?.[0];
    setActiveSectionElement(
      matchingElement instanceof HTMLElement ? matchingElement : null,
    );
    setState((current) => {
      if (current.pathname !== currentPathname) return current;
      if (
        current.activeSceneId === sceneId &&
        current.activationAllowed
      ) {
        return current;
      }
      return {
        ...current,
        activeSceneId: sceneId,
        activationVersion: current.activationVersion + 1,
        activationAllowed: true,
        status: "poster",
        rotation: resetSceneRotation(getSceneDefinition(sceneId).rotation),
      };
    });
  }, []);

  const ensureObserver = useCallback(() => {
    if (observer.current || typeof IntersectionObserver === "undefined") {
      return observer.current;
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        const candidates = entries
          .filter((entry) => {
            const registration = registrations.current.get(entry.target);
            return (
              entry.isIntersecting &&
              registration?.pathname === pathnameRef.current
            );
          })
          .sort(
            (left, right) =>
              Math.abs(
                left.boundingClientRect.top -
                  window.innerHeight * SCENE_ACTIVATION_VIEWPORT_RATIO,
              ) -
              Math.abs(
                right.boundingClientRect.top -
                  window.innerHeight * SCENE_ACTIVATION_VIEWPORT_RATIO,
              ),
          );

        const registration = candidates[0]
          ? registrations.current.get(candidates[0].target)
          : null;
        if (registration) activateScene(registration.sceneId);
      },
      {
        root: null,
        rootMargin: "-8% 0px -91% 0px",
        threshold: 0,
      },
    );
    return observer.current;
  }, [activateScene]);

  const registerSection = useCallback(
    (sceneId: SceneId, element: HTMLElement) => {
      registrations.current.set(element, { sceneId, pathname });
      ensureObserver()?.observe(element);
      const activeRegistration = activeRegistrationRef.current;
      if (
        activeRegistration.pathname === pathname &&
        activeRegistration.sceneId === sceneId
      ) {
        setActiveSectionElement(element);
      }

      return () => {
        observer.current?.unobserve(element);
        registrations.current.delete(element);
        setActiveSectionElement((current) =>
          current === element ? null : current,
        );
      };
    },
    [ensureObserver, pathname],
  );

  const registerSceneStage = useCallback((element: HTMLElement | null) => {
    sceneStageElementRef.current = element;
    setSceneStageElement(element);
  }, []);

  useLayoutEffect(() => {
    const stage = sceneStageElementRef.current;
    if (!stage || !activeSectionElement) return;
    activeSectionElement.append(stage);
    stage.dataset.sceneOwnerId = state.activeSceneId;
  }, [activeSectionElement, sceneStageElement, state.activeSceneId]);

  useEffect(
    () => () => {
      observer.current?.disconnect();
      registrations.current.clear();
    },
    [],
  );

  const activationPathname = state.pathname;
  const activationSceneId = state.activeSceneId;
  const activationVersion = state.activationVersion;

  const setStatus = useCallback(
    (status: ThreeStatus) => {
      setState((current) => {
        if (
          current.pathname !== activationPathname ||
          current.activeSceneId !== activationSceneId ||
          current.activationVersion !== activationVersion
        ) {
          return current;
        }
        return current.status === status ? current : { ...current, status };
      });
    },
    [activationPathname, activationSceneId, activationVersion],
  );

  const rotateBy = useCallback(
    (deltaX: number, deltaY: number, allowPitch: boolean) => {
      setState((current) => {
        if (
          current.pathname !== activationPathname ||
          current.activeSceneId !== activationSceneId ||
          current.activationVersion !== activationVersion
        ) {
          return current;
        }
        const rotation = applyRotationDelta(
          current.rotation,
          { deltaX, deltaY, allowPitch },
          getSceneDefinition(current.activeSceneId).rotation,
        );
        if (
          rotation.yaw === current.rotation.yaw &&
          rotation.pitch === current.rotation.pitch
        ) {
          return current;
        }
        return { ...current, rotation };
      });
    },
    [activationPathname, activationSceneId, activationVersion],
  );

  const setThreeEnabled = useCallback(
    (enabled: boolean) => {
      setState((current) => ({
        ...current,
        activationVersion: current.activationVersion + 1,
        status: enabled ? "poster" : "disabled",
      }));
      persistThreeEnabled(enabled);
    },
    [persistThreeEnabled],
  );

  const setDebugTuning = useCallback(
    (sceneId: SceneId, tuning: SceneTuning | null) => {
      setDebugTuningState(tuning ? { sceneId, tuning } : null);
    },
    [],
  );

  const status = effectiveStatus(state, preference);
  const registeredScene = getSceneDefinition(state.activeSceneId);
  const activeScene = useMemo(
    () =>
      applySceneTuning(
        registeredScene,
        debugTuning?.sceneId === state.activeSceneId
          ? debugTuning.tuning
          : undefined,
      ),
    [debugTuning, registeredScene, state.activeSceneId],
  );
  const value = useMemo<SceneRuntimeContextValue>(
    () => ({
      activeSceneId: state.activeSceneId,
      activeScene,
      activeSectionElement,
      sceneStageElement,
      activationVersion: state.activationVersion,
      sceneActivationAllowed: state.activationAllowed,
      status,
      rotation: state.rotation,
      threeInitialized: preference.initialized,
      threeEnabled: preference.enabled,
      threeSupported: preference.supported,
      activateScene,
      registerSection,
      registerSceneStage,
      setStatus,
      rotateBy,
      setThreeEnabled,
      setDebugTuning,
    }),
    [
      activeScene,
      activeSectionElement,
      sceneStageElement,
      activateScene,
      preference.enabled,
      preference.initialized,
      preference.supported,
      registerSection,
      registerSceneStage,
      rotateBy,
      setStatus,
      setThreeEnabled,
      setDebugTuning,
      state.activeSceneId,
      state.activationVersion,
      state.activationAllowed,
      state.rotation,
      status,
    ],
  );

  return (
    <SceneRuntimeContext.Provider value={value}>
      <SceneRuntimeBoundary />
      {children}
      <ThreePreferenceToggle />
      <SceneDebugPanel />
    </SceneRuntimeContext.Provider>
  );
}
