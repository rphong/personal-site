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

  it("lets residents own current loading and adds only next after readiness", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
    };

    const homeCurrent = reconcileScenePreloads(
      "home-hero",
      new Set(),
      cache,
      false,
    );
    expect([...homeCurrent]).toEqual([]);
    expect(cache.preload).not.toHaveBeenCalled();

    const homeIdle = reconcileScenePreloads(
      "home-hero",
      homeCurrent,
      cache,
      true,
    );
    expect([...homeIdle]).toEqual(["/models/crane-workout.glb"]);
    expect(cache.preload).toHaveBeenCalledOnce();
    expect(cache.preload).toHaveBeenLastCalledWith(
      "/models/crane-workout.glb",
    );

    const experienceCurrent = reconcileScenePreloads(
      "experience-hero",
      homeIdle,
      cache,
      false,
    );
    expect([...experienceCurrent]).toEqual([
      "/models/crane-workout.glb",
    ]);

    const experienceIdle = reconcileScenePreloads(
      "experience-hero",
      experienceCurrent,
      cache,
      true,
    );
    expect([...experienceIdle]).toEqual([
      "/models/crane-workout.glb",
      "/models/crane-throwing-plane.glb",
    ]);
    expect(cache.preload).toHaveBeenLastCalledWith(
      "/models/crane-throwing-plane.glb",
    );
  });

  it("retains the bounded session cache through poster-only activation", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
    };
    const previous = new Set([
      "/models/crane.glb",
      "/models/rocket.glb",
    ]);

    expect(reconcileScenePreloads("eog-poster", previous, cache, false)).toEqual(
      previous,
    );
    expect(cache.preload).not.toHaveBeenCalled();
  });

  it("resets policy state when 3D is disabled", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
    };
    const previous = new Set([
      "/models/crane.glb",
      "/models/crane-workout.glb",
      "/models/rocket.glb",
    ]);

    expect(reconcileScenePreloads(null, previous, cache, false)).toEqual(
      new Set(),
    );
    expect(cache.preload).not.toHaveBeenCalled();
  });
});
