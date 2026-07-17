import { act, render, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { getSceneDefinition } from "./scene-registry";
import {
  SceneRuntimeContext,
  type SceneRuntimeContextValue,
} from "./scene-runtime-context";
import { SceneRuntimeHost } from "./scene-runtime-host";
import type { SceneId, ThreeStatus } from "./types";

let pathname = "/experience";
let completeCanvases = true;
const canvasPorts = new Map<SceneId, SceneCanvasPortProps>();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("./adjacent-scene-preloader", () => ({
  AdjacentScenePreloader: () => null,
}));

vi.mock("./scene-canvas-boundary", () => ({
  SceneCanvasBoundary: (props: SceneCanvasPortProps) => {
    const { activationVersion, onFailure, onFirstFrame, renderVersion, scene } =
      props;
    canvasPorts.set(scene.id, props);
    useEffect(() => {
      if (!completeCanvases) return;
      onFirstFrame();
    }, [activationVersion, onFirstFrame, renderVersion, scene.id]);
    return (
      <canvas
        data-fake-scene-canvas={scene.id}
        onClick={() => onFailure("decode")}
      />
    );
  },
}));

function runtimeValue(
  activeSceneId: SceneId,
  status: ThreeStatus,
  setStatus: SceneRuntimeContextValue["setStatus"],
  overrides: Partial<SceneRuntimeContextValue> = {},
): SceneRuntimeContextValue {
  const activeScene = getSceneDefinition(activeSceneId);
  return {
    activeScene,
    activeSceneId,
    activeSectionElement: null,
    sceneStageElement: null,
    activationVersion: 1,
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
    setStatus,
    setThreeEnabled: vi.fn(),
    ...overrides,
  };
}

function Section({
  sceneId,
  marker,
}: {
  readonly sceneId: SceneId;
  readonly marker?: string;
}) {
  const scene = getSceneDefinition(sceneId);
  return (
    <section
      className="scene-section"
      data-scene-id={sceneId}
      data-required-live={String(scene.requiredLive)}
      data-test-marker={marker}
    >
      <picture className="scene-section__poster">
        <img src={`/posters/${sceneId}.webp`} alt="" />
      </picture>
      <div className="scene-section__content" />
    </section>
  );
}

function Harness({
  activeSceneId,
  children,
  runtimeOverrides = {},
}: {
  readonly activeSceneId: SceneId;
  readonly children: ReactNode;
  readonly runtimeOverrides?: Partial<SceneRuntimeContextValue>;
}) {
  return (
    <SceneRuntimeContext.Provider
      value={runtimeValue(
        activeSceneId,
        "loading",
        vi.fn(),
        runtimeOverrides,
      )}
    >
      <SceneRuntimeHost />
      <main>{children}</main>
    </SceneRuntimeContext.Provider>
  );
}

function residentStages(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      ":scope > .scene-stage--resident",
    ),
  );
}

