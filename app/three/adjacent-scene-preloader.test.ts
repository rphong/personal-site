import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  reconcileScenePreloads,
  type ModelCachePort,
} from "./scene-preload-policy";

describe("reconcileScenePreloads", () => {
  it("keeps pure preload policy free of client loader and Meshopt imports", async () => {
    const source = await readFile(
      "app/three/scene-preload-policy.ts",
      "utf8",
    );
    expect(source).not.toMatch(/scene-loader|@react-three|Meshopt|window|document/);
  });

  it("warms current and requested models once for runtime preparation", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };

    const warmed = reconcileScenePreloads(
      "home-hero",
      new Set(),
      cache,
      [
        "/models/crane.glb",
        "/models/crane-workout.glb",
        "/models/rocket.glb",
      ],
    );
    expect([...warmed]).toEqual([
      "/models/crane.glb",
      "/models/crane-workout.glb",
      "/models/rocket.glb",
    ]);
    expect(cache.preload).toHaveBeenCalledTimes(3);
    expect(cache.preload).toHaveBeenCalledWith("/models/crane.glb");
    expect(cache.preload).toHaveBeenCalledWith(
      "/models/crane-workout.glb",
    );
    expect(cache.preload).toHaveBeenCalledWith("/models/rocket.glb");

    reconcileScenePreloads(
      "contact-hero",
      warmed,
      cache,
      ["/models/crane-workout.glb", "/models/rocket.glb"],
    );
    expect(cache.preload).toHaveBeenCalledTimes(3);
    expect(cache.clear).not.toHaveBeenCalled();
  });

  it("retains warm entries through poster-only scene activation", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };
    const previous = new Set([
      "/models/crane.glb",
      "/models/rocket.glb",
    ]);

    expect(
      reconcileScenePreloads("eog-poster", previous, cache, []),
    ).toEqual(previous);
    expect(cache.preload).not.toHaveBeenCalled();
    expect(cache.clear).not.toHaveBeenCalled();
  });

  it("clears all retained model entries when 3D is disabled", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };
    const previous = new Set([
      "/models/crane.glb",
      "/models/crane-workout.glb",
      "/models/rocket.glb",
    ]);

    expect(reconcileScenePreloads(null, previous, cache, [])).toEqual(
      new Set(),
    );
    expect(cache.clear).toHaveBeenCalledTimes(3);
    expect(cache.preload).not.toHaveBeenCalled();
  });
});
