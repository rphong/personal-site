import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AdjacentScenePreloader } from "./adjacent-scene-preloader";
import {
  acquireSceneModelHostLease,
  clearAllSceneModels,
  preloadSceneModel,
  releaseSceneModelHostLease,
} from "./scene-loader";
import { clearPreparedSceneModels } from "./scene-model";

const leaseState = vi.hoisted(() => ({ current: null as symbol | null }));

vi.mock("./scene-loader", () => ({
  acquireSceneModelHostLease: vi.fn(() => {
    const lease = Symbol("test-scene-host");
    leaseState.current = lease;
    return lease;
  }),
  clearAllSceneModels: vi.fn(),
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
}));

describe("AdjacentScenePreloader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    leaseState.current = null;
    vi.mocked(acquireSceneModelHostLease).mockClear();
    vi.mocked(clearAllSceneModels).mockClear();
    vi.mocked(preloadSceneModel).mockClear();
    vi.mocked(releaseSceneModelHostLease).mockClear();
    vi.mocked(clearPreparedSceneModels).mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("lets the current resident load normally and idles only its next model", () => {
    render(
      <StrictMode>
        <AdjacentScenePreloader
          activeSceneId="home-hero"
          enabled
          ready={false}
        />
      </StrictMode>,
    );

    expect(preloadSceneModel).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(500));
    expect(preloadSceneModel).not.toHaveBeenCalled();
  });

  it("preloads exactly one adjacent model after the active scene is ready", () => {
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="home-hero"
        enabled
        ready={false}
      />,
    );

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="home-hero"
        enabled
        ready
      />,
    );
    act(() => vi.advanceTimersByTime(499));
    expect(preloadSceneModel).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(preloadSceneModel).toHaveBeenCalledOnce();
    expect(preloadSceneModel).toHaveBeenCalledWith(
      "/models/crane-workout.glb",
    );
  });

  it("reconciles retained URLs across live and poster-only activations", () => {
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="home-hero"
        enabled
        ready
      />,
    );
    act(() => vi.advanceTimersByTime(500));

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="experience-hero"
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

    expect(preloadSceneModel).toHaveBeenCalledOnce();
  });

  it("clears every resident and speculative model when disabled", async () => {
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="projects-hero"
        enabled
        ready
      />,
    );
    act(() => vi.advanceTimersByTime(500));
    expect(preloadSceneModel).toHaveBeenCalledOnce();
    expect(preloadSceneModel).toHaveBeenCalledWith(
      "/models/crane-on-league.glb",
    );

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="projects-hero"
        enabled={false}
        ready={false}
      />,
    );
    expect(clearAllSceneModels).toHaveBeenCalledOnce();
    expect(clearPreparedSceneModels).toHaveBeenCalledOnce();

    view.unmount();
    await Promise.resolve();
    expect(acquireSceneModelHostLease).toHaveBeenCalledOnce();
    expect(releaseSceneModelHostLease).toHaveBeenCalledOnce();
    expect(leaseState.current).toBeNull();
  });
});
