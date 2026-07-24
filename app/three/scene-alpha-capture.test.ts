import { describe, expect, it } from "vitest";
import {
  MAX_TRACKED_ALPHA_ADOPTIONS,
  retainedSceneAlphaAdoptionKeys,
  sceneAlphaAdoptionSnapshotsAreCurrent,
  sceneAlphaAdoptionStateIsPresented,
  sceneAlphaCaptureSetComplete,
} from "./scene-alpha-capture";
import { projectFrozenScenePosterSilhouette } from "./scene-runtime-trace";

describe("scene alpha trace capture", () => {
  it("releases capture resources only once the bounded frame set is complete", () => {
    expect(sceneAlphaCaptureSetComplete(0)).toBe(false);
    expect(sceneAlphaCaptureSetComplete(2)).toBe(false);
    expect(sceneAlphaCaptureSetComplete(3)).toBe(true);
    expect(sceneAlphaCaptureSetComplete(4)).toBe(true);
  });

  it("bounds adoption bookkeeping while retaining the current adoption", () => {
    const keys = Array.from({ length: 40 }, (_, index) => `adoption-${index}`);
    const retained = retainedSceneAlphaAdoptionKeys(
      keys,
      "adoption-current",
    );

    expect(retained).toHaveLength(MAX_TRACKED_ALPHA_ADOPTIONS);
    expect(retained.at(-1)).toBe("adoption-current");
    expect(retained).toEqual([
      ...keys.slice(-(MAX_TRACKED_ALPHA_ADOPTIONS - 1)),
      "adoption-current",
    ]);
  });

  it("projects delayed alpha data through capture-time image and stage rectangles", () => {
    const silhouette = projectFrozenScenePosterSilhouette(
      {
        imageRect: { height: 200, width: 400, x: 50, y: 25 },
        source: "/poster.webp",
        stageRect: { height: 300, width: 500, x: 0, y: 0 },
      },
      {
        alphaCoverage: 0.25,
        normalized: {
          bottom: 0.75,
          left: 0.25,
          right: 0.75,
          top: 0.25,
        },
        sampleHeight: 200,
        sampleWidth: 400,
      },
    );

    expect(silhouette).toMatchObject({
      imageRect: { height: 200, width: 400, x: 50, y: 25 },
      source: "/poster.webp",
      stageCenterDelta: { x: 0, y: -25 },
      viewportBounds: {
        bottom: 175,
        centerX: 250,
        centerY: 125,
        left: 150,
        right: 350,
        top: 75,
      },
    });
  });

  it("accepts only an assigned adoption rendered at its current version", () => {
    const expected = {
      adoptionVersion: "4",
      ownerSceneId: "experience-hero",
      poolKey: "resident-stage-2",
    };
    const presented = {
      ...expected,
      poolState: "assigned",
      renderedAdoptionVersion: "4",
    };

    expect(sceneAlphaAdoptionStateIsPresented(presented, expected)).toBe(true);
    expect(
      sceneAlphaAdoptionStateIsPresented(
        { ...presented, poolState: "adopting" },
        expected,
      ),
    ).toBe(false);
    expect(
      sceneAlphaAdoptionStateIsPresented(
        { ...presented, renderedAdoptionVersion: "3" },
        expected,
      ),
    ).toBe(false);
    expect(
      sceneAlphaAdoptionStateIsPresented(
        { ...presented, renderedAdoptionVersion: null },
        expected,
      ),
    ).toBe(false);
    expect(
      sceneAlphaAdoptionStateIsPresented(
        { ...presented, poolKey: null },
        { ...expected, poolKey: null },
      ),
    ).toBe(false);

    const current = {
      ...presented,
      sectionSceneId: expected.ownerSceneId,
    };
    expect(
      sceneAlphaAdoptionSnapshotsAreCurrent(presented, current, expected),
    ).toBe(true);
    expect(
      sceneAlphaAdoptionSnapshotsAreCurrent(
        { ...presented, renderedAdoptionVersion: "3" },
        current,
        expected,
      ),
    ).toBe(false);
    expect(
      sceneAlphaAdoptionSnapshotsAreCurrent(
        presented,
        { ...current, sectionSceneId: "home-hero" },
        expected,
      ),
    ).toBe(false);
  });
});
