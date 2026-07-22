import ReactThreeTestRenderer from "@react-three/test-renderer";
import { DataTexture, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  AuthoredGroundShadow,
  createGroundShadowTexture,
  GROUND_SHADOW_TEXTURE_SIZE,
} from "./authored-ground-shadow";
import { getSceneDefinition } from "./scene-registry";

function alphaAt(texture: DataTexture, xRatio: number, yRatio: number): number {
  const size = texture.image.width;
  const x = Math.round((size - 1) * xRatio);
  const y = Math.round((size - 1) * yRatio);
  return (texture.image.data as Uint8Array)[(y * size + x) * 4 + 3];
}

describe("AuthoredGroundShadow", () => {
  it("builds distinct soft contact and directional cast profiles", () => {
    const contact = createGroundShadowTexture("contact");
    const cast = createGroundShadowTexture("cast");

    expect(contact).toBeInstanceOf(DataTexture);
    expect(contact.image.width).toBe(GROUND_SHADOW_TEXTURE_SIZE);
    expect(cast.image.width).toBe(GROUND_SHADOW_TEXTURE_SIZE);
    expect(alphaAt(contact, 0, 0)).toBe(0);
    expect(alphaAt(contact, 0.5, 0.5)).toBeGreaterThan(250);
    expect(alphaAt(cast, 0, 0.5)).toBe(0);
    expect(alphaAt(cast, 0.14, 0.5)).toBeGreaterThan(
      alphaAt(cast, 0.8, 0.5),
    );
    expect(alphaAt(cast, 0.4, 0.5)).toBeGreaterThan(
      alphaAt(cast, 0.4, 0.05),
    );

    contact.dispose();
    cast.dispose();
  });

  it("renders every authored source-aligned lobe with shared textures", async () => {
    const definition = getSceneDefinition("projects-hero").groundShadow;
    const renderer = await ReactThreeTestRenderer.create(
      <AuthoredGroundShadow definition={definition} />,
    );
    const lobes = renderer.scene.findAll(
      (node) => node.instance.name?.startsWith("ground-shadow-lobe:"),
    );

    expect(lobes).toHaveLength(definition.lobes.length);
    const maps = new Set<DataTexture>();
    for (const [index, node] of lobes.entries()) {
      const lobe = definition.lobes[index];
      const shadow = node.instance as Mesh;
      const material = shadow.material as MeshBasicMaterial;
      const parent = shadow.parent!;
      expect(parent.position.toArray()).toEqual([...lobe.position]);
      expect(parent.rotation.y).toBe(lobe.rotation);
      expect(shadow.scale.toArray()).toEqual([
        lobe.scale[0],
        lobe.scale[1],
        1,
      ]);
      expect(shadow.castShadow).toBe(false);
      expect(shadow.receiveShadow).toBe(false);
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.opacity).toBe(lobe.opacity);
      maps.add(material.map as DataTexture);
    }
    expect(maps.size).toBe(2);
    await renderer.unmount();
  });
});
