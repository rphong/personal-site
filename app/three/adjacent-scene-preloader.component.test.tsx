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

const leaseState = vi.hoisted(() => ({ current: null as symbol | null }));

vi.mock("./scene-loader", () => ({
  acquireSceneModelHostLease: vi.fn(() => {
    const lease = Symbol("test-scene-host");
    leaseState.current = lease;
    return lease;
  }),
  clearSceneModel: vi.fn(),
  preloadSceneModel: vi.fn(() => Promise.resolve({})),
  releaseSceneModelHostLease: vi.fn((lease: symbol) => {
    if (leaseState.current !== lease) return false;
    leaseState.current = null;
    return true;
  }),
}));

describe("AdjacentScenePreloader", () => {
  const callbacks: IdleRequestCallback[] = [];
  const cancelled = new Set<number>();

  beforeEach(() => {
    callbacks.length = 0;
    cancelled.clear();
    leaseState.current = null;
    vi.mocked(acquireSceneModelHostLease).mockClear();
    vi.mocked(clearSceneModel).mockClear();
    vi.mocked(preloadSceneModel).mockClear();
    vi.mocked(releaseSceneModelHostLease).mockClear();
    Object.defineProperties(window, {
      requestIdleCallback: {
        configurable: true,
        writable: true,
        value: vi.fn((callback: IdleRequestCallback) => {
          callbacks.push(callback);
          return callbacks.length;
        }),
      },
      cancelIdleCallback: {
        configurable: true,
        writable: true,
        value: vi.fn((id: number) => cancelled.add(id)),
      },
    });
  });

  it("runs one effective StrictMode idle preload and ignores a stale callback", () => {
    const view = render(
      <StrictMode>
        <AdjacentScenePreloader
          activeSceneId="home-hero"
          enabled
          ready
        />
      </StrictMode>,
    );
    expect(preloadSceneModel).not.toHaveBeenCalled();
    expect(callbacks.length).toBeGreaterThanOrEqual(2);

    callbacks[0]({ didTimeout: false, timeRemaining: () => 20 });
    expect(preloadSceneModel).not.toHaveBeenCalled();
    callbacks.at(-1)!({ didTimeout: false, timeRemaining: () => 20 });
    expect(preloadSceneModel).toHaveBeenCalledOnce();
    expect(preloadSceneModel).toHaveBeenCalledWith(
      "/models/crane-workout.glb",
    );

    view.rerender(
      <StrictMode>
        <AdjacentScenePreloader
          activeSceneId="experience-intro"
          enabled
          ready={false}
        />
      </StrictMode>,
    );
    callbacks.at(-1)!({ didTimeout: false, timeRemaining: () => 20 });
    expect(preloadSceneModel).toHaveBeenCalledOnce();
    expect(cancelled.size).toBeGreaterThan(0);
  });

  it("clears ownership on disable, poster-only activation, and final unmount", async () => {
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="home-hero"
        enabled
        ready
      />,
    );
    callbacks.at(-1)!({ didTimeout: false, timeRemaining: () => 20 });

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="home-hero"
        enabled={false}
        ready={false}
      />,
    );
    expect(clearSceneModel).toHaveBeenCalledWith("/models/crane.glb");
    expect(clearSceneModel).toHaveBeenCalledWith(
      "/models/crane-workout.glb",
    );

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="eog-poster"
        enabled
        ready
      />,
    );
    expect(preloadSceneModel).toHaveBeenCalledOnce();
    expect(callbacks).toHaveLength(1);

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="projects-hero"
        enabled
        ready={false}
      />,
    );
    view.unmount();
    await Promise.resolve();
    expect(acquireSceneModelHostLease).toHaveBeenCalledOnce();
    expect(releaseSceneModelHostLease).toHaveBeenCalledOnce();
    expect(leaseState.current).toBeNull();
  });

  it("uses a cancelable fallback timer when idle callbacks are unavailable", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: undefined,
    });
    const view = render(
      <AdjacentScenePreloader
        activeSceneId="projects-hero"
        enabled
        ready
      />,
    );
    expect(preloadSceneModel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(preloadSceneModel).toHaveBeenCalledWith(
      "/models/crane-on-league.glb",
    );

    view.rerender(
      <AdjacentScenePreloader
        activeSceneId="league-ban"
        enabled
        ready
      />,
    );
    view.unmount();
    vi.runAllTimers();
    expect(preloadSceneModel).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
