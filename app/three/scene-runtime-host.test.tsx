import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  StrictMode,
  useLayoutEffect,
  useState,
  type ComponentType,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { clearSceneModel } from "./scene-loader";
import { getSceneDefinition } from "./scene-registry";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { SceneRuntimeHostView } from "./scene-runtime-host";
import type { SceneId, ThreeStatus } from "./types";

vi.mock("./runtime-events", () => ({
  emitSceneRuntimeEvent: vi.fn(),
}));

vi.mock("./scene-loader", () => ({
  acquireSceneModelHostLease: vi.fn(() => Symbol("host-lease")),
  clearSceneModel: vi.fn(),
  preloadSceneModel: vi.fn(),
  releaseSceneModelHostLease: vi.fn(),
}));

let latestCanvasProps: SceneCanvasPortProps | null = null;

const FakeCanvas: ComponentType<SceneCanvasPortProps> = (props) => {
  useLayoutEffect(() => {
    latestCanvasProps = props;
  }, [props]);

  return (
    <div
      data-testid="fake-canvas"
      data-load-enabled={String(props.loadEnabled)}
      data-preload-ready={String(props.preloadReady)}
      data-render-version={props.renderVersion}
      data-scene-id={props.scene.id}
    >
      <button
        data-testid="first-frame"
        onClick={() => props.onFirstFrame()}
      />
      <button
        data-testid="transition-frame"
        onClick={() =>
          props.onFirstFrame("data:image/webp;base64,transition-frame")
        }
      />
      <button
        data-testid="fetch-failure"
        onClick={() => props.onFailure("fetch")}
      />
      <button
        data-testid="decode-failure"
        onClick={() => props.onFailure("decode")}
      />
      <button
        data-testid="renderer-failure"
        onClick={() => props.onFailure("webgl2-unavailable")}
      />
      <button data-testid="context-lost" onClick={props.onContextLost} />
      <button
        data-testid="context-restored"
        onClick={props.onContextRestored}
      />
    </div>
  );
};

function HostHarness({
  initialStatus = "loading",
  initialSceneId = "home-hero",
  canvasEnabled =
    initialStatus !== "unsupported" && initialStatus !== "disabled",
}: {
  readonly initialStatus?: ThreeStatus;
  readonly initialSceneId?: SceneId;
  readonly canvasEnabled?: boolean;
}) {
  const [status, setStatus] = useState<ThreeStatus>(initialStatus);
  return (
    <>
      <SceneRuntimeHostView
        scene={getSceneDefinition(initialSceneId)}
        status={status}
        canvasEnabled={canvasEnabled}
        rotation={{ yaw: 0, pitch: 0 }}
        activationVersion={0}
        onStatusChange={setStatus}
        onRotate={vi.fn()}
        CanvasComponent={FakeCanvas}
      />
      <a href="/experience">Experience</a>
    </>
  );
}

function SameRouteHarness() {
  const [sceneId, setSceneId] = useState<
    "experience-hero" | "experience-intro"
  >("experience-hero");
  const [activationVersion, setActivationVersion] = useState(0);
  const [status, setStatus] = useState<ThreeStatus>("loading");

  return (
    <>
      <SceneRuntimeHostView
        scene={getSceneDefinition(sceneId)}
        status={status}
        canvasEnabled
        rotation={{ yaw: 0, pitch: 0 }}
        activationVersion={activationVersion}
        onStatusChange={setStatus}
        onRotate={vi.fn()}
        CanvasComponent={FakeCanvas}
      />
      <button
        onClick={() => {
          setSceneId("experience-intro");
          setActivationVersion((version) => version + 1);
          setStatus("loading");
        }}
      >
        show intro
      </button>
    </>
  );
}

