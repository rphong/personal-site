"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { warmLiveSceneModels } from "./adjacent-scene-preloader";
import { LIVE_SCENE_IDS } from "./scene-registry";
import { useSceneRuntime } from "./scene-runtime-context";
import styles from "./initial-document-loading-screen.module.css";

const HARD_CAP_MS = 12_000;
const EXIT_DURATION_MS = 400;
const FALLBACK_FADE_START_MS = HARD_CAP_MS - EXIT_DURATION_MS;

type LoadingPhase = "pending" | "visible" | "exiting" | "done";
type FrameWarmupPhase = "loading" | "ready" | "fallback";

const TERMINAL_FRAME_STATUSES = new Set([
  "context-lost",
  "disabled",
  "error",
  "unsupported",
]);

export function liveSceneFrameWarmupPhase(
  root: ParentNode,
): FrameWarmupPhase {
  const statusesByScene = new Map<string, Set<string>>();
  for (const host of root.querySelectorAll<HTMLElement>(
    "[data-scene-runtime-host][data-scene-for][data-three-status]",
  )) {
    const sceneId = host.dataset.sceneFor;
    const status = host.dataset.threeStatus;
    if (!sceneId || !status) continue;
    const statuses = statusesByScene.get(sceneId) ?? new Set<string>();
    statuses.add(status);
    statusesByScene.set(sceneId, statuses);
  }

  let usesFallback = false;
  for (const sceneId of LIVE_SCENE_IDS) {
    const statuses = statusesByScene.get(sceneId);
    if (statuses?.has("ready")) continue;
    if (
      statuses &&
      [...statuses].some((status) => TERMINAL_FRAME_STATUSES.has(status))
    ) {
      usesFallback = true;
      continue;
    }
    return "loading";
  }
  return usesFallback ? "fallback" : "ready";
}

