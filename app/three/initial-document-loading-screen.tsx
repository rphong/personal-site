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
import { useSceneRuntime } from "./scene-runtime-context";
import styles from "./initial-document-loading-screen.module.css";

const HARD_CAP_MS = 4_000;
const EXIT_DURATION_MS = 400;
const FALLBACK_FADE_START_MS = HARD_CAP_MS - EXIT_DURATION_MS;

type LoadingPhase = "pending" | "visible" | "exiting" | "done";

export function InitialDocumentLoadingScreen() {
  const pathname = usePathname();
  const runtime = useSceneRuntime();
  const [initialPathname] = useState(pathname);
  const started = useRef(false);
  const screenElement = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<LoadingPhase>("pending");
  const [fontsReady, setFontsReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  const isInitialLandingDocument = initialPathname === "/";
  const isInitialDocumentRoute = pathname === initialPathname;
  const canLoadLandingScene =
    isInitialLandingDocument &&
    isInitialDocumentRoute &&
    runtime.sceneActivationAllowed &&
    runtime.activeScene.id === "home-hero" &&
    runtime.activeScene.requiredLive &&
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
      isInitialLandingDocument &&
      isInitialDocumentRoute &&
      (!runtime.threeInitialized || canLoadLandingScene) &&
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
    canLoadLandingScene,
    finishImmediately,
    isInitialDocumentRoute,
    isInitialLandingDocument,
    runtime.status,
    runtime.threeInitialized,
  ]);

  useEffect(() => {
    if (
      started.current ||
      !canLoadLandingScene ||
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

  }, [canLoadLandingScene, runtime.status]);

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
  }, [beginExit, fontsReady, modelsReady, phase, runtime.status]);

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
    return "Preparing first frame";
  }, [fontsReady, modelsReady]);

  if (phase === "pending" || phase === "done") return null;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={styles.screen}
      ref={screenElement}
      data-initial-loading-screen
      data-loading-fonts={fontsReady ? "ready" : "loading"}
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
