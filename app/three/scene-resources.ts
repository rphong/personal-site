import {
  BufferGeometry,
  Material,
  Mesh,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uniform,
  UniformsGroup,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

interface OwnedSceneResources {
  readonly geometries: Set<BufferGeometry>;
  readonly materials: Set<Material>;
  readonly textures: Set<Texture>;
  readonly skeletons: Set<Skeleton>;
  readonly uniformGroups: Set<UniformsGroup>;
}

const ownedByRoot = new WeakMap<Object3D, OwnedSceneResources>();
const disposedRoots = new WeakSet<Object3D>();
const disposedGeometries = new WeakSet<BufferGeometry>();
const disposedMaterials = new WeakSet<Material>();
const disposedTextures = new WeakSet<Texture>();
const disposedSkeletons = new WeakSet<Skeleton>();
const disposedUniformGroups = new WeakSet<UniformsGroup>();
const discardedTextureClones = new WeakSet<Texture>();
const payloadStates = new WeakMap<object, { closed: boolean; references: number }>();
const payloadsByTexture = new WeakMap<Texture, object[]>();

function createOwnedResources(): OwnedSceneResources {
  return {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
    skeletons: new Set(),
    uniformGroups: new Set(),
  };
}

function closeablePayloads(value: unknown): object[] {
  if (Array.isArray(value)) return value.flatMap(closeablePayloads);
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { close?: unknown }).close === "function"
  ) {
    return [value];
  }
  return [];
}

function retainTexturePayload(texture: Texture): void {
  if (payloadsByTexture.has(texture)) return;
  const payloads = closeablePayloads(texture.source.data);
  payloadsByTexture.set(texture, payloads);
  for (const payload of payloads) {
    const state = payloadStates.get(payload) ?? { closed: false, references: 0 };
    state.references += 1;
    payloadStates.set(payload, state);
  }
}

