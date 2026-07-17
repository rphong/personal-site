import { act, render, screen } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { warmLiveSceneModels } from "./adjacent-scene-preloader";
import { InitialDocumentLoadingScreen } from "./initial-document-loading-screen";
import { getSceneDefinition } from "./scene-registry";
import {
  SceneRuntimeContext,
  type SceneRuntimeContextValue,
} from "./scene-runtime-context";
import type { ThreeStatus } from "./types";

let pathname = "/";
let reducedMotion = false;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("./adjacent-scene-preloader", () => ({
  warmLiveSceneModels: vi.fn(),
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function runtimeValue(
  status: ThreeStatus,
  overrides: Partial<SceneRuntimeContextValue> = {},
): SceneRuntimeContextValue {
  const activeScene = getSceneDefinition("home-hero");
  return {
    activeScene,
    activeSceneId: activeScene.id,
    activeSectionElement: null,
    sceneStageElement: null,
    activationVersion: 0,
    sceneActivationAllowed: true,
    status,
    rotation: activeScene.rotation.default,
    threeEnabled: true,
    threeInitialized: true,
    threeSupported: true,
    activateScene: vi.fn(),
    registerSection: vi.fn(() => vi.fn()),
    registerSceneStage: vi.fn(),
    rotateBy: vi.fn(),
    setStatus: vi.fn(),
    setThreeEnabled: vi.fn(),
    ...overrides,
  };
}

function Harness({
  status,
  overrides,
  children,
}: {
  readonly status: ThreeStatus;
  readonly overrides?: Partial<SceneRuntimeContextValue>;
  readonly children?: ReactNode;
}) {
  return (
    <SceneRuntimeContext.Provider value={runtimeValue(status, overrides)}>
      <InitialDocumentLoadingScreen />
      <div className="site-shell">{children ?? <button>Site action</button>}</div>
      <button className="three-preference-toggle">3D on</button>
      <aside className="scene-debug">
        <button>Debug action</button>
      </aside>
    </SceneRuntimeContext.Provider>
  );
}

describe("InitialDocumentLoadingScreen", () => {
  beforeEach(() => {
    pathname = "/";
    reducedMotion = false;
    vi.useFakeTimers();
    vi.mocked(warmLiveSceneModels).mockReset();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: reducedMotion,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  });

  it("waits for fonts, eager models, and the landing frame before fading", async () => {
    const fonts = deferred();
    const models = deferred();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fonts.promise },
    });
    vi.mocked(warmLiveSceneModels).mockReturnValue(models.promise);

    const view = render(<Harness status="loading" />);
    await flushEffects();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-loading-phase",
      "visible",
    );
    expect(screen.getByText("Richard Phong")).toBeInTheDocument();
    expect(view.container.querySelector(".site-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(view.container.querySelector<HTMLElement>(".site-shell")?.inert).toBe(
      true,
    );
    expect(
      view.container.querySelector<HTMLElement>(".three-preference-toggle")
        ?.inert,
    ).toBe(true);
    expect(view.container.querySelector<HTMLElement>(".scene-debug")?.inert).toBe(
      true,
    );
    const replacementDebugPanel = document.createElement("aside");
    replacementDebugPanel.className = "scene-debug";
    view.container.append(replacementDebugPanel);
    await flushEffects();
    expect(replacementDebugPanel.inert).toBe(true);

    view.rerender(<Harness status="ready" />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      fonts.resolve();
      models.resolve();
      await fonts.promise;
      await models.promise;
    });
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-loading-phase",
      "exiting",
    );

    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(view.container.querySelector(".site-shell")).not.toHaveAttribute(
      "aria-busy",
    );
    expect(view.container.querySelector<HTMLElement>(".site-shell")?.inert).toBe(
      false,
    );
    expect(
      view.container.querySelector<HTMLElement>(".three-preference-toggle")
        ?.inert,
    ).toBe(false);
    expect(view.container.querySelector<HTMLElement>(".scene-debug")?.inert).toBe(
      false,
    );
    expect(replacementDebugPanel.inert).toBe(false);
    replacementDebugPanel.remove();
  });

  it.each([
    {
      name: "explicit 3D off",
      status: "disabled" as const,
      overrides: { threeEnabled: false },
    },
    {
      name: "Save-Data initialization",
      status: "poster" as const,
      overrides: { threeEnabled: false, threeInitialized: false },
    },
    {
      name: "unsupported WebGL2",
      status: "unsupported" as const,
      overrides: { threeEnabled: false, threeSupported: false },
    },
  ])("never appears for $name", ({ status, overrides }) => {
    vi.mocked(warmLiveSceneModels).mockResolvedValue();
    render(<Harness status={status} overrides={overrides} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(warmLiveSceneModels).not.toHaveBeenCalled();
  });

  it("dismisses on client navigation and never returns in the document", async () => {
    vi.mocked(warmLiveSceneModels).mockReturnValue(new Promise(() => undefined));
    const view = render(<Harness status="loading" />);
    await flushEffects();
    expect(screen.getByRole("status")).toBeInTheDocument();

    pathname = "/projects";
    view.rerender(<Harness status="loading" />);
    await flushEffects();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    pathname = "/";
    view.rerender(<Harness status="loading" />);
    await flushEffects();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is fully removed by the four-second cap", async () => {
    vi.mocked(warmLiveSceneModels).mockReturnValue(new Promise(() => undefined));
    render(<Harness status="loading" />);
    await flushEffects();
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_600));
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-loading-phase",
      "exiting",
    );
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("retains its four-second cap through StrictMode effect replay", async () => {
    vi.mocked(warmLiveSceneModels).mockReturnValue(new Promise(() => undefined));
    render(
      <StrictMode>
        <Harness status="loading" />
      </StrictMode>,
    );
    await flushEffects();
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_600));
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-loading-phase",
      "exiting",
    );
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("exits instantly when reduced motion is requested", async () => {
    reducedMotion = true;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.mocked(warmLiveSceneModels).mockResolvedValue();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    const view = render(<Harness status="loading" />);
    await flushEffects();
    expect(screen.getByRole("status")).toBeInTheDocument();

    view.rerender(<Harness status="ready" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