export function InitialDocumentLoadingScreen() {
  const pathname = usePathname();
  const runtime = useSceneRuntime();
  const [initialPathname] = useState(pathname);
  const started = useRef(false);
  const screenElement = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<LoadingPhase>("pending");
  const [fontsReady, setFontsReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [frameWarmupPhase, setFrameWarmupPhase] =
    useState<FrameWarmupPhase>("loading");

  const isInitialLiveDocument =
    runtime.activeScene.requiredLive &&
    runtime.activeScene.route === initialPathname;
  const isInitialDocumentRoute = pathname === initialPathname;
  const canLoadInitialScene =
    isInitialLiveDocument &&
    isInitialDocumentRoute &&
    runtime.sceneActivationAllowed &&
    runtime.threeInitialized &&
    runtime.threeEnabled &&
    runtime.threeSupported;

  const finishImmediately = useCallback(() => setPhase("done"), []);

  const beginExit = useCallback(() => {
    setPhase((current) => {
      if (current !== "visible") return current;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return "done";
      }
      return "exiting";
    });
  }, []);

  useEffect(() => {
    if (
      isInitialLiveDocument &&
      isInitialDocumentRoute &&
      (!runtime.threeInitialized || canLoadInitialScene) &&
      runtime.status !== "disabled" &&
      runtime.status !== "unsupported" &&
      runtime.status !== "error" &&
      runtime.status !== "context-lost"
    ) {
      return;
    }

    let current = true;
    queueMicrotask(() => {
      if (current) finishImmediately();
    });
    return () => {
      current = false;
    };
  }, [
    canLoadInitialScene,
    finishImmediately,
    isInitialDocumentRoute,
    isInitialLiveDocument,
    runtime.status,
    runtime.threeInitialized,
  ]);

  useEffect(() => {
    if (
      started.current ||
      !canLoadInitialScene ||
      runtime.status !== "loading"
    ) {
      return;
    }

    started.current = true;
    setPhase("visible");

    const fontSet = document.fonts;
    void (fontSet?.ready ?? Promise.resolve()).then(() => {
      setFontsReady(true);
    });
    void warmLiveSceneModels().then(() => {
      setModelsReady(true);
    });

  }, [canLoadInitialScene, runtime.status]);

  useEffect(() => {
    if (!canLoadInitialScene || phase !== "visible") return;

    let current = true;
    const checkFrames = () => {
      if (!current) return;
      const nextPhase = liveSceneFrameWarmupPhase(document);
      setFrameWarmupPhase((previous) =>
        previous === nextPhase ? previous : nextPhase,
      );
    };

    const observer = new MutationObserver(checkFrames);
    observer.observe(document.documentElement, {
      attributeFilter: ["data-scene-for", "data-three-status"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    checkFrames();

    return () => {
      current = false;
      observer.disconnect();
    };
  }, [canLoadInitialScene, phase]);

  useEffect(() => {
    if (phase !== "visible") return;
    const fallbackFadeTimer = window.setTimeout(
      beginExit,
      FALLBACK_FADE_START_MS,
    );
    const hardCapTimer = window.setTimeout(finishImmediately, HARD_CAP_MS);
    return () => {
      window.clearTimeout(fallbackFadeTimer);
      window.clearTimeout(hardCapTimer);
    };
  }, [beginExit, finishImmediately, phase]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const exitTimer = window.setTimeout(finishImmediately, EXIT_DURATION_MS);
    return () => window.clearTimeout(exitTimer);
  }, [finishImmediately, phase]);

  useEffect(() => {
    if (
      phase !== "visible" ||
      !fontsReady ||
      !modelsReady ||
      frameWarmupPhase === "loading" ||
      runtime.status !== "ready"
    ) {
      return;
    }

    let current = true;
    queueMicrotask(() => {
      if (current) beginExit();
    });
    return () => {
      current = false;
    };
  }, [
    beginExit,
    fontsReady,
    frameWarmupPhase,
    modelsReady,
    phase,
    runtime.status,
  ]);

  useEffect(() => {
    if (phase !== "visible" && phase !== "exiting") return;

    const screen = screenElement.current;
    const shell = document.querySelector<HTMLElement>(".site-shell");
    const root = document.documentElement;
    const previousBusy = shell?.getAttribute("aria-busy") ?? null;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const parent = screen?.parentElement ?? null;
    const previousInert = new Map<HTMLElement, boolean>();
    const makeInert = (element: Element) => {
      if (!(element instanceof HTMLElement) || element === screen) return;
      if (!previousInert.has(element)) {
        previousInert.set(element, element.inert ?? false);
      }
      element.inert = true;
    };
    for (const element of parent?.children ?? []) makeInert(element);
    const observer = parent
      ? new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof Element) makeInert(node);
            }
          }
        })
      : null;
    if (parent && observer) observer.observe(parent, { childList: true });

    if (shell) shell.setAttribute("aria-busy", "true");
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      observer?.disconnect();
      if (shell) {
        if (previousBusy === null) shell.removeAttribute("aria-busy");
        else shell.setAttribute("aria-busy", previousBusy);
      }
      for (const [element, inert] of previousInert) element.inert = inert;
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [phase]);

  const progressLabel = useMemo(() => {
    if (!fontsReady) return "Preparing type";
    if (!modelsReady) return "Preparing scenes";
    if (frameWarmupPhase === "loading") return "Rendering scenes";
    if (frameWarmupPhase === "fallback") return "Preparing scene posters";
    return "Preparing first frame";
  }, [fontsReady, frameWarmupPhase, modelsReady]);

  if (phase === "pending" || phase === "done") return null;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={styles.screen}
      ref={screenElement}
      data-initial-loading-screen
      data-loading-fonts={fontsReady ? "ready" : "loading"}
      data-loading-frames={frameWarmupPhase}
      data-loading-models={modelsReady ? "ready" : "loading"}
      data-loading-phase={phase}
      data-loading-scene={runtime.status}
      role="status"
      style={
        {
          "--loading-background": runtime.activeScene.background,
        } as CSSProperties
      }
    >
      <div className={styles.content}>
        <span className={styles.wordmark}>Richard Phong</span>
        <span className={styles.progress} aria-hidden="true">
          <span className={styles.progressFill} />
        </span>
        <span className={styles.label}>{progressLabel}</span>
      </div>
    </div>
  );
}
