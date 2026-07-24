import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reconcileSceneRuntimeTraceResizeTargets,
  releaseSceneRuntimeTraceResizeTargets,
} from "./scene-runtime-trace";

afterEach(() => {
  document.body.replaceChildren();
});

describe("scene trace resize target ownership", () => {
  it("unobserves a removed route tree before observing its replacement", () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const resizeObserver = { observe, unobserve };
    const observedTargets = new Set<Element>();
    const oldRoute = document.createElement("main");
    oldRoute.innerHTML =
      '<section class="page-hero"><div class="page-hero__copy"></div></section>';
    document.body.append(oldRoute);
    const oldTargets = Array.from(oldRoute.querySelectorAll("*"));

    reconcileSceneRuntimeTraceResizeTargets(
      resizeObserver,
      observedTargets,
      oldTargets,
    );
    expect(observe).toHaveBeenCalledTimes(2);
    expect(observedTargets).toEqual(new Set(oldTargets));

    oldRoute.remove();
    const nextRoute = document.createElement("main");
    nextRoute.innerHTML = '<section class="page-hero"></section>';
    document.body.append(nextRoute);
    const nextTargets = Array.from(nextRoute.querySelectorAll("*"));

    reconcileSceneRuntimeTraceResizeTargets(
      resizeObserver,
      observedTargets,
      nextTargets,
    );

    expect(unobserve.mock.calls.map(([target]) => target)).toEqual(oldTargets);
    expect(observedTargets).toEqual(new Set(nextTargets));
    expect(observe).toHaveBeenLastCalledWith(nextTargets[0]);
  });

  it("releases every retained target during observer cleanup", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    const observedTargets = new Set<Element>([first, second]);
    const unobserve = vi.fn();

    releaseSceneRuntimeTraceResizeTargets(
      { unobserve },
      observedTargets,
    );

    expect(unobserve.mock.calls.map(([target]) => target)).toEqual([
      first,
      second,
    ]);
    expect(observedTargets.size).toBe(0);
  });

  it("wires reconciliation into mutation refresh and explicit cleanup", async () => {
    const source = await readFile(
      "app/three/scene-runtime-trace.ts",
      "utf8",
    );
    const refresh = source.slice(
      source.indexOf("const refreshResizeTargets"),
      source.indexOf("const mutationObserver"),
    );
    const cleanup = source.slice(
      source.indexOf("window.__sceneRuntimeTraceObserverCleanup ="),
    );

    expect(refresh).toContain(
      "reconcileSceneRuntimeTraceResizeTargets(",
    );
    expect(cleanup).toMatch(
      /releaseSceneRuntimeTraceResizeTargets\([\s\S]*?resizeObserver\?\.disconnect\(\)/,
    );
  });
});
