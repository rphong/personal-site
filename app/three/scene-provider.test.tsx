import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SceneProvider } from "./scene-provider";
import { SceneSection } from "./scene-section";
import { useSceneRuntime } from "./scene-runtime-context";

let pathname = "/experience";
const setEnabled = vi.fn();
let preferenceInitialized = true;
let preferenceEnabled = true;
let preferenceSupported = true;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("./three-preference", () => ({
  useThreePreference: () => ({
    initialized: preferenceInitialized,
    enabled: preferenceEnabled,
    supported: preferenceSupported,
    explicit: false,
    setEnabled,
  }),
}));

class ObserverMock implements IntersectionObserver {
  static instances: ObserverMock[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin ?? "0px";
    this.thresholds = [Number(options?.threshold ?? 0)];
    ObserverMock.instances.push(this);
  }

  trigger(target: Element, top: number) {
    this.callback(
      [
        {
          boundingClientRect: { top } as DOMRectReadOnly,
          intersectionRatio: 1,
          intersectionRect: {} as DOMRectReadOnly,
          isIntersecting: true,
          rootBounds: null,
          target,
          time: performance.now(),
        },
      ],
      this,
    );
  }
}

function Probe() {
  const runtime = useSceneRuntime();
  const firstSetStatus = useRef(runtime.setStatus);
  const firstRotateBy = useRef(runtime.rotateBy);
  const firstActivateScene = useRef(runtime.activateScene);
  return (
    <output data-testid="runtime-probe">
      <span>{runtime.activeSceneId}</span>
      <span>{runtime.status}</span>
      <span>
        {runtime.rotation.yaw},{runtime.rotation.pitch}
      </span>
      <span>v{runtime.activationVersion}</span>
      <span>{runtime.sceneActivationAllowed ? "allowed" : "blocked"}</span>
      <button onClick={() => runtime.rotateBy(400, 400, true)}>rotate</button>
      <button onClick={() => runtime.setStatus("ready")}>mark ready</button>
      <button onClick={() => runtime.activateScene("experience-intro")}>
        activate intro
      </button>
      <button onClick={() => runtime.setThreeEnabled(false)}>disable 3D</button>
      <button onClick={() => runtime.setThreeEnabled(true)}>enable 3D</button>
      <button onClick={() => firstSetStatus.current("ready")}>stale ready</button>
      <button onClick={() => firstRotateBy.current(400, 400, true)}>
        stale rotate
      </button>
      <button onClick={() => firstActivateScene.current("nasa-rocket")}>
        stale nasa activation
      </button>
    </output>
  );
}

function ExperienceSections({ children }: { children?: ReactNode }) {
  return (
    <>
      <SceneSection sceneId="experience-hero">hero</SceneSection>
      <SceneSection sceneId="experience-intro">intro</SceneSection>
      <SceneSection sceneId="nasa-rocket">nasa</SceneSection>
      {children}
    </>
  );
}