function PersistenceHarness() {
  const [sceneId, setSceneId] = useState<
    "home-hero" | "eog-poster" | "projects-hero"
  >("home-hero");
  const [activationVersion, setActivationVersion] = useState(0);
  const [status, setStatus] = useState<ThreeStatus>("loading");

  const activate = (
    nextSceneId: "home-hero" | "eog-poster" | "projects-hero",
    nextStatus: ThreeStatus,
  ) => {
    setSceneId(nextSceneId);
    setActivationVersion((version) => version + 1);
    setStatus(nextStatus);
  };

  return (
    <>
      <SceneRuntimeHostView
        scene={getSceneDefinition(sceneId)}
        status={status}
        canvasEnabled
        rotation={{ yaw: 0, pitch: 0 }}
        activationVersion={activationVersion}
        onStatusChange={setStatus}
        onRotate={vi.fn()}
        CanvasComponent={FakeCanvas}
      />
      <button onClick={() => activate("eog-poster", "poster")}>show EOG</button>
      <button onClick={() => activate("home-hero", "loading")}>
        reactivate home
      </button>
      <button onClick={() => activate("projects-hero", "loading")}>
        show projects
      </button>
    </>
  );
}

describe("SceneRuntimeHostView", () => {
  beforeEach(() => {
    latestCanvasProps = null;
    vi.mocked(clearSceneModel).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the poster visible until the fixed poster is decoded and the first live frame succeeds", async () => {
    render(<HostHarness />);

    const host = screen.getByTestId("scene-runtime-host");
    const canvas = screen.getByTestId("fake-canvas");
    const image = host.querySelector("img")!;
    let resolveDecode!: () => void;
    const decode = new Promise<void>((resolve) => {
      resolveDecode = resolve;
    });
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: vi.fn(() => decode),
    });
    expect(host).toHaveAttribute("data-three-status", "loading");
    expect(host).toHaveAttribute("data-poster-ready", "false");
    expect(host).toHaveAttribute("data-transition-poster", "visible");
    expect(host.querySelector("img")).toHaveAttribute(
      "src",
      "/posters/home-hero-desktop.webp",
    );
    expect(host.querySelector("img")).toHaveAttribute("loading", "eager");
    expect(host.querySelector("img")).toHaveAttribute(
      "fetchpriority",
      "high",
    );
    expect(host.querySelector("img")).toHaveAttribute("width", "1920");
    expect(host.querySelector("img")).toHaveAttribute("height", "1080");
    expect(host.querySelector("source")).toHaveAttribute(
      "srcset",
      "/posters/home-hero-mobile.webp",
    );
    expect(host.style.getPropertyValue("--scene-background")).toBe("#9ECCC0");
    fireEvent.load(image);
    expect(host).toHaveAttribute("data-poster-ready", "false");
    await act(async () => {
      resolveDecode();
      await decode;
      await Promise.resolve();
    });
    expect(host).toHaveAttribute("data-poster-ready", "true");
    expect(canvas).toHaveAttribute("data-load-enabled", "true");
    expect(canvas).toHaveAttribute("data-preload-ready", "false");
    expect(screen.queryByTestId("scene-rotation-area")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("first-frame"));

    expect(host).toHaveAttribute("data-three-status", "ready");
    expect(canvas).toHaveAttribute("data-preload-ready", "true");
    expect(screen.getByTestId("scene-rotation-area")).toBeInTheDocument();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready", sceneId: "home-hero" }),
    );

    fireEvent.click(screen.getByTestId("first-frame"));
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
  });

  it("keys fixed-poster readiness to the current activation and decoded image", async () => {
    render(<PersistenceHarness />);
    const host = screen.getByTestId("scene-runtime-host");
    const firstHomeImage = host.querySelector("img")!;
    Object.defineProperty(firstHomeImage, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    expect(host).toHaveAttribute("data-poster-ready", "false");
    fireEvent.load(firstHomeImage);
    await act(async () => {
      await Promise.resolve();
    });
    expect(host).toHaveAttribute("data-poster-ready", "true");

    fireEvent.click(screen.getByRole("button", { name: "show EOG" }));
    expect(host).toHaveAttribute("data-active-scene-id", "eog-poster");
    expect(host).toHaveAttribute("data-poster-ready", "false");
    const eogImage = host.querySelector("img")!;
    let resolveEogDecode!: () => void;
    const eogDecode = new Promise<void>((resolve) => {
      resolveEogDecode = resolve;
    });
    Object.defineProperty(eogImage, "decode", {
      configurable: true,
      value: vi.fn(() => eogDecode),
    });
    fireEvent.load(eogImage);
    expect(host).toHaveAttribute("data-poster-ready", "false");

    fireEvent.click(screen.getByRole("button", { name: "reactivate home" }));
    expect(host).toHaveAttribute("data-active-scene-id", "home-hero");
    expect(host).toHaveAttribute("data-poster-ready", "false");
    const secondHomeImage = host.querySelector("img")!;
    let resolveSecondHomeDecode!: () => void;
    const secondHomeDecode = new Promise<void>((resolve) => {
      resolveSecondHomeDecode = resolve;
    });
    Object.defineProperty(secondHomeImage, "decode", {
      configurable: true,
      value: vi.fn(() => secondHomeDecode),
    });
    fireEvent.load(secondHomeImage);
    expect(host).toHaveAttribute("data-poster-ready", "false");

    await act(async () => {
      resolveEogDecode();
      await eogDecode;
      await Promise.resolve();
    });
    expect(host).toHaveAttribute("data-poster-ready", "false");

    await act(async () => {
      resolveSecondHomeDecode();
      await secondHomeDecode;
      await Promise.resolve();
    });
    expect(host).toHaveAttribute("data-poster-ready", "true");
  });

  it.each(["fetch", "decode", "webgl2-unavailable"] as const)(
    "keeps the same Canvas mounted and disables loading after a %s failure",
    (reason) => {
      render(<HostHarness />);
      const canvas = screen.getByTestId("fake-canvas");

      act(() => latestCanvasProps?.onFailure(reason));

      expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
        "data-three-status",
        "error",
      );
      expect(screen.getByTestId("fake-canvas")).toBe(canvas);
      expect(canvas).toHaveAttribute("data-load-enabled", "false");
      expect(canvas).toHaveAttribute("data-preload-ready", "false");
      expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
      expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failure",
          sceneId: "home-hero",
          reason,
        }),
      );

      act(() => latestCanvasProps?.onFailure(reason));
      act(() => latestCanvasProps?.onFirstFrame());
      expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
      expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
        "data-three-status",
        "error",
      );
    },
  );

  it("times out a live load without unmounting the shell or accepting a late frame", () => {
    render(<HostHarness />);
    const canvas = screen.getByTestId("fake-canvas");

    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
    expect(screen.getByTestId("scene-runtime-host").querySelector("img"))
      .toBeInTheDocument();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        sceneId: "home-hero",
        reason: "timeout",
      }),
    );
    expect(clearSceneModel).toHaveBeenCalledOnce();
    expect(clearSceneModel).toHaveBeenCalledWith("/models/crane.glb");
    expect(screen.getByRole("link", { name: "Experience" })).toHaveAttribute(
      "href",
      "/experience",
    );

    act(() => latestCanvasProps?.onFirstFrame());
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
  });

  it("preserves one Canvas DOM node through live and poster-only activations", () => {
    render(<PersistenceHarness />);
    const canvas = screen.getByTestId("fake-canvas");

    fireEvent.click(screen.getByRole("button", { name: "show EOG" }));
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-scene-id", "eog-poster");
    expect(canvas).toHaveAttribute("data-load-enabled", "true");
    expect(canvas).toHaveAttribute("data-preload-ready", "false");

    fireEvent.click(screen.getByRole("button", { name: "show projects" }));
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-scene-id", "projects-hero");
  });

  it("commits readiness and its proven snapshot atomically", () => {
    render(<HostHarness />);
    const host = screen.getByTestId("scene-runtime-host");

    fireEvent.click(screen.getByTestId("transition-frame"));

    expect(host).toHaveAttribute("data-three-status", "ready");
    expect(host).toHaveAttribute("data-transition-frame", "available");
    expect(host).toHaveAttribute("data-transition-poster", "visible");
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
  });

  it("never presents a proven frame while switching scenes within one route", () => {
    render(<SameRouteHarness />);
    const host = screen.getByTestId("scene-runtime-host");
    fireEvent.click(screen.getByTestId("transition-frame"));
    expect(host).toHaveAttribute("data-three-status", "ready");

    fireEvent.click(screen.getByRole("button", { name: "show intro" }));

    expect(host).toHaveAttribute("data-active-scene-id", "experience-intro");
    expect(host).toHaveAttribute("data-three-status", "loading");
    expect(host).toHaveAttribute("data-transition-poster", "visible");
    expect(
      document.querySelector(".scene-runtime__transition-frame"),
    ).not.toBeInTheDocument();
  });

  it("suppresses stale transition posters only across routes after a live frame has been presented", () => {
    render(<PersistenceHarness />);
    const host = screen.getByTestId("scene-runtime-host");

    expect(host).toHaveAttribute("data-transition-poster", "visible");
    fireEvent.click(screen.getByTestId("first-frame"));
    expect(host).toHaveAttribute("data-three-status", "ready");
    expect(host).toHaveAttribute("data-transition-poster", "visible");
    fireEvent.click(screen.getByTestId("transition-frame"));
    expect(host).toHaveAttribute("data-transition-frame", "available");
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "show projects" }));
    expect(host).toHaveAttribute("data-three-status", "loading");
    expect(host).toHaveAttribute("data-transition-poster", "suppressed");
    expect(document.querySelector(".scene-runtime__transition-frame")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("first-frame"));
    expect(host).toHaveAttribute("data-three-status", "ready");
    expect(host).toHaveAttribute("data-transition-poster", "visible");

    fireEvent.click(screen.getByRole("button", { name: "show EOG" }));
    expect(host).toHaveAttribute("data-three-status", "poster");
    expect(host).toHaveAttribute("data-transition-poster", "visible");
  });

  it("reveals the poster during context loss and requests a fresh live frame", () => {
    render(<HostHarness />);
    const canvas = screen.getByTestId("fake-canvas");
    fireEvent.click(screen.getByTestId("first-frame"));
    fireEvent.click(screen.getByTestId("context-lost"));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "context-lost",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-load-enabled", "true");
    expect(canvas).toHaveAttribute("data-preload-ready", "false");
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith({
      status: "context-lost",
      sceneId: "home-hero",
      reason: "context-lost",
    });

    fireEvent.click(screen.getByTestId("context-restored"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    expect(canvas).toHaveAttribute("data-render-version", "1");
    fireEvent.click(screen.getByTestId("first-frame"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "ready",
    );
    expect(
      vi.mocked(emitSceneRuntimeEvent).mock.calls.filter(
        ([detail]) => detail.status === "ready",
      ),
    ).toHaveLength(1);
  });

  it("rejects spurious restoration and cannot revive a failed activation", () => {
    render(<HostHarness />);
    const canvas = screen.getByTestId("fake-canvas");

    fireEvent.click(screen.getByTestId("context-restored"));
    expect(canvas).toHaveAttribute("data-render-version", "0");
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );

    fireEvent.click(screen.getByTestId("fetch-failure"));
    fireEvent.click(screen.getByTestId("context-lost"));
    fireEvent.click(screen.getByTestId("context-restored"));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(canvas).toHaveAttribute("data-load-enabled", "false");
    expect(canvas).toHaveAttribute("data-preload-ready", "false");
    expect(canvas).toHaveAttribute("data-render-version", "0");
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
  });

  it("invalidates pre-loss attempt callbacks when a context is restored", () => {
    render(<HostHarness />);
    const canvas = screen.getByTestId("fake-canvas");
    const preLossProps = latestCanvasProps;

    fireEvent.click(screen.getByTestId("context-lost"));
    fireEvent.click(screen.getByTestId("context-restored"));
    expect(canvas).toHaveAttribute("data-render-version", "1");
    vi.mocked(emitSceneRuntimeEvent).mockClear();

    act(() => {
      preLossProps?.onFirstFrame();
      preLossProps?.onFailure("decode");
    });
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    expect(emitSceneRuntimeEvent).not.toHaveBeenCalled();

    act(() => latestCanvasProps?.onFirstFrame());
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "ready",
    );
  });

  it("pauses the loading timeout while context is lost and starts a fresh window", () => {
    render(<HostHarness />);
    act(() => vi.advanceTimersByTime(9_000));
    fireEvent.click(screen.getByTestId("context-lost"));
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "context-lost",
    );

    fireEvent.click(screen.getByTestId("context-restored"));
    act(() => vi.advanceTimersByTime(9_999));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "timeout", sceneId: "home-hero" }),
    );
  });

  it("records a later runtime failure once after initial readiness", () => {
    render(<HostHarness />);
    fireEvent.click(screen.getByTestId("first-frame"));
    fireEvent.click(screen.getByTestId("decode-failure"));
    fireEvent.click(screen.getByTestId("fetch-failure"));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(emitSceneRuntimeEvent).toHaveBeenCalledTimes(2);
    expect(emitSceneRuntimeEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "failure",
        reason: "decode",
        sceneId: "home-hero",
      }),
    );
  });

  it("returns a poster-only scene to poster after context restoration", () => {
    render(<PersistenceHarness />);
    const canvas = screen.getByTestId("fake-canvas");
    fireEvent.click(screen.getByRole("button", { name: "show EOG" }));
    fireEvent.click(screen.getByTestId("context-lost"));
    fireEvent.click(screen.getByTestId("context-restored"));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "poster",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-render-version", "1");
  });

  it("ignores every Canvas callback retained from an old activation", () => {
    render(<PersistenceHarness />);
    const canvas = screen.getByTestId("fake-canvas");
    const staleProps = latestCanvasProps;
    expect(staleProps).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "show projects" }));
    expect(canvas).toHaveAttribute("data-scene-id", "projects-hero");

    act(() => {
      staleProps?.onFirstFrame();
      staleProps?.onFailure("fetch");
      staleProps?.onContextLost();
      staleProps?.onContextRestored();
    });

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    expect(canvas).toHaveAttribute("data-render-version", "0");
    expect(emitSceneRuntimeEvent).not.toHaveBeenCalled();

    act(() => latestCanvasProps?.onFirstFrame());
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "ready",
    );
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready", sceneId: "projects-hero" }),
    );

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "ready",
    );
  });

  it("rejects retained callbacks when only the activation version changes", () => {
    render(<PersistenceHarness />);
    const staleProps = latestCanvasProps;
    fireEvent.click(screen.getByRole("button", { name: "reactivate home" }));

    act(() => {
      staleProps?.onFirstFrame();
      staleProps?.onFailure("unknown");
      staleProps?.onContextLost();
      staleProps?.onContextRestored();
    });

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    expect(screen.getByTestId("fake-canvas")).toHaveAttribute(
      "data-render-version",
      "0",
    );
    expect(emitSceneRuntimeEvent).not.toHaveBeenCalled();
    act(() => latestCanvasProps?.onFirstFrame());
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready", sceneId: "home-hero" }),
    );
  });

  it("invalidates callbacks and timers when the host unmounts", () => {
    const view = render(<HostHarness />);
    const staleProps = latestCanvasProps;
    view.unmount();

    act(() => {
      staleProps?.onFirstFrame();
      staleProps?.onFailure("fetch");
      staleProps?.onContextLost();
      staleProps?.onContextRestored();
      vi.advanceTimersByTime(10_000);
    });

    expect(emitSceneRuntimeEvent).not.toHaveBeenCalled();
  });

  it("keeps unsupported mode poster-only and reports the local failure once", () => {
    const view = render(
      <StrictMode>
        <HostHarness initialStatus="unsupported" />
      </StrictMode>,
    );

    expect(screen.queryByTestId("fake-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "unsupported",
    );
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        sceneId: "home-hero",
        reason: "webgl2-unavailable",
      }),
    );

    view.rerender(
      <StrictMode>
        <HostHarness initialStatus="unsupported" />
      </StrictMode>,
    );
    expect(emitSceneRuntimeEvent).toHaveBeenCalledOnce();
  });

  it("does not mount WebGL when the visitor explicitly disables 3D", () => {
    render(<HostHarness initialStatus="disabled" />);
    expect(screen.queryByTestId("fake-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "disabled",
    );
    expect(emitSceneRuntimeEvent).not.toHaveBeenCalled();
  });
});
