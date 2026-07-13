import { describe, expect, it } from "vitest";
import {
  getRouteHeroSceneId,
  getSceneDefinition,
  getScenePreloadUrls,
  isSceneId,
  LIVE_SCENE_IDS,
  SCENE_DEFINITIONS,
} from "./scene-registry";

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
      expect(scene.desktop.rotationArea).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
      expect(scene.mobile.rotationArea).toEqual({
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      });
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
      expect(scene.lighting.ambient.intensity).toBeGreaterThan(0);
      expect(scene.lighting.ambient.color).toMatch(/^#[A-Fa-f0-9]{6}$/);
      expect(scene.lighting.key.intensity).toBeGreaterThan(0);
      expect(scene.lighting.key.color).toMatch(/^#[A-Fa-f0-9]{6}$/);
      expect(scene.lighting.key.position).toHaveLength(3);
      expect(scene.lighting.key.castShadow).toBe(false);
      expect(scene.rotation.yaw[0]).toBeGreaterThanOrEqual(-25);
      expect(scene.rotation.yaw[1]).toBeLessThanOrEqual(25);
      expect(scene.rotation.pitch[0]).toBeGreaterThanOrEqual(-8);
      expect(scene.rotation.pitch[1]).toBeLessThanOrEqual(8);
    }
  });

  it("keeps EOG and Paycom intentionally poster-only", () => {
    expect(getSceneDefinition("eog-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("eog-poster").requiredLive).toBe(false);
    expect(getSceneDefinition("paycom-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("paycom-poster").requiredLive).toBe(false);
  });

  it("grounds only Home with one low-resolution blob and no shadow-map light", () => {
    const home = getSceneDefinition("home-hero");
    expect(home.contactShadow).toEqual({
      opacity: 0.16,
      position: [-0.25, -0.47, -0.6],
      scale: [1.8, 0.8],
      textureSize: 64,
    });
    expect(home.lighting).toEqual({
      ambient: { color: "#e8f3f0", intensity: 2.4 },
      key: {
        color: "#e8f3f0",
        intensity: 1.4,
        position: [-3.5, 6, 4.5],
        castShadow: false,
      },
    });
    for (const id of LIVE_SCENE_IDS.filter((id) => id !== "home-hero")) {
      expect("contactShadow" in getSceneDefinition(id)).toBe(false);
    }
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