describe("SceneProvider", () => {
  beforeEach(() => {
    pathname = "/experience";
    preferenceInitialized = true;
    preferenceEnabled = true;
    preferenceSupported = true;
    ObserverMock.instances = [];
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: ObserverMock,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1_000,
    });
  });

  it("renders complete poster markup outside the provider", () => {
    render(
      <SceneSection sceneId="projects-hero">fallback copy</SceneSection>,
    );
    const section = screen.getByText("fallback copy").closest("section");
    expect(section).toHaveAttribute("data-scene-active", "false");
    expect(section).toHaveAttribute("data-scene-status", "poster");
    expect(section?.querySelector("img")).toHaveAttribute(
      "src",
      "/posters/projects-hero-desktop.webp",
    );
    expect(section?.querySelector("img")).toHaveAttribute("loading", "lazy");
    expect(section?.querySelector("img")).toHaveAttribute("fetchpriority", "auto");
    expect(section?.querySelector("img")).toHaveAttribute("alt", "");
    expect(section?.querySelector("img")).toHaveAttribute("width", "1920");
    expect(section?.querySelector("img")).toHaveAttribute("height", "1080");
    const mobile = section?.querySelector("source");
    expect(mobile).toHaveAttribute(
      "srcset",
      "/posters/projects-hero-mobile.webp",
    );
    expect(mobile).toHaveAttribute("width", "585");
    expect(mobile).toHaveAttribute("height", "1266");
  });

  it("server-renders priority posters and forwards semantic section props", () => {
    const markup = renderToStaticMarkup(
      <SceneSection
        aria-label="Home scene"
        className="custom-section"
        contentClassName="content-grid"
        data-contract="preserved"
        id="home-scene"
        posterClassName="custom-poster"
        posterPriority
        sceneId="home-hero"
      >
        server copy
      </SceneSection>,
    );
    const host = document.createElement("div");
    host.innerHTML = markup;
    const section = host.querySelector("section");
    expect(section).toHaveAttribute("id", "home-scene");
    expect(section).toHaveAttribute("aria-label", "Home scene");
    expect(section).toHaveAttribute("data-contract", "preserved");
    expect(section).toHaveClass("scene-section", "custom-section");
    expect(section?.querySelector("picture")).toHaveClass(
      "scene-section__poster",
      "custom-poster",
    );
    expect(section?.querySelector(".scene-section__content")).toHaveClass(
      "content-grid",
    );
    expect(section?.querySelector("img")).toHaveAttribute("loading", "eager");
    expect(section?.querySelector("img")).toHaveAttribute(
      "fetchpriority",
      "high",
    );
    expect(section).toHaveTextContent("server copy");
  });

  it("uses one shared activation line and exposes stable section IDs", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
        "experience-hero",
      ),
    );
    expect(ObserverMock.instances).toHaveLength(1);
    expect(ObserverMock.instances[0].rootMargin).toBe("-45% 0px -54% 0px");
    expect(screen.getByText("intro").closest("[data-scene-id]")).toHaveAttribute(
      "data-scene-id",
      "experience-intro",
    );
    expect(screen.getByText("hero").closest("section")).toHaveAttribute(
      "data-scene-active",
      "true",
    );
    expect(screen.getByText("hero").closest("section")).toHaveAttribute(
      "data-scene-status",
      "loading",
    );
    expect(screen.getByText("intro").closest("section")).toHaveAttribute(
      "data-scene-active",
      "false",
    );
    expect(screen.getByText("intro").closest("section")).toHaveAttribute(
      "data-scene-status",
      "poster",
    );

    act(() => {
      ObserverMock.instances[0].trigger(
        screen.getByText("intro").closest("section")!,
        450,
      );
    });

    expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
      "experience-intro",
    );
    expect(screen.getByText("hero").closest("section")).toHaveAttribute(
      "data-scene-active",
      "false",
    );
    expect(screen.getByText("hero").closest("section")).toHaveAttribute(
      "data-scene-status",
      "poster",
    );
    expect(screen.getByText("intro").closest("section")).toHaveAttribute(
      "data-scene-active",
      "true",
    );
    expect(screen.getByText("intro").closest("section")).toHaveAttribute(
      "data-scene-status",
      "loading",
    );
  });

  it("clears stale registrations, selects the destination hero, and resets pose", async () => {
    const view = render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent("loading"),
    );

    fireEvent.click(screen.getByRole("button", { name: "rotate" }));
    expect(screen.getByTestId("runtime-probe")).toHaveTextContent("25,8");

    pathname = "/projects";
    view.rerender(
      <SceneProvider>
        <SceneSection sceneId="projects-hero">projects</SceneSection>
        <Probe />
      </SceneProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
        "projects-hero",
      );
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent("0,0");
    });
    expect(ObserverMock.instances[0].unobserve).toHaveBeenCalled();
  });

  it("resets a ready scene to loading in the same activation commit", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    await waitFor(() => expect(probe).toHaveTextContent("loading"));

    fireEvent.click(screen.getByRole("button", { name: "rotate" }));
    fireEvent.click(screen.getByRole("button", { name: "mark ready" }));
    expect(probe).toHaveTextContent("experience-heroready25,8");

    fireEvent.click(screen.getByRole("button", { name: "activate intro" }));
    expect(probe).toHaveTextContent("experience-introloading0,0");
  });

  it("moves ready to disabled in the same explicit preference commit", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    await waitFor(() => expect(probe).toHaveTextContent("loading"));
    fireEvent.click(screen.getByRole("button", { name: "mark ready" }));
    expect(probe).toHaveTextContent("ready");
    expect(probe).toHaveTextContent("v0");

    fireEvent.click(screen.getByRole("button", { name: "disable 3D" }));
    expect(probe).toHaveTextContent("disabled");
    expect(probe).toHaveTextContent("v1");
    expect(setEnabled).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "enable 3D" }));
    expect(probe).toHaveTextContent("loading");
    expect(probe).toHaveTextContent("v2");
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("forces capture scenes without loading Home and supports same-path changes", async () => {
    pathname = "/scene-capture";
    const view = render(
      <SceneProvider>
        <SceneSection sceneId="nasa-rocket" forceActive>
          capture
        </SceneSection>
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    await waitFor(() => {
      expect(probe).toHaveTextContent("nasa-rocket");
      expect(probe).toHaveTextContent("loading");
      expect(probe).toHaveTextContent("allowed");
    });

    view.rerender(
      <SceneProvider>
        <SceneSection sceneId="league-ban" forceActive>
          capture
        </SceneSection>
        <Probe />
      </SceneProvider>,
    );
    await waitFor(() => {
      expect(probe).toHaveTextContent("league-ban");
      expect(probe).toHaveTextContent("loading");
    });
  });

  it("keeps unknown routes unauthorized until a section is explicitly forced", async () => {
    pathname = "/not-found";
    render(
      <SceneProvider>
        <Probe />
      </SceneProvider>,
    );

    const probe = screen.getByTestId("runtime-probe");
    expect(probe).toHaveTextContent("home-heroposter0,0v0blocked");
  });

  it("authorizes a same-ID Home capture instead of treating fallback as active", async () => {
    pathname = "/scene-capture";
    render(
      <SceneProvider>
        <SceneSection sceneId="home-hero" forceActive>
          capture home
        </SceneSection>
        <Probe />
      </SceneProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
        "home-heroloading0,0v1allowed",
      );
    });
  });

  it("rejects stale status and rotation callbacks", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    fireEvent.click(screen.getByRole("button", { name: "activate intro" }));
    expect(probe).toHaveTextContent("experience-introloading0,0");

    fireEvent.click(screen.getByRole("button", { name: "stale ready" }));
    fireEvent.click(screen.getByRole("button", { name: "stale rotate" }));
    expect(probe).toHaveTextContent("experience-introloading0,0");
  });

  it("ignores an old capture observer after navigation to a real route", async () => {
    pathname = "/scene-capture";
    const view = render(
      <SceneProvider>
        <SceneSection sceneId="nasa-rocket" forceActive>
          old capture
        </SceneSection>
        <Probe />
      </SceneProvider>,
    );
    const oldSection = screen.getByText("old capture").closest("section")!;
    const oldObserver = ObserverMock.instances[0];

    pathname = "/projects";
    view.rerender(
      <SceneProvider>
        <SceneSection sceneId="projects-hero">projects</SceneSection>
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    await waitFor(() => expect(probe).toHaveTextContent("projects-hero"));

    act(() => oldObserver.trigger(oldSection, 450));
    fireEvent.click(
      screen.getByRole("button", { name: "stale nasa activation" }),
    );
    expect(probe).toHaveTextContent("projects-hero");
  });

  it("distinguishes unsupported live scenes from poster-only scenes", async () => {
    preferenceSupported = false;
    const view = render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    expect(probe).toHaveTextContent("experience-herounsupported");

    view.rerender(
      <SceneProvider>
        <SceneSection sceneId="eog-poster" forceActive>
          eog
        </SceneSection>
        <Probe />
      </SceneProvider>,
    );
    await waitFor(() => {
      expect(probe).toHaveTextContent("eog-posterposter");
    });
  });
});