describe("section-owned live scene occupants", () => {
  beforeEach(() => {
    pathname = "/experience";
    completeCanvases = true;
    canvasPorts.clear();
  });

  it("gives every live section a permanent correct-scene canvas and excludes poster scenes", async () => {
    const view = render(
      <Harness activeSceneId="experience-hero">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
        <Section sceneId="eog-poster" />
      </Harness>,
    );

    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".scene-stage--resident"),
      ).toHaveLength(3),
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll(
          '[data-scene-occupant="canvas"][data-scene-frame-state="ready"]',
        ),
      ).toHaveLength(3),
    );

    for (const sceneId of [
      "experience-hero",
      "experience-intro",
      "nasa-rocket",
    ] as const) {
      const section = view.container.querySelector<HTMLElement>(
        `section[data-scene-id="${sceneId}"]`,
      )!;
      const stages = residentStages(section);
      expect(stages).toHaveLength(1);
      expect(stages[0]).toHaveAttribute("data-scene-owner-id", sceneId);
      expect(
        stages[0].querySelectorAll("picture.scene-runtime__poster"),
      ).toHaveLength(1);
      expect(
        stages[0].querySelector("[data-scene-occupant=canvas]"),
      ).toHaveAttribute("data-scene-for", sceneId);
      expect(
        stages[0].querySelector("[data-scene-occupant=canvas]"),
      ).toHaveAttribute("data-scene-frame-for", sceneId);
    }

    expect(
      view.container.querySelector(
        'section[data-scene-id="eog-poster"] > .scene-stage--resident',
      ),
    ).not.toBeInTheDocument();
    expect(
      view.container.querySelectorAll("[data-testid=scene-runtime-host]"),
    ).toHaveLength(1);
  });

  it("fits all seven live scenes below the eight-context ceiling and caps a ninth resident", async () => {
    pathname = "/scene-capture";
    const view = render(
      <Harness activeSceneId="experience-hero">
        <Section marker="one" sceneId="experience-hero" />
        <Section marker="two" sceneId="experience-intro" />
        <Section marker="three" sceneId="nasa-rocket" />
        <Section marker="four" sceneId="projects-hero" />
        <Section marker="five" sceneId="league-ban" />
        <Section marker="six" sceneId="froggie-adventures" />
        <Section marker="seven" sceneId="home-hero" />
        <Section marker="eight" sceneId="experience-hero" />
        <Section marker="nine" sceneId="experience-intro" />
      </Harness>,
    );

    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".scene-stage--resident"),
      ).toHaveLength(8),
    );
    expect(
      view.container.querySelector(
        'section[data-test-marker="nine"] > .scene-stage--resident',
      ),
    ).not.toBeInTheDocument();
    expect(
      view.container.querySelectorAll(".scene-stage--resident canvas"),
    ).toHaveLength(8);
    expect(
      view.container.querySelector("[data-scene-resident-pool]"),
    ).toHaveAttribute("data-scene-context-cap", "8");
  });

  it("evicts the least-recently-seen pooled resident before exceeding eight contexts", async () => {
    pathname = "/scene-capture";
    const view = render(
      <Harness activeSceneId="experience-hero">
        {Array.from({ length: 8 }, (_, index) => (
          <Section
            key={index}
            marker={`resident-${index}`}
            sceneId="experience-hero"
          />
        ))}
      </Harness>,
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".scene-stage--resident"),
      ).toHaveLength(8),
    );
    const originalStages = Array.from(
      view.container.querySelectorAll<HTMLElement>(".scene-stage--resident"),
    ).sort(
      (left, right) =>
        Number(left.dataset.scenePoolLastSeen) -
        Number(right.dataset.scenePoolLastSeen),
    );

    view.rerender(
      <Harness activeSceneId="projects-hero">
        <Section sceneId="projects-hero" />
      </Harness>,
    );

    await waitFor(() =>
      expect(
        view.container.querySelector(
          'section[data-scene-id="projects-hero"] > .scene-stage--resident',
        ),
      ).toBeInTheDocument(),
    );
    expect(originalStages[0].isConnected).toBe(false);
    expect(
      originalStages.slice(1).every((stage) => stage.isConnected),
    ).toBe(true);
    expect(
      view.container.querySelectorAll(".scene-stage--resident"),
    ).toHaveLength(8);
  });

  it("evicts by recent activation rather than original adoption order", async () => {
    pathname = "/scene-capture";
    const initialScenes = [
      ["home", "home-hero"],
      ["projects-old", "projects-hero"],
      ["league", "league-ban"],
      ["froggie", "froggie-adventures"],
      ["experience", "experience-hero"],
      ["intro", "experience-intro"],
      ["nasa", "nasa-rocket"],
      ["projects-new", "projects-hero"],
    ] as const;
    const sections = initialScenes.map(([marker, sceneId]) => (
      <Section key={marker} marker={marker} sceneId={sceneId} />
    ));
    const view = render(
      <Harness activeSceneId="experience-hero">{sections}</Harness>,
    );
    const stageFor = (marker: string) =>
      view.container.querySelector<HTMLElement>(
        `section[data-test-marker="${marker}"] > .scene-stage--resident`,
      );

    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".scene-stage--resident"),
      ).toHaveLength(8),
    );
    const homeStage = stageFor("home")!;
    const oldestProjectStage = stageFor("projects-old")!;
    const originalHomeLastSeen = Number(homeStage.dataset.scenePoolLastSeen);

    view.rerender(<Harness activeSceneId="home-hero">{sections}</Harness>);
    await waitFor(() =>
      expect(Number(homeStage.dataset.scenePoolLastSeen)).toBeGreaterThan(
        originalHomeLastSeen,
      ),
    );

    view.rerender(
      <Harness activeSceneId="nasa-rocket">
        <Section key="nasa-one" marker="nasa-one" sceneId="nasa-rocket" />
        <Section key="nasa-two" marker="nasa-two" sceneId="nasa-rocket" />
      </Harness>,
    );

    await waitFor(() => {
      expect(stageFor("nasa-one")).toBeInTheDocument();
      expect(stageFor("nasa-two")).toBeInTheDocument();
      expect(
        view.container.querySelectorAll(".scene-stage--resident"),
      ).toHaveLength(8);
    });
    expect(oldestProjectStage.isConnected).toBe(false);
    expect(homeStage.isConnected).toBe(true);
  });

  it("keeps duplicate-scene sections on independent stable residents", async () => {
    pathname = "/scene-capture";
    const view = render(
      <Harness activeSceneId="projects-hero">
        {[
          <Section key="first" marker="first" sceneId="projects-hero" />,
          <Section key="second" marker="second" sceneId="projects-hero" />,
        ]}
      </Harness>,
    );
    const stageFor = (marker: string) =>
      view.container.querySelector(
        `section[data-test-marker="${marker}"] > .scene-stage--resident`,
      );
    const hostFor = (marker: string) =>
      stageFor(marker)?.querySelector("[data-scene-runtime-host]");

    await waitFor(() => {
      expect(hostFor("first")).toHaveAttribute("data-three-status", "ready");
      expect(hostFor("second")).toHaveAttribute("data-three-status", "ready");
    });
    const originalFirstStage = stageFor("first");
    const originalSecondStage = stageFor("second");

    act(() =>
      originalFirstStage?.querySelector<HTMLCanvasElement>("canvas")?.click(),
    );
    await waitFor(() =>
      expect(hostFor("first")).toHaveAttribute("data-three-status", "error"),
    );
    expect(hostFor("second")).toHaveAttribute("data-three-status", "ready");

    view.rerender(
      <Harness activeSceneId="projects-hero">
        {[
          <Section key="second" marker="second" sceneId="projects-hero" />,
          <Section key="first" marker="first" sceneId="projects-hero" />,
        ]}
      </Harness>,
    );

    await waitFor(() => {
      expect(stageFor("first")).toBe(originalFirstStage);
      expect(stageFor("second")).toBe(originalSecondStage);
      expect(hostFor("first")).toHaveAttribute("data-three-status", "error");
      expect(hostFor("second")).toHaveAttribute("data-three-status", "ready");
    });
  });

  it.each([
    {
      expectedStatus: "poster",
      runtimeOverrides: { threeInitialized: false },
    },
    {
      expectedStatus: "disabled",
      runtimeOverrides: {
        sceneActivationAllowed: false,
        threeEnabled: false,
      },
    },
    {
      expectedStatus: "unsupported",
      runtimeOverrides: {
        sceneActivationAllowed: false,
        threeEnabled: false,
        threeSupported: false,
      },
    },
  ] as const)(
    "keeps one resident poster per live host in $expectedStatus mode",
    async ({ expectedStatus, runtimeOverrides }) => {
      const view = render(
        <Harness
          activeSceneId="experience-hero"
          runtimeOverrides={runtimeOverrides}
        >
          <Section sceneId="experience-hero" />
          <Section sceneId="experience-intro" />
          <Section sceneId="nasa-rocket" />
        </Harness>,
      );

      await waitFor(() =>
        expect(
          view.container.querySelectorAll("[data-scene-runtime-host]"),
        ).toHaveLength(3),
      );
      expect(view.container.querySelectorAll("canvas")).toHaveLength(0);
      for (const host of view.container.querySelectorAll(
        "[data-scene-runtime-host]",
      )) {
        expect(host).toHaveAttribute("data-three-status", expectedStatus);
        expect(
          host.querySelectorAll("picture.scene-runtime__poster"),
        ).toHaveLength(1);
      }
    },
  );

  it("keeps failures and context loss local to each resident poster", async () => {
    completeCanvases = false;
    const view = render(
      <Harness activeSceneId="experience-hero">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );

    await waitFor(() => expect(canvasPorts.size).toBe(3));
    act(() => canvasPorts.get("experience-intro")?.onFailure("decode"));
    act(() => canvasPorts.get("nasa-rocket")?.onContextLost());

    await waitFor(() =>
      expect(
        view.container.querySelector(
          '[data-scene-for="experience-intro"][data-scene-runtime-host]',
        ),
      ).toHaveAttribute("data-three-status", "error"),
    );
    expect(
      view.container.querySelector(
        '[data-scene-for="experience-hero"][data-scene-runtime-host]',
      ),
    ).toHaveAttribute("data-three-status", "loading");
    expect(
      view.container.querySelector(
        '[data-scene-for="nasa-rocket"][data-scene-runtime-host]',
      ),
    ).toHaveAttribute("data-three-status", "context-lost");
    for (const host of view.container.querySelectorAll(
      "[data-scene-runtime-host]",
    )) {
      expect(
        host.querySelectorAll("picture.scene-runtime__poster"),
      ).toHaveLength(1);
    }
  });

  it("retries a failed resident once when it is promoted to active", async () => {
    completeCanvases = false;
    const view = render(
      <Harness activeSceneId="experience-hero">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );

    await waitFor(() => expect(canvasPorts.size).toBe(3));
    const failedVersion = canvasPorts.get("experience-intro")?.activationVersion;
    act(() => canvasPorts.get("experience-intro")?.onFailure("fetch"));
    await waitFor(() =>
      expect(
        view.container.querySelector(
          '[data-scene-for="experience-intro"][data-scene-runtime-host]',
        ),
      ).toHaveAttribute("data-three-status", "error"),
    );

    view.rerender(
      <Harness activeSceneId="experience-intro">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );

    await waitFor(() => {
      expect(
        view.container.querySelector(
          '[data-scene-for="experience-intro"][data-scene-runtime-host]',
        ),
      ).toHaveAttribute("data-three-status", "loading");
      expect(canvasPorts.get("experience-intro")?.activationVersion).toBe(
        (failedVersion ?? -1) + 1,
      );
    });
    act(() => canvasPorts.get("experience-intro")?.onFirstFrame());
    await waitFor(() =>
      expect(
        view.container.querySelector(
          '[data-scene-for="experience-intro"][data-scene-runtime-host]',
        ),
      ).toHaveAttribute("data-three-status", "ready"),
    );
  });

  it("parks and readopts a capture resident with the same activation identity", async () => {
    pathname = "/scene-capture";
    const view = render(
      <Harness activeSceneId="nasa-rocket">
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );
    await waitFor(() =>
      expect(
        view.container.querySelector(
          '.scene-stage--resident[data-scene-owner-id="nasa-rocket"]',
        ),
      ).toHaveAttribute("data-scene-pool-state", "assigned"),
    );
    const originalStage = view.container.querySelector(
      '.scene-stage--resident[data-scene-owner-id="nasa-rocket"]',
    );
    const originalActivationVersion =
      canvasPorts.get("nasa-rocket")?.activationVersion;
    const originalAdoptionVersion =
      canvasPorts.get("nasa-rocket")?.adoptionVersion;

    view.rerender(
      <Harness activeSceneId="eog-poster">
        <Section sceneId="eog-poster" />
      </Harness>,
    );
    await waitFor(() =>
      expect(originalStage).toHaveAttribute("data-scene-pool-state", "pooled"),
    );
    expect(originalStage?.isConnected).toBe(true);
    expect(originalStage?.parentElement).toHaveAttribute(
      "data-scene-resident-pool",
    );

    view.rerender(
      <Harness activeSceneId="nasa-rocket">
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );
    await waitFor(() => {
      const adoptedStage = view.container.querySelector(
        'section[data-scene-id="nasa-rocket"] > .scene-stage--resident',
      );
      expect(adoptedStage).toBe(originalStage);
      expect(adoptedStage).toHaveAttribute("data-scene-pool-state", "assigned");
      expect(canvasPorts.get("nasa-rocket")?.activationVersion).toBe(
        originalActivationVersion,
      );
      expect(canvasPorts.get("nasa-rocket")?.adoptionVersion).toBe(
        (originalAdoptionVersion ?? 0) + 1,
      );
    });
  });

  it("keeps a scene-keyed canvas mounted while its stage is pooled and readopted across routes", async () => {
    pathname = "/";
    const view = render(
      <Harness activeSceneId="home-hero">
        <Section sceneId="home-hero" />
      </Harness>,
    );
    await waitFor(() =>
      expect(
        view.container.querySelector(
          'section[data-scene-id="home-hero"] > .scene-stage--resident',
        ),
      ).toHaveAttribute("data-scene-pool-state", "assigned"),
    );
    const homeStage = view.container.querySelector(
      '.scene-stage--resident[data-scene-owner-id="home-hero"]',
    );
    const homeCanvas = homeStage?.querySelector("canvas");
    const activationVersion = canvasPorts.get("home-hero")?.activationVersion;
    const adoptionVersion = canvasPorts.get("home-hero")?.adoptionVersion;

    pathname = "/experience";
    view.rerender(
      <Harness activeSceneId="experience-hero">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );
    await waitFor(() =>
      expect(homeStage).toHaveAttribute("data-scene-pool-state", "pooled"),
    );
    expect(homeStage?.isConnected).toBe(true);
    expect(homeStage?.querySelector("canvas")).toBe(homeCanvas);

    pathname = "/";
    view.rerender(
      <Harness activeSceneId="home-hero">
        <Section sceneId="home-hero" />
      </Harness>,
    );
    await waitFor(() => {
      const adopted = view.container.querySelector(
        'section[data-scene-id="home-hero"] > .scene-stage--resident',
      );
      expect(adopted).toBe(homeStage);
      expect(adopted?.querySelector("canvas")).toBe(homeCanvas);
      expect(canvasPorts.get("home-hero")?.activationVersion).toBe(
        activationVersion,
      );
      expect(canvasPorts.get("home-hero")?.adoptionVersion).toBe(
        (adoptionVersion ?? 0) + 1,
      );
    });
  });

  it("keeps every resident stage attached while active control moves within the route", async () => {
    const view = render(
      <Harness activeSceneId="experience-hero">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".scene-stage--resident"),
      ).toHaveLength(3),
    );
    const originalStages = new Map(
      Array.from(
        view.container.querySelectorAll<HTMLElement>(".scene-stage--resident"),
      ).map((stage) => [stage.dataset.sceneFor, stage]),
    );

    view.rerender(
      <Harness activeSceneId="experience-intro">
        <Section sceneId="experience-hero" />
        <Section sceneId="experience-intro" />
        <Section sceneId="nasa-rocket" />
      </Harness>,
    );

    await waitFor(() =>
      expect(
        view.container.querySelector("[data-testid=scene-runtime-host]"),
      ).toHaveAttribute("data-active-scene-id", "experience-intro"),
    );
    for (const [sceneId, stage] of originalStages) {
      expect(
        view.container.querySelector(
          `.scene-stage--resident[data-scene-for="${sceneId}"]`,
        ),
      ).toBe(stage);
    }
    expect(
      view.container.querySelector(".scene-runtime__transition-frame"),
    ).not.toBeInTheDocument();
  });
});
