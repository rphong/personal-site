import { describe, expect, it } from "vitest";
import { getSceneDefinition } from "./scene-registry";
import {
  applySceneTuning,
  isSceneTuning,
  tuningFromScene,
} from "./scene-tuning";

describe("scene tuning", () => {
  it("round-trips a live registry scene into an editable tuning", () => {
    const scene = getSceneDefinition("home-hero");
    const tuning = tuningFromScene(scene);

    expect(isSceneTuning(tuning)).toBe(true);
    expect(tuning.desktop.cameraPosition).toEqual(scene.desktop.cameraPosition);
    expect(tuning.model).toEqual({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
    });
  });

  it("applies camera and model tuning without replacing rotation areas", () => {
    const scene = getSceneDefinition("projects-hero");
    const tuned = applySceneTuning(scene, {
      desktop: {
        cameraPosition: [1, 2, 3],
        cameraTarget: [4, 5, 6],
        fov: 42,
      },
      mobile: {
        cameraPosition: [7, 8, 9],
        cameraTarget: [1, 1, 1],
        fov: 48,
      },
      model: {
        position: [0.5, -1, 2],
        rotation: [10, 20, 30],
        scale: 1.25,
      },
    });

    expect(tuned.desktop.cameraPosition).toEqual([1, 2, 3]);
    expect(tuned.desktop.rotationArea).toBe(scene.desktop.rotationArea);
    expect(tuned.requiredLive && tuned.modelTransform.scale).toBe(1.25);
  });

  it("rejects malformed persisted values", () => {
    expect(
      isSceneTuning({
        desktop: { cameraPosition: [0, 0, 0], cameraTarget: [0, 0, 0], fov: 0 },
        mobile: { cameraPosition: [0, 0, 0], cameraTarget: [0, 0, 0], fov: 40 },
        model: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
      }),
    ).toBe(false);
  });
});
