import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdjacentScenePreloader } from "./adjacent-scene-preloader";
import {
  acquireSceneModelHostLease,
  clearSceneModel,
  preloadSceneModel,
  releaseSceneModelHostLease,
} from "./scene-loader";
import { SCENE_DEFINITIONS } from "./scene-registry";
import {
  clearPreparedSceneModels,
  prepareSceneModel,
} from "./scene-model";

const leaseState = vi.hoisted(() => ({ current: null as symbol | null }));

vi.mock("./scene-loader", () => ({
  acquireSceneModelHostLease: vi.fn(() => {
    const lease = Symbol("test-scene-host");
    leaseState.current = lease;
    return lease;
  }),
  clearSceneModel: vi.fn(),
  preloadSceneModel: vi.fn(() =>
    Promise.resolve({ scene: {}, animations: [] }),
  ),
  releaseSceneModelHostLease: vi.fn((lease: symbol) => {
    if (leaseState.current !== lease) return false;
    leaseState.current = null;
    return true;
  }),
}));

vi.mock("./scene-model", () => ({
  clearPreparedSceneModels: vi.fn(),
  prepareSceneModel: vi.fn(),
}));

const liveModelUrls = [
  ...new Set(
    Object.values(SCENE_DEFINITIONS).flatMap((scene) =>
      scene.requiredLive ? [scene.modelUrl] : [],
    ),
  ),
];

describe("AdjacentScenePreloader", () => {
  beforeEach(() => {
    leaseState.current = null;
    vi.mocked(acquireSceneModelHostLease).mockClear();
    vi.mocked(clearSceneModel).mockClear();
    vi.mocked(preloadSceneModel).mockClear();
    vi.mocked(releaseSceneModelHostLease).mockClear();
    vi.mocked(clearPreparedSceneModels).mockClear();
    vi.mocked(prepareSceneModel).mockClear();
  });

  it("warms and prepares every live scene once after the first paint", async () => {
    render(
      <StrictMode>
        <AdjacentScenePreloader
          activeSceneId="home-hero"
          enabled
          ready
        />
      </StrictMode>,
    );

    const actual = vi
      .mocked(preloadSceneModel)
      .mock.calls.map(([url]) => url)
      .sort();
    expect(actual).toEqual([...liveModelUrls].sort());

    await Promise.resolve();
    expect(prepareSceneModel).toHaveBeenCalledTimes(
      Object.values(SCENE_DEFINITIONS).filter(
        (scene) => scene.requiredLive,
      ).length,
    );
  });

  it("retains warmed models across live and poster-only activations", () => {
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="home-hero"
        enabled
        ready
      />,
    );
    const preloadCount = vi.mocked(preloadSceneModel).mock.calls.length;

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="experience-intro"
        enabled
        ready={false}
      />,
    );
    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="eog-poster"
        enabled
        ready
      />,
    );

    expect(preloadSceneModel).toHaveBeenCalledTimes(preloadCount);
    expect(clearSceneModel).not.toHaveBeenCalled();
  });

  it("warms during loading and clears every retained model only when disabled", async () => {
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="projects-hero"
        enabled
        ready={false}
      />,
    );
    expect(preloadSceneModel).toHaveBeenCalled();

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="projects-hero"
        enabled={false}
        ready={false}
      />,
    );
    expect(
      new Set(vi.mocked(clearSceneModel).mock.calls.map(([url]) => url)),
    ).toEqual(new Set(liveModelUrls));
    expect(clearPreparedSceneModels).toHaveBeenCalledOnce();

    view.unmount();
    await Promise.resolve();
    expect(acquireSceneModelHostLease).toHaveBeenCalledOnce();
    expect(releaseSceneModelHostLease).toHaveBeenCalledOnce();
    expect(leaseState.current).toBeNull();
  });
});
