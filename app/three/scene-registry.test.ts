import { describe, expect, it } from "vitest";
import {
  getRouteHeroSceneId,
  getSceneDefinition,
  getScenePreloadUrls,
  isSceneId,
  LIVE_SCENE_IDS,
  SCENE_DEFINITIONS,
} from "./scene-registry";

function directional(
  color: string,
  intensity: number,
  position: readonly [number, number, number],
) {
  return { color, intensity, position, castShadow: false };
}

describe("scene registry", () => {
  it("keeps the exact ten-scene product order and adjacency chain", () => {
    const order = [
      "home-hero",
      "experience-hero",
      "experience-intro",
      "nasa-rocket",
      "eog-poster",
      "paycom-poster",
      "projects-hero",
      "league-ban",
      "froggie-adventures",
      "contact-hero",
    ] as const;
    expect(Object.keys(SCENE_DEFINITIONS)).toEqual(order);
    expect(order.map((id) => getSceneDefinition(id).nextSceneId)).toEqual([
      ...order.slice(1),
      null,
    ]);
  });

  it("uses the eight immutable live section IDs", () => {
    expect(LIVE_SCENE_IDS).toEqual([
      "home-hero",
      "experience-hero",
      "experience-intro",
      "nasa-rocket",
      "projects-hero",
      "league-ban",
      "froggie-adventures",
      "contact-hero",
    ]);
  });

  it("gives every live scene a model, posters, framing, light, and bounded rotation", () => {
    for (const id of LIVE_SCENE_IDS) {
      const scene = getSceneDefinition(id);
      expect(scene.requiredLive).toBe(true);
      expect(scene.modelUrl).toMatch(/^\/models\/.+\.glb$/);
      expect(scene.poster.desktop).toMatch(/^\/posters\/.+-desktop\.webp$/);
      expect(scene.poster.mobile).toMatch(/^\/posters\/.+-mobile\.webp$/);
      for (const frame of [scene.desktop, scene.mobile]) {
        expect(frame.cameraPosition).toHaveLength(3);
        expect(frame.cameraTarget).toHaveLength(3);
        expect(frame.fov).toBeGreaterThan(0);
        expect(frame.fov).toBeLessThanOrEqual(120);
        for (const inset of Object.values(frame.rotationArea)) {
          expect(Number.isFinite(inset)).toBe(true);
          expect(inset).toBeGreaterThanOrEqual(0);
          expect(inset).toBeLessThanOrEqual(100);
        }
        expect(frame.rotationArea.top + frame.rotationArea.bottom).toBeLessThan(
          100,
        );
        expect(frame.rotationArea.left + frame.rotationArea.right).toBeLessThan(
          100,
        );
      }
      expect(scene.lighting.exposure).toBeGreaterThan(0);
      expect(scene.lighting.exposure).toBeLessThanOrEqual(1.2);
      expect(scene.lighting.hemisphere.intensity).toBeGreaterThan(0);
      expect(scene.lighting.hemisphere.skyColor).toMatch(/^#[A-Fa-f0-9]{6}$/);
      expect(scene.lighting.hemisphere.groundColor).toMatch(
        /^#[A-Fa-f0-9]{6}$/,
      );
      for (const role of ["key", "fill", "rim"] as const) {
        const light = scene.lighting[role];
        expect(light.intensity).toBeGreaterThan(0);
        expect(light.color).toMatch(/^#[A-Fa-f0-9]{6}$/);
        expect(light.position).toHaveLength(3);
        expect(light.castShadow).toBe(false);
      }
      expect(
        scene.lighting.fill.intensity / scene.lighting.key.intensity,
      ).toBeGreaterThanOrEqual(0.25);
      expect(
        scene.lighting.fill.intensity / scene.lighting.key.intensity,
      ).toBeLessThanOrEqual(0.55);
      expect(
        scene.lighting.rim.intensity / scene.lighting.key.intensity,
      ).toBeGreaterThanOrEqual(0.35);
      expect(
        scene.lighting.rim.intensity / scene.lighting.key.intensity,
      ).toBeLessThanOrEqual(0.5);
      expect(scene.rotation.yaw[0]).toBeGreaterThanOrEqual(-25);
      expect(scene.rotation.yaw[1]).toBeLessThanOrEqual(25);
      expect(scene.rotation.pitch[0]).toBeGreaterThanOrEqual(-8);
      expect(scene.rotation.pitch[1]).toBeLessThanOrEqual(8);
    }
  });

  it("keeps the reviewed per-scene three-point rigs exact", () => {
    expect(
      Object.fromEntries(
        LIVE_SCENE_IDS.map((id) => [id, getSceneDefinition(id).lighting]),
      ),
    ).toEqual({
      "home-hero": {
        exposure: 1.11,
        hemisphere: {
          skyColor: "#f0f4f2",
          groundColor: "#69716f",
          intensity: 0.62,
        },
        key: directional("#e8f4f2", 2.65, [-5, 9, 3]),
        fill: directional("#d9e9ed", 0.72, [5, 3, 4]),
        rim: directional("#ffffff", 0.98, [2, 7, -6]),
      },
      "experience-hero": {
        exposure: 1.09,
        hemisphere: {
          skyColor: "#f0f4f2",
          groundColor: "#69716f",
          intensity: 0.62,
        },
        key: directional("#e8f4f2", 2.65, [-5, 9, 3.5]),
        fill: directional("#d9e9ed", 0.72, [5, 3, 4]),
        rim: directional("#ffffff", 0.98, [2, 7, -6]),
      },
      "experience-intro": {
        exposure: 1.08,
        hemisphere: {
          skyColor: "#f0f4f2",
          groundColor: "#69716f",
          intensity: 0.6,
        },
        key: directional("#e8f4f2", 2.5, [-5, 8.5, 3]),
        fill: directional("#d9e9ed", 0.68, [5, 2.5, 3.5]),
        rim: directional("#ffffff", 0.92, [3, 7, -5]),
      },
      "nasa-rocket": {
        exposure: 1,
        hemisphere: {
          skyColor: "#f4f5f3",
          groundColor: "#686d6c",
          intensity: 0.4,
        },
        key: directional("#fffefa", 1.85, [-5, 9, 3.5]),
        fill: directional("#dce8eb", 0.48, [5, 3, 4]),
        rim: directional("#ffffff", 0.68, [2, 8, -6]),
      },
      "projects-hero": {
        exposure: 1.1,
        hemisphere: {
          skyColor: "#eef4f3",
          groundColor: "#687172",
          intensity: 0.62,
        },
        key: directional("#e8f4f2", 2.6, [-5, 9, 3.5]),
        fill: directional("#d8e9ed", 0.7, [6, 3, 4]),
        rim: directional("#ffffff", 0.96, [2, 7, -6]),
      },
      "league-ban": {
        exposure: 1.08,
        hemisphere: {
          skyColor: "#eef3f2",
          groundColor: "#686f70",
          intensity: 0.6,
        },
        key: directional("#e8f4f2", 2.45, [-5, 8.5, 3.5]),
        fill: directional("#d8e8ec", 0.66, [6, 3, 4]),
        rim: directional("#ffffff", 0.9, [3, 7, -6]),
      },
      "froggie-adventures": {
        exposure: 1,
        hemisphere: {
          skyColor: "#f2f4f3",
          groundColor: "#646b6c",
          intensity: 0.4,
        },
        key: directional("#e8f4f2", 1.65, [-4, 8.5, 3.5]),
        fill: directional("#dce8eb", 0.43, [5, 3, 4]),
        rim: directional("#ffffff", 0.62, [2, 7, -6]),
      },
      "contact-hero": {
        exposure: 1.09,
        hemisphere: {
          skyColor: "#f1f3f3",
          groundColor: "#6c7074",
          intensity: 0.62,
        },
        key: directional("#e8f4f2", 2.65, [-5, 9, 3.5]),
        fill: directional("#dde8ef", 0.72, [5, 3, 4]),
        rim: directional("#ffffff", 0.98, [2, 7, -6]),
      },
    });
  });

  it("keeps EOG and Paycom intentionally poster-only", () => {
    expect(getSceneDefinition("eog-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("eog-poster").requiredLive).toBe(false);
    expect(getSceneDefinition("paycom-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("paycom-poster").requiredLive).toBe(false);
  });

  it("keeps every live scene grounded with its reviewed contact blob", () => {
    expect(
      Object.fromEntries(
        LIVE_SCENE_IDS.map((id) => [
          id,
          getSceneDefinition(id).contactShadow,
        ]),
      ),
    ).toEqual({
      "home-hero": {
        opacity: 0.58,
        position: [-1.05, -0.46, -0.55],
        scale: [1.9, 0.72],
        textureSize: 64,
      },
      "experience-hero": {
        opacity: 0.62,
        position: [0.1, -0.01, 0.45],
        scale: [2.6, 1.2],
        textureSize: 64,
      },
      "experience-intro": {
        opacity: 0.5,
        position: [-0.1, -0.01, 0],
        scale: [2.3, 0.95],
        textureSize: 64,
      },
      "nasa-rocket": {
        opacity: 0.46,
        position: [0, 0.01, -0.95],
        scale: [4.3, 2.05],
        textureSize: 64,
      },
      "projects-hero": {
        opacity: 0.58,
        position: [0.1, -0.18, 0.8],
        scale: [3.1, 1.6],
        textureSize: 64,
      },
      "league-ban": {
        opacity: 0.52,
        position: [0.65, -0.01, 0.2],
        scale: [5.8, 2.7],
        textureSize: 64,
      },
      "froggie-adventures": {
        opacity: 0.46,
        position: [0, -0.01, 0],
        scale: [2.9, 1.3],
        textureSize: 64,
      },
      "contact-hero": {
        opacity: 0.62,
        position: [0.1, -0.01, 0.45],
        scale: [2.6, 1.2],
        textureSize: 64,
      },
    });

    for (const id of LIVE_SCENE_IDS) {
      const scene = getSceneDefinition(id);
      expect(scene.contactShadow.textureSize).toBe(64);
      for (const role of ["key", "fill", "rim"] as const) {
        expect(scene.lighting[role].castShadow).toBe(false);
      }
    }
  });

  it("samples the reviewed interaction poses once without enabling playback", () => {
    const workoutPose = {
      clips: [
        { name: "Dumbell L", timeSeconds: 40 / 24 },
        { name: "Dumbell R", timeSeconds: 40 / 24 },
        { name: "Lifting Weights", timeSeconds: 40 / 24 },
      ],
    };
    expect(getSceneDefinition("experience-hero").staticPose).toEqual(
      workoutPose,
    );
    expect(getSceneDefinition("contact-hero").staticPose).toEqual(workoutPose);
    expect(getSceneDefinition("experience-intro").staticPose).toEqual({
      clips: [
        { name: "EmptyAction", timeSeconds: 1 / 24 },
        { name: "Hat propellerAction.002", timeSeconds: 2 / 24 },
      ],
    });
    for (const id of LIVE_SCENE_IDS.filter(
      (id) =>
        id !== "experience-hero" &&
        id !== "experience-intro" &&
        id !== "contact-hero",
    )) {
      expect("staticPose" in getSceneDefinition(id)).toBe(false);
    }
  });

  it("keeps heroes full-bleed while live chapter scenes reveal their band surfaces", () => {
    expect(
      Object.fromEntries(
        Object.keys(SCENE_DEFINITIONS).map((id) => [
          id,
          getSceneDefinition(id as keyof typeof SCENE_DEFINITIONS).background,
        ]),
      ),
    ).toEqual({
      "home-hero": "#9ECCC0",
      "experience-hero": "#DFA9B5",
      "experience-intro": "transparent",
      "nasa-rocket": "transparent",
      "eog-poster": "#EEEEEE",
      "paycom-poster": "#EEEEEE",
      "projects-hero": "#AFD4E1",
      "league-ban": "transparent",
      "froggie-adventures": "transparent",
      "contact-hero": "#C9BAE4",
    });
  });

  it("pins the integrated chapter frames and model-sized rotation hotspots", () => {
    expect(
      Object.fromEntries(
        ([
          "experience-intro",
          "nasa-rocket",
          "league-ban",
          "froggie-adventures",
        ] as const).map((id) => {
          const scene = getSceneDefinition(id);
          return [id, { desktop: scene.desktop, mobile: scene.mobile }];
        }),
      ),
    ).toEqual({
      "experience-intro": {
        desktop: {
          cameraPosition: [4.4, 3.2, 7.2],
          cameraTarget: [0, 0.6, 0],
          fov: 34,
          rotationArea: { top: 12, right: 4, bottom: 12, left: 42 },
        },
        mobile: {
          cameraPosition: [4.6, 2.9, 7.2],
          cameraTarget: [0, 0.5, 0],
          fov: 34,
          rotationArea: { top: 6, right: 8, bottom: 50, left: 8 },
        },
      },
      "nasa-rocket": {
        desktop: {
          cameraPosition: [5.7, 3.9, 8.8],
          cameraTarget: [0, 0.9, 0],
          fov: 36,
          rotationArea: { top: 12, right: 4, bottom: 12, left: 42 },
        },
        mobile: {
          cameraPosition: [3.8, 3.4, 8],
          cameraTarget: [0, 1, 0],
          fov: 36,
          rotationArea: { top: 6, right: 8, bottom: 50, left: 8 },
        },
      },
      "league-ban": {
        desktop: {
          cameraPosition: [4.5, 2.9, 6.5],
          cameraTarget: [0, 0, 0],
          fov: 34,
          rotationArea: { top: 10, right: 14, bottom: 46, left: 14 },
        },
        mobile: {
          cameraPosition: [7.5, 5.2, 13.5],
          cameraTarget: [0, -0.1, 0],
          fov: 38,
          rotationArea: { top: 6, right: 6, bottom: 50, left: 6 },
        },
      },
      "froggie-adventures": {
        desktop: {
          cameraPosition: [5.1, 4.3, 10.5],
          cameraTarget: [0, 2, 0],
          fov: 37,
          rotationArea: { top: 10, right: 14, bottom: 46, left: 14 },
        },
        mobile: {
          cameraPosition: [6.2, 5, 12.5],
          cameraTarget: [0, 1.7, 0],
          fov: 39,
          rotationArea: { top: 6, right: 6, bottom: 50, left: 6 },
        },
      },
    });

    for (const id of [
      "home-hero",
      "experience-hero",
      "projects-hero",
      "contact-hero",
    ] as const) {
      expect(getSceneDefinition(id).desktop.rotationArea).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
      expect(getSceneDefinition(id).mobile.rotationArea).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
    }
  });

  it("pins the projects hero composition frame", () => {
    expect(getSceneDefinition("projects-hero").desktop).toEqual({
      cameraPosition: [4.4, 2.8, 6.1],
      cameraTarget: [0.2, 0.8, 0.3],
      fov: 36,
      rotationArea: { top: 8, right: 8, bottom: 8, left: 8 },
    });
  });

  it("maps each real route to its destination hero", () => {
    expect(getRouteHeroSceneId("/")).toBe("home-hero");
    expect(getRouteHeroSceneId("/experience")).toBe("experience-hero");
    expect(getRouteHeroSceneId("/projects")).toBe("projects-hero");
    expect(getRouteHeroSceneId("/contact")).toBe("contact-hero");
  });

  it("preloads no more than current plus the immediate next model", () => {
    expect(getScenePreloadUrls("home-hero")).toEqual([
      "/models/crane.glb",
      "/models/crane-workout.glb",
    ]);
    expect(getScenePreloadUrls("experience-intro")).toEqual([
      "/models/crane-throwing-plane.glb",
      "/models/rocket.glb",
    ]);
    expect(getScenePreloadUrls("nasa-rocket")).toEqual([
      "/models/rocket.glb",
    ]);
    expect(getScenePreloadUrls("eog-poster")).toEqual([]);
    expect(getScenePreloadUrls("paycom-poster")).toEqual([]);
    expect(getScenePreloadUrls("league-ban")).toEqual([
      "/models/crane-on-league.glb",
      "/models/froggie-display.glb",
    ]);
    expect(getScenePreloadUrls("contact-hero")).toEqual([
      "/models/crane-workout.glb",
    ]);
    for (const scene of Object.values(SCENE_DEFINITIONS)) {
      expect(getScenePreloadUrls(scene.id).length).toBeLessThanOrEqual(2);
    }
  });

  it("validates capture-route scene parameters", () => {
    expect(isSceneId("nasa-rocket")).toBe(true);
    expect(isSceneId("not-a-scene")).toBe(false);
  });
});
