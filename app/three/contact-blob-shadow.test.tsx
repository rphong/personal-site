import ReactThreeTestRenderer from "@react-three/test-renderer";
import { DataTexture, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  CONTACT_SHADOW_TEXTURE_SIZE,
  ContactBlobShadow,
  createContactShadowTexture,
} from "./contact-blob-shadow";
import { getSceneDefinition } from "./scene-registry";

describe("ContactBlobShadow", () => {
  it("builds one bounded low-resolution alpha texture", () => {
    const texture = createContactShadowTexture();
    expect(texture).toBeInstanceOf(DataTexture);
    expect(texture.image.width).toBe(CONTACT_SHADOW_TEXTURE_SIZE);
    expect(texture.image.height).toBe(CONTACT_SHADOW_TEXTURE_SIZE);
    const pixels = texture.image.data as Uint8Array;
    expect(pixels[3]).toBe(0);
    const center = Math.floor(CONTACT_SHADOW_TEXTURE_SIZE / 2);
    expect(
      pixels[(center * CONTACT_SHADOW_TEXTURE_SIZE + center) * 4 + 3],
    ).toBeGreaterThan(240);
    texture.dispose();
  });

  it("reuses the 64px blob design for newly grounded scenes", async () => {
    const definition = getSceneDefinition("nasa-rocket").contactShadow;
    const renderer = await ReactThreeTestRenderer.create(
      <ContactBlobShadow definition={definition} />,
    );
    const shadow = renderer.scene.findByProps({ name: "contact-blob-shadow" })
      .instance as Mesh;
    const material = shadow.material as MeshBasicMaterial;

    expect(shadow.castShadow).toBe(false);
    expect(shadow.receiveShadow).toBe(false);
    expect(shadow.position.toArray()).toEqual([...definition.position]);
    expect(shadow.scale.toArray()).toEqual([
      definition.scale[0],
      definition.scale[1],
      1,
    ]);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBe(definition.opacity);
    expect((material.map as DataTexture).image.width).toBe(
      CONTACT_SHADOW_TEXTURE_SIZE,
    );
    await renderer.unmount();
  });
});