function releaseTexturePayload(texture: Texture): void {
  if (!payloadsByTexture.has(texture)) retainTexturePayload(texture);
  const payloads = payloadsByTexture.get(texture) ?? [];
  payloadsByTexture.delete(texture);
  for (const payload of payloads) {
    const state = payloadStates.get(payload);
    if (!state) continue;
    state.references = Math.max(0, state.references - 1);
    if (state.references !== 0 || state.closed) continue;
    state.closed = true;
    try {
      (payload as { close: () => void }).close();
    } catch {
      // Image payload cleanup is best-effort after every Texture owner is gone.
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRenderTargetTexture(texture: Texture): boolean {
  return Boolean(
    (texture as Texture & { readonly isRenderTargetTexture?: boolean })
      .isRenderTargetTexture,
  );
}

interface TextureGraphResult {
  readonly containsTexture: boolean;
  readonly value: unknown;
}

function discardUnusedTextureClone(
  candidate: unknown,
  source: Texture,
  output: Texture,
  owned: OwnedSceneResources,
): void {
  if (
    !(candidate instanceof Texture) ||
    candidate === source ||
    candidate === output ||
    owned.textures.has(candidate) ||
    discardedTextureClones.has(candidate)
  ) {
    return;
  }
  discardedTextureClones.add(candidate);
  candidate.dispose();
}

function cloneTextureGraph(
  source: unknown,
  target: unknown,
  textureClones: Map<Texture, Texture>,
  owned: OwnedSceneResources,
  visited: WeakMap<object, unknown>,
): TextureGraphResult {
  if (source instanceof Texture) {
    if (isRenderTargetTexture(source)) {
      throw new Error(
        "Runtime scene material contains an unsupported render-target texture",
      );
    }
    let clone = textureClones.get(source);
    if (!clone) {
      retainTexturePayload(source);
      clone =
        target instanceof Texture &&
        target !== source &&
        !isRenderTargetTexture(target)
          ? target
          : source.clone();
      retainTexturePayload(clone);
      textureClones.set(source, clone);
      owned.textures.add(clone);
    } else {
      discardUnusedTextureClone(target, source, clone, owned);
    }
    return { containsTexture: true, value: clone };
  }

  if (source instanceof Uniform) {
    const seen = visited.get(source);
    if (seen) return { containsTexture: true, value: seen };
    const output =
      target instanceof Uniform && target !== source
        ? target
        : source.clone();
    visited.set(source, output);
    const targetValue =
      target instanceof Uniform
        ? target.value
        : isPlainRecord(target)
          ? target.value
          : output.value;
    const result = cloneTextureGraph(
      source.value,
      targetValue,
      textureClones,
      owned,
      visited,
    );
    if (result.containsTexture) output.value = result.value;
    return { containsTexture: result.containsTexture, value: output };
  }

  if (source instanceof UniformsGroup) {
    const seen = visited.get(source);
    if (seen) return { containsTexture: true, value: seen };
    const output =
      target instanceof UniformsGroup && target !== source
        ? target
        : new UniformsGroup();
    visited.set(source, output);
    output.setName(
      (source as UniformsGroup & { readonly name?: string }).name ?? "",
    );
    output.setUsage(source.usage);
    owned.uniformGroups.add(output);
    const sourceUniforms = source.uniforms.flatMap((entry) =>
      Array.isArray(entry) ? entry : [entry],
    );
    const targetUniforms = output.uniforms.flatMap((entry) =>
      Array.isArray(entry) ? entry : [entry],
    );
    const runtimeUniforms: Uniform[] = [];
    for (let index = 0; index < sourceUniforms.length; index += 1) {
      const result = cloneTextureGraph(
        sourceUniforms[index],
        targetUniforms[index],
        textureClones,
        owned,
        visited,
      );
      runtimeUniforms.push(result.value as Uniform);
    }
    output.uniforms = runtimeUniforms;
    return { containsTexture: true, value: output };
  }

  if (Array.isArray(source)) {
    const seen = visited.get(source);
    if (seen) return { containsTexture: true, value: seen };
    const output =
      Array.isArray(target) && target !== source ? target : [...source];
    visited.set(source, output);
    let containsTexture = false;
    for (let index = 0; index < source.length; index += 1) {
      const result = cloneTextureGraph(
        source[index],
        output[index],
        textureClones,
        owned,
        visited,
      );
      if (result.containsTexture) {
        containsTexture = true;
        output[index] = result.value;
      }
    }
    return { containsTexture, value: output };
  }

  if (isPlainRecord(source)) {
    const seen = visited.get(source);
    if (seen) return { containsTexture: true, value: seen };
    const output =
      isPlainRecord(target) && target !== source ? target : { ...source };
    visited.set(source, output);
    let containsTexture = false;
    for (const [key, sourceValue] of Object.entries(source)) {
      const result = cloneTextureGraph(
        sourceValue,
        output[key],
        textureClones,
        owned,
        visited,
      );
      if (result.containsTexture) {
        containsTexture = true;
        output[key] = result.value;
      }
    }
    return { containsTexture, value: output };
  }

  return { containsTexture: false, value: target };
}

function cloneMaterial(
  source: Material,
  materialClones: Map<Material, Material>,
  textureClones: Map<Texture, Texture>,
  owned: OwnedSceneResources,
): Material {
  const existing = materialClones.get(source);
  if (existing) return existing;

  const clone = source.clone();
  materialClones.set(source, clone);
  owned.materials.add(clone);
  const sourceRecord = source as unknown as Record<string, unknown>;
  const cloneRecord = clone as unknown as Record<string, unknown>;
  const visited = new WeakMap<object, unknown>();
  for (const [key, sourceValue] of Object.entries(sourceRecord)) {
    const result = cloneTextureGraph(
      sourceValue,
      cloneRecord[key],
      textureClones,
      owned,
      visited,
    );
    if (result.containsTexture) cloneRecord[key] = result.value;
  }
  return clone;
}

function disposeOwnedResources(owned: OwnedSceneResources): void {
  for (const skeleton of owned.skeletons) {
    if (disposedSkeletons.has(skeleton)) continue;
    disposedSkeletons.add(skeleton);
    skeleton.dispose();
  }
  for (const group of owned.uniformGroups) {
    if (disposedUniformGroups.has(group)) continue;
    disposedUniformGroups.add(group);
    group.dispose();
  }
  for (const texture of owned.textures) {
    if (disposedTextures.has(texture)) continue;
    disposedTextures.add(texture);
    texture.dispose();
    releaseTexturePayload(texture);
  }
  for (const material of owned.materials) {
    if (disposedMaterials.has(material)) continue;
    disposedMaterials.add(material);
    material.dispose();
  }
  for (const geometry of owned.geometries) {
    if (disposedGeometries.has(geometry)) continue;
    disposedGeometries.add(geometry);
    geometry.dispose();
  }
}

function collectNestedResources(
  value: unknown,
  resources: OwnedSceneResources,
  visited: WeakSet<object>,
): void {
  if (value instanceof Texture) {
    retainTexturePayload(value);
    resources.textures.add(value);
    return;
  }
  if (value instanceof Uniform) {
    collectNestedResources(value.value, resources, visited);
    return;
  }
  if (value instanceof UniformsGroup) {
    resources.uniformGroups.add(value);
    for (const uniform of value.uniforms) {
      collectNestedResources(uniform, resources, visited);
    }
    return;
  }
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNestedResources(item, resources, visited);
    }
    return;
  }
  if (!isPlainRecord(value)) return;
  for (const nested of Object.values(value)) {
    collectNestedResources(nested, resources, visited);
  }
}

export function cloneRuntimeScene<T extends Object3D>(source: T): T {
  const runtime = cloneSkeleton(source) as T;
  const owned = createOwnedResources();
  const geometryClones = new Map<BufferGeometry, BufferGeometry>();
  const materialClones = new Map<Material, Material>();
  const textureClones = new Map<Texture, Texture>();
  const skeletonClones = new Map<Skeleton, Skeleton>();

  const pair = (sourceObject: Object3D, runtimeObject: Object3D) => {
    if (sourceObject instanceof Mesh && runtimeObject instanceof Mesh) {
      const sourceGeometry = sourceObject.geometry;
      if (!sourceGeometry) {
        throw new Error("Runtime scene mesh has no geometry");
      }
      let geometry = geometryClones.get(sourceGeometry);
      if (!geometry) {
        const clonedGeometry = sourceGeometry.clone() as BufferGeometry;
        geometryClones.set(sourceGeometry, clonedGeometry);
        owned.geometries.add(clonedGeometry);
        geometry = clonedGeometry;
      }
      runtimeObject.geometry = geometry;
      runtimeObject.material = Array.isArray(sourceObject.material)
        ? sourceObject.material.map((material) =>
            cloneMaterial(material, materialClones, textureClones, owned),
          )
        : cloneMaterial(
            sourceObject.material,
            materialClones,
            textureClones,
            owned,
          );
    }

    if (
      sourceObject instanceof SkinnedMesh &&
      runtimeObject instanceof SkinnedMesh
    ) {
      let skeleton = skeletonClones.get(sourceObject.skeleton);
      if (!skeleton) {
        skeleton = new Skeleton(
          runtimeObject.skeleton.bones,
          sourceObject.skeleton.boneInverses.map((inverse) => inverse.clone()),
        );
        skeletonClones.set(sourceObject.skeleton, skeleton);
        owned.skeletons.add(skeleton);
      }
      runtimeObject.skeleton = skeleton;
    }

    if (sourceObject.children.length !== runtimeObject.children.length) {
      throw new Error("Runtime scene clone changed the authored hierarchy");
    }
    for (let index = 0; index < sourceObject.children.length; index += 1) {
      pair(sourceObject.children[index], runtimeObject.children[index]);
    }
  };

  try {
    pair(source, runtime);
    ownedByRoot.set(runtime, owned);
    return runtime;
  } catch (error) {
    disposeOwnedResources(owned);
    throw error;
  }
}

export function disposeRuntimeScene(runtime: Object3D): void {
  if (disposedRoots.has(runtime)) return;
  disposedRoots.add(runtime);
  const owned = ownedByRoot.get(runtime);
  if (!owned) return;
  ownedByRoot.delete(runtime);
  disposeOwnedResources(owned);
}

export function disposeSceneSource(source: Object3D): void {
  if (disposedRoots.has(source)) return;
  disposedRoots.add(source);
  const resources = createOwnedResources();
  const visited = new WeakSet<object>();
  source.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    resources.geometries.add(object.geometry);
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      resources.materials.add(material);
      for (const value of Object.values(
        material as unknown as Record<string, unknown>,
      )) {
        collectNestedResources(value, resources, visited);
      }
    }
    if (object instanceof SkinnedMesh) resources.skeletons.add(object.skeleton);
  });
  disposeOwnedResources(resources);
}
