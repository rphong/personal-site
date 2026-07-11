import {
  Bone,
  BoxGeometry,
  DataTexture,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uniform,
  UniformsGroup,
  WebGLRenderTarget,
} from "three";
import { describe, expect, it, vi } from "vitest";
import {
  cloneRuntimeScene,
  disposeRuntimeScene,
  disposeSceneSource,
} from "./scene-resources";

describe("runtime scene resources", () => {
  it("clones and disposes instance-owned geometry, material, and textures", () => {
    const texture = new DataTexture(
      new Uint8Array([255, 255, 255, 255]),
      1,
      1,
    );
    const sourceGeometry = new BoxGeometry();
    const sourceMaterial = new MeshStandardMaterial({ map: texture });
    const source = new Group();
    source.add(new Mesh(sourceGeometry, sourceMaterial));

    const runtime = cloneRuntimeScene(source);
    const runtimeMesh = runtime.children[0] as Mesh<
      BoxGeometry,
      MeshStandardMaterial
    >;
    expect(runtimeMesh.geometry).not.toBe(sourceGeometry);
    expect(runtimeMesh.material).not.toBe(sourceMaterial);
    expect(runtimeMesh.material.map).not.toBe(texture);

    const geometryDispose = vi.spyOn(runtimeMesh.geometry, "dispose");
    const materialDispose = vi.spyOn(runtimeMesh.material, "dispose");
    const textureDispose = vi.spyOn(runtimeMesh.material.map!, "dispose");
    const sourceDispose = vi.spyOn(sourceGeometry, "dispose");

    disposeRuntimeScene(runtime);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
  });

  it("preserves shared geometry, material, and cross-slot texture aliases", () => {
    const texture = new DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1);
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
    });
    const source = new Group();
    source.add(new Mesh(geometry, material), new Mesh(geometry, material));

    const runtime = cloneRuntimeScene(source);
    const [first, second] = runtime.children as Mesh<
      BoxGeometry,
      MeshStandardMaterial
    >[];
    expect(first.geometry).toBe(second.geometry);
    expect(first.geometry).not.toBe(geometry);
    expect(first.material).toBe(second.material);
    expect(first.material).not.toBe(material);
    expect(first.material.map).toBe(first.material.emissiveMap);
    expect(first.material.map).not.toBe(texture);

    const geometryDispose = vi.spyOn(first.geometry, "dispose");
    const materialDispose = vi.spyOn(first.material, "dispose");
    const textureDispose = vi.spyOn(first.material.map!, "dispose");
    disposeRuntimeScene(runtime);
    disposeRuntimeScene(runtime);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it("clones repeated shader-uniform textures once and disposes them once", () => {
    const texture = new DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1);
    const material = new ShaderMaterial({
      uniforms: {
        primary: { value: texture },
        aliases: { value: [texture, texture] },
      },
    });
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(), material));

    const runtime = cloneRuntimeScene(source);
    const runtimeMaterial = (runtime.children[0] as Mesh).material as ShaderMaterial;
    const primary = runtimeMaterial.uniforms.primary.value as DataTexture;
    const aliases = runtimeMaterial.uniforms.aliases.value as DataTexture[];
    expect(primary).not.toBe(texture);
    expect(aliases).toEqual([primary, primary]);

    const dispose = vi.spyOn(primary, "dispose");
    disposeRuntimeScene(runtime);
    disposeRuntimeScene(runtime);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("owns class-based uniforms and uniform groups without losing aliases", () => {
    const texture = new DataTexture(new Uint8Array([2, 2, 2, 2]), 1, 1);
    const secondTexture = new DataTexture(
      new Uint8Array([3, 3, 3, 3]),
      1,
      1,
    );
    const thirdTexture = new DataTexture(
      new Uint8Array([4, 4, 4, 4]),
      1,
      1,
    );
    const classValues = [texture, texture];
    const nestedValue = { map: texture };
    const group = new UniformsGroup();
    group.add([new Uniform(texture), new Uniform(secondTexture)]);
    group.add(new Uniform(thirdTexture));
    const material = new ShaderMaterial({
      uniforms: {
        classUniform: new Uniform(classValues),
        nestedUniform: { value: nestedValue },
      },
    });
    (material as ShaderMaterial & { uniformsGroups: UniformsGroup[] })
      .uniformsGroups = [group];
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(), material));

    const runtime = cloneRuntimeScene(source);
    const runtimeMaterial = (runtime.children[0] as Mesh).material as
      ShaderMaterial & { uniformsGroups: UniformsGroup[] };
    const runtimeClassValues = (
      runtimeMaterial.uniforms.classUniform as Uniform<Texture[]>
    ).value;
    const runtimeNestedValue = runtimeMaterial.uniforms.nestedUniform
      .value as { map: Texture };
    const runtimeGroup = runtimeMaterial.uniformsGroups[0];
    const groupUniforms = runtimeGroup.uniforms as Uniform<Texture>[];
    expect(runtimeClassValues).not.toBe(classValues);
    expect(runtimeClassValues[0]).not.toBe(texture);
    expect(runtimeClassValues).toEqual([
      runtimeClassValues[0],
      runtimeClassValues[0],
    ]);
    expect(runtimeNestedValue).not.toBe(nestedValue);
    expect(runtimeNestedValue.map).toBe(runtimeClassValues[0]);
    expect(runtimeGroup.uniforms).toHaveLength(3);
    expect(groupUniforms[0].value).toBe(runtimeClassValues[0]);
    expect(groupUniforms[1].value).not.toBe(secondTexture);
    expect(groupUniforms[2].value).not.toBe(thirdTexture);
    expect(classValues).toEqual([texture, texture]);
    expect(nestedValue.map).toBe(texture);
    expect(group.uniforms).toHaveLength(2);
    expect(Array.isArray(group.uniforms[0])).toBe(true);
    const textureDispose = vi.spyOn(runtimeClassValues[0], "dispose");
    const secondDispose = vi.spyOn(groupUniforms[1].value, "dispose");
    const thirdDispose = vi.spyOn(groupUniforms[2].value, "dispose");
    const groupDispose = vi.spyOn(
      runtimeGroup,
      "dispose",
    );
    disposeRuntimeScene(runtime);
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(thirdDispose).toHaveBeenCalledOnce();
    expect(groupDispose).toHaveBeenCalledOnce();
    expect(classValues).toEqual([texture, texture]);
    expect(nestedValue.map).toBe(texture);
  });

  it("preserves repeated entries in a multi-material mesh", () => {
    const material = new MeshStandardMaterial();
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(), [material, material]));

    const runtime = cloneRuntimeScene(source);
    const runtimeMaterials = (runtime.children[0] as Mesh).material as Material[];
    expect(runtimeMaterials).toHaveLength(2);
    expect(runtimeMaterials[0]).toBe(runtimeMaterials[1]);
    expect(runtimeMaterials[0]).not.toBe(material);
    const dispose = vi.spyOn(runtimeMaterials[0], "dispose");
    disposeRuntimeScene(runtime);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("rebuilds skinned ownership and leaves cached skeleton resources untouched", () => {
    const bone = new Bone();
    bone.name = "root-bone";
    const skeleton = new Skeleton([bone], [new Matrix4().makeTranslation(1, 2, 3)]);
    const skinned = new SkinnedMesh(
      new BoxGeometry(),
      new MeshStandardMaterial(),
    );
    skinned.add(bone);
    skinned.bind(skeleton);
    const source = new Group();
    source.add(skinned);

    const runtime = cloneRuntimeScene(source);
    const runtimeSkinned = runtime.children[0] as SkinnedMesh;
    expect(runtimeSkinned.skeleton).not.toBe(skeleton);
    expect(runtimeSkinned.skeleton.bones[0]).not.toBe(bone);
    expect(runtimeSkinned.skeleton.boneInverses).not.toBe(
      skeleton.boneInverses,
    );
    expect(runtimeSkinned.skeleton.boneInverses[0]).not.toBe(
      skeleton.boneInverses[0],
    );

    runtimeSkinned.skeleton.boneTexture = new DataTexture(
      new Float32Array(16),
      4,
      1,
    );
    const runtimeSkeletonDispose = vi.spyOn(
      runtimeSkinned.skeleton,
      "dispose",
    );
    const sourceSkeletonDispose = vi.spyOn(skeleton, "dispose");
    disposeRuntimeScene(runtime);
    disposeRuntimeScene(runtime);
    expect(runtimeSkeletonDispose).toHaveBeenCalledOnce();
    expect(sourceSkeletonDispose).not.toHaveBeenCalled();
  });

  it("rejects render-target textures outside the shipped glTF material contract", () => {
    const target = new WebGLRenderTarget(1, 1);
    const source = new Group();
    source.add(
      new Mesh(
        new BoxGeometry(),
        new ShaderMaterial({
          uniforms: { target: new Uniform(target.texture) },
        }),
      ),
    );

    expect(() => cloneRuntimeScene(source)).toThrow(/render-target texture/i);
    target.dispose();
  });

  it("disposes an evicted cached source graph exactly once", () => {
    const texture = new DataTexture(new Uint8Array([1, 1, 1, 1]), 1, 1);
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial({ map: texture });
    const source = new Group();
    source.add(new Mesh(geometry, material), new Mesh(geometry, material));
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    disposeSceneSource(source);
    disposeSceneSource(source);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it("keeps a runtime clone valid after its cached source is evicted", () => {
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const runtime = cloneRuntimeScene(source);
    const runtimeMesh = runtime.children[0] as Mesh;
    const runtimeGeometryDispose = vi.spyOn(runtimeMesh.geometry, "dispose");
    const runtimeMaterial = runtimeMesh.material as Material;
    const runtimeMaterialDispose = vi.spyOn(runtimeMaterial, "dispose");

    disposeSceneSource(source);
    expect(runtimeGeometryDispose).not.toHaveBeenCalled();
    expect(runtimeMaterialDispose).not.toHaveBeenCalled();

    disposeRuntimeScene(runtime);
    expect(runtimeGeometryDispose).toHaveBeenCalledOnce();
    expect(runtimeMaterialDispose).toHaveBeenCalledOnce();
  });

  it("closes a shared ImageBitmap-like payload only after its last texture owner", () => {
    const payload = { close: vi.fn() };
    const texture = new Texture(payload as unknown as TexImageSource);
    const source = new Group();
    source.add(
      new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: texture })),
    );
    const runtime = cloneRuntimeScene(source);

    disposeSceneSource(source);
    expect(payload.close).not.toHaveBeenCalled();
    disposeRuntimeScene(runtime);
    expect(payload.close).toHaveBeenCalledOnce();
  });
});
