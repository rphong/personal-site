"use client";

import { useEffect, useMemo } from "react";
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
} from "three";
import type { SceneContactShadow } from "./types";

export const CONTACT_SHADOW_TEXTURE_SIZE = 64 as const;

export function createContactShadowTexture(
  size: typeof CONTACT_SHADOW_TEXTURE_SIZE = CONTACT_SHADOW_TEXTURE_SIZE,
): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot((x - center) / center, (y - center) / center);
      const falloff = Math.max(0, 1 - distance);
      const alpha = Math.round(255 * falloff * falloff * (3 - 2 * falloff));
      const offset = (y * size + x) * 4;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = alpha;
    }
  }

  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = NoColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function ContactBlobShadow({
  definition,
}: {
  readonly definition: SceneContactShadow;
}) {
  const texture = useMemo(
    () => createContactShadowTexture(definition.textureSize),
    [definition.textureSize],
  );

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh
      name="contact-blob-shadow"
      position={definition.position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[definition.scale[0], definition.scale[1], 1]}
      castShadow={false}
      receiveShadow={false}
    >
      <circleGeometry args={[0.5, 32]} />
      <meshBasicMaterial
        color="#000000"
        depthWrite={false}
        map={texture}
        opacity={definition.opacity}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
