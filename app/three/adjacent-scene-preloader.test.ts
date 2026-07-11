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

  it("lets SceneModel own current and adds only next after readiness", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };

    const homeCurrent = reconcileScenePreloads(
      "home-hero",
      new Set(),
      cache,
      false,
    );
    expect([...homeCurrent]).toEqual(["/models/crane.glb"]);
    expect(cache.preload).not.toHaveBeenCalled();

    const homeIdle = reconcileScenePreloads(
      "home-hero",
      homeCurrent,
      cache,
      true,
    );
    expect([...homeIdle]).toEqual([
      "/models/crane.glb",
      "/models/crane-workout.glb",
    ]);
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
    expect([...experienceCurrent]).toEqual(["/models/crane-workout.glb"]);
    expect(cache.clear).toHaveBeenCalledWith("/models/crane.glb");

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

  it("clears all model cache entries when 3D is disabled", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };
    const previous = new Set([
      "/models/crane.glb",
      "/models/crane-workout.glb",
    ]);

    expect(reconcileScenePreloads(null, previous, cache, false)).toEqual(
      new Set(),
    );
    expect(cache.clear).toHaveBeenCalledTimes(2);
    expect(cache.preload).not.toHaveBeenCalled();
  });

  it("does not preload across poster-only scenes", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };
    const nasa = reconcileScenePreloads(
      "nasa-rocket",
      new Set(),
      cache,
      true,
    );
    expect([...nasa]).toEqual(["/models/rocket.glb"]);
    expect(cache.preload).not.toHaveBeenCalled();

    const poster = reconcileScenePreloads(
      "eog-poster",
      nasa,
      cache,
      true,
    );
    expect(poster).toEqual(new Set());
    expect(cache.clear).toHaveBeenCalledWith("/models/rocket.glb");

    reconcileScenePreloads("paycom-poster", poster, cache, true);
    expect(cache.preload).not.toHaveBeenCalled();
  });

  it("promotes a shared next URL without clearing or preloading it again", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };
    const home = reconcileScenePreloads(
      "home-hero",
      new Set(),
      cache,
      true,
    );
    vi.mocked(cache.preload).mockClear();
    vi.mocked(cache.clear).mockClear();

    const contact = reconcileScenePreloads(
      "contact-hero",
      home,
      cache,
      false,
    );
    expect([...contact]).toEqual(["/models/crane-workout.glb"]);
    expect(cache.preload).not.toHaveBeenCalled();
    expect(cache.clear).toHaveBeenCalledOnce();
    expect(cache.clear).toHaveBeenCalledWith("/models/crane.glb");
  });
});
