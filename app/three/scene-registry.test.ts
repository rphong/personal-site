import { describe, expect, it } from "vitest";
import {
  getRouteHeroSceneId,
  getSceneDefinition,
  getScenePreloadUrls,
  isSceneId,
  LIVE_SCENE_IDS,
  SCENE_DEFINITIONS,
} from "./scene-registry";

function area(
  power: number,
  size: number,
  position: readonly [number, number, number],
  target: readonly [number, number, number],
) {
  return {
    color: "#ffffff",
    intensity: power / (Math.PI * size * size),
    position,
    target,
    width: size,
    height: size,
  };
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
      expect(scene.lighting.world.strength).toBeGreaterThan(0);
      expect(scene.lighting.world.strength).toBeLessThanOrEqual(1);
      expect(scene.lighting.world.linearColor).toHaveLength(3);
      for (const channel of scene.lighting.world.linearColor) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
      expect(scene.lighting.key.intensity).toBeGreaterThan(0);
      expect(scene.lighting.key.color).toMatch(/^#[A-Fa-f0-9]{6}$/);
      expect(scene.lighting.key.position).toHaveLength(3);
      expect(scene.lighting.key.target).toHaveLength(3);
      expect(scene.lighting.key.width).toBeGreaterThan(0);
      expect(scene.lighting.key.height).toBeGreaterThan(0);
      expect(scene.rotation.yaw[0]).toBeGreaterThanOrEqual(-25);
      expect(scene.rotation.yaw[1]).toBeLessThanOrEqual(25);
      expect(scene.rotation.pitch[0]).toBeGreaterThanOrEqual(-8);
      expect(scene.rotation.pitch[1]).toBeLessThanOrEqual(8);
    }
  });

  it("keeps the Blender-authored broad area rigs exact", () => {
    const cranePosition = [0.334772, 7.233446, 1.919428] as const;
    const craneSize = 26.463022;
    expect(
      Object.fromEntries(
        LIVE_SCENE_IDS.map((id) => [id, getSceneDefinition(id).lighting]),
      ),
    ).toEqual({
      "home-hero": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(3000, craneSize, cranePosition, [0, 0, 0]),
      },
      "experience-hero": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(3000, craneSize, cranePosition, [0, 0, 0]),
      },
      "experience-intro": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(4000, craneSize, cranePosition, [0, 0, 0]),
      },
      "nasa-rocket": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(
          5000,
          20,
          [-3.736411, 4.354816, 0.722618],
          [-1.06, 0, 0.5],
        ),
      },
      "projects-hero": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(
          3750,
          craneSize,
          [1.141019, 6.502828, 1.778768],
          [-1.7, 0, -0.15],
        ),
      },
      "league-ban": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(
          4000,
          30,
          [-0.84895, 3.693709, 0.832018],
          [-0.86, 0, 0.88],
        ),
      },
      "froggie-adventures": {
        exposure: 1,
        world: {
          linearColor: [0.4286905, 0.6583748, 0.7529422],
          strength: 0.7,
        },
        key: area(720, 5, [4.2, 7.2, 5], [-1.85, 0, -2.2]),
      },
      "contact-hero": {
        exposure: 1,
        world: { linearColor: [0.05, 0.05, 0.05], strength: 1 },
        key: area(3000, craneSize, cranePosition, [0, 0, 0]),
      },
    });
  });

  it("keeps EOG and Paycom intentionally poster-only", () => {
    expect(getSceneDefinition("eog-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("eog-poster").requiredLive).toBe(false);
    expect(getSceneDefinition("paycom-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("paycom-poster").requiredLive).toBe(false);
  });

  it("authors compact contact and source-aligned cast lobes per composition", () => {
    expect(
      Object.fromEntries(
        LIVE_SCENE_IDS.map((id) => [
          id,
          getSceneDefinition(id).groundShadow.lobes.map(({ profile }) =>
            profile,
          ),
        ]),
      ),
    ).toEqual({
      "home-hero": ["contact", "contact", "cast"],
      "experience-hero": ["contact", "contact", "cast"],
      "experience-intro": ["contact", "contact", "cast"],
      "nasa-rocket": ["contact", "cast"],
      "projects-hero": ["contact", "cast", "contact", "cast"],
      "league-ban": [
        "contact",
        "cast",
        "contact",
        "cast",
        "contact",
        "cast",
      ],
      "froggie-adventures": ["contact", "cast"],
      "contact-hero": ["contact", "contact", "cast"],
    });

    for (const id of LIVE_SCENE_IDS) {
      const scene = getSceneDefinition(id);
      expect(scene.groundShadow.textureSize).toBe(256);
      for (const lobe of scene.groundShadow.lobes) {
        expect(lobe.opacity).toBeGreaterThan(0);
        expect(lobe.opacity).toBeLessThan(0.5);
        expect(lobe.position).toHaveLength(3);
        expect(lobe.scale[0]).toBeGreaterThan(0);
        expect(lobe.scale[1]).toBeGreaterThan(0);
        expect(Number.isFinite(lobe.rotation)).toBe(true);

        if (lobe.profile !== "cast") continue;
        const fromKeyX = lobe.position[0] - scene.lighting.key.position[0];
        const fromKeyZ = lobe.position[2] - scene.lighting.key.position[2];
        const magnitude = Math.hypot(fromKeyX, fromKeyZ);
        const castX = Math.cos(lobe.rotation);
        const castZ = -Math.sin(lobe.rotation);
        const alignment =
          castX * (fromKeyX / magnitude) + castZ * (fromKeyZ / magnitude);
        expect(alignment).toBeGreaterThan(0.999_999);
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
