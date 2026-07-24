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
import {
  sceneRuntimeTraceEnabled,
  traceSceneRuntime,
} from "./scene-runtime-trace-core";
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
      rotation: state.rotation,
      status: state.status,
    });
  }, [
    pathname,
    state.activeSceneId,
    state.activationAllowed,
    state.activationVersion,
    state.rotation,
    state.status,
  ]);

  const registrations = useRef(new Map<Element, Registration>());
  const observer = useRef<IntersectionObserver | null>(null);

  const activateScene = useCallback((sceneId: SceneId) => {
    const currentPathname = pathnameRef.current;
    const scene = getSceneDefinition(sceneId);
    traceSceneRuntime("provider:activate-request", {
      currentPathname,
      sceneId,
      sceneRoute: scene.route,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    });
    if (
      currentPathname !== "/scene-capture" &&
      scene.route !== currentPathname
    ) {
      traceSceneRuntime("provider:activate-rejected", {
        currentPathname,
        reason: "route-mismatch",
        sceneId,
        sceneRoute: scene.route,
      });
      return;
    }
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
        if (sceneRuntimeTraceEnabled()) {
          traceSceneRuntime("provider:intersection", {
            candidates: candidates.map((entry) => ({
              boundingClientRect: {
                height: entry.boundingClientRect.height,
                left: entry.boundingClientRect.left,
                top: entry.boundingClientRect.top,
                width: entry.boundingClientRect.width,
              },
              intersectionRatio: entry.intersectionRatio,
              sceneId:
                registrations.current.get(entry.target)?.sceneId ?? null,
            })),
            entries: entries.map((entry) => ({
              intersectionRatio: entry.intersectionRatio,
              isIntersecting: entry.isIntersecting,
              sceneId:
                registrations.current.get(entry.target)?.sceneId ?? null,
            })),
            pathname: pathnameRef.current,
            selectedSceneId: registration?.sceneId ?? null,
          });
        }
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
      if (sceneRuntimeTraceEnabled()) {
        const rect = element.getBoundingClientRect();
        traceSceneRuntime("provider:section-register", {
          pathname,
          rect: {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          },
          sceneId,
        });
      }
      return () => {
        traceSceneRuntime("provider:section-unregister", {
          pathname,
          sceneId,
        });
        observer.current?.unobserve(element);
        registrations.current.delete(element);
      };
    },
    [ensureObserver, pathname],
  );

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
      traceSceneRuntime("provider:rotation-request", {
        allowPitch,
        deltaX,
        deltaY,
        sceneId: activationSceneId,
      });
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
      activationVersion: state.activationVersion,
      sceneActivationAllowed: state.activationAllowed,
      status,
      rotation: state.rotation,
      threeInitialized: preference.initialized,
      threeEnabled: preference.enabled,
      threeSupported: preference.supported,
      activateScene,
      registerSection,
      setStatus,
      rotateBy,
      setThreeEnabled,
      setDebugTuning,
    }),
    [
      activeScene,
      activateScene,
      preference.enabled,
      preference.initialized,
      preference.supported,
      registerSection,
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
