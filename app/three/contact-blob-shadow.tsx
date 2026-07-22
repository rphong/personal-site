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

export const CONTACT_SHADOW_TEXTURE_SIZE = 256 as const;

export function createContactShadowTexture(
  size: typeof CONTACT_SHADOW_TEXTURE_SIZE = CONTACT_SHADOW_TEXTURE_SIZE,
): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot((x - center) / center, (y - center) / center);
      const falloff = Math.max(0, 1 - distance * distance);
      // A broad gaussian-like shoulder preserves a dark contact core while
      // fading without the visible concentric bands of the former 64px blob.
      const alpha = Math.round(255 * falloff * falloff);
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
      <circleGeometry args={[0.5, 64]} />
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
