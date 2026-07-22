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
import type {
  SceneGroundShadow,
  SceneGroundShadowLobe,
} from "./types";

export const GROUND_SHADOW_TEXTURE_SIZE = 256 as const;
export type GroundShadowProfile = SceneGroundShadowLobe["profile"];

function smoothstep(min: number, max: number, value: number): number {
  const progress = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return progress * progress * (3 - 2 * progress);
}

function contactAlpha(u: number, v: number): number {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const falloff = Math.max(0, 1 - x * x - y * y);
  return falloff * falloff;
}

function castAlpha(u: number, v: number): number {
  // The authored cast profile begins at the object, widens away from the
  // source key, and loses density through the long penumbra. Per-scene scale
  // and rotation turn this one inexpensive texture into the source-aligned
  // cast lobe for each composition.
  const entry = smoothstep(0, 0.16, u);
  const tail = Math.pow(Math.max(0, 1 - u), 1.35);
  const halfWidth = 0.26 + u * 0.24;
  const lateralDistance = Math.abs(v - 0.5) / halfWidth;
  const lateral = Math.max(0, 1 - lateralDistance * lateralDistance);
  return entry * tail * lateral * lateral;
}

export function createGroundShadowTexture(
  profile: GroundShadowProfile,
  size: typeof GROUND_SHADOW_TEXTURE_SIZE = GROUND_SHADOW_TEXTURE_SIZE,
): DataTexture {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const alpha = profile === "contact" ? contactAlpha(u, v) : castAlpha(u, v);
      const offset = (y * size + x) * 4;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = Math.round(255 * alpha);
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

export function AuthoredGroundShadow({
  definition,
}: {
  readonly definition: SceneGroundShadow;
}) {
  const textures = useMemo(
    () => ({
      cast: createGroundShadowTexture("cast", definition.textureSize),
      contact: createGroundShadowTexture("contact", definition.textureSize),
    }),
    [definition.textureSize],
  );

  useEffect(
    () => () => {
      textures.cast.dispose();
      textures.contact.dispose();
    },
    [textures],
  );

  return (
    <group name="authored-ground-shadow">
      {definition.lobes.map((lobe, index) => (
        <group
          key={`${lobe.profile}:${index}`}
          position={lobe.position}
          rotation={[0, lobe.rotation, 0]}
        >
          <mesh
            name={`ground-shadow-lobe:${lobe.profile}:${index}`}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[lobe.scale[0], lobe.scale[1], 1]}
            castShadow={false}
            receiveShadow={false}
            renderOrder={index}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color="#000000"
              depthWrite={false}
              map={textures[lobe.profile]}
              opacity={lobe.opacity}
              toneMapped={false}
              transparent
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
