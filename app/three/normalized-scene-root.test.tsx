import ReactThreeTestRenderer from "@react-three/test-renderer";
import { readFile } from "node:fs/promises";
import { StrictMode } from "react";
import { Group, MathUtils } from "three";
import { describe, expect, it, vi } from "vitest";
import { NormalizedSceneRoot } from "./normalized-scene-root";

describe("NormalizedSceneRoot", () => {
  it("pins matching Three declarations for isolated installs", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));
    expect(packageJson.devDependencies["@types/three"]).toBe("0.185.1");
    expect(packageLock.packages[""].devDependencies["@types/three"]).toBe(
      "0.185.1",
    );
    expect(packageLock.packages["node_modules/@types/three"].version).toBe(
      "0.185.1",
    );
  });

  it("applies bounded degrees to the complete root and invalidates each change", async () => {
    const invalidate = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <NormalizedSceneRoot
          sceneId="home-hero"
          rotation={{ yaw: 10, pitch: -4 }}
          invalidate={invalidate}
        >
          <mesh name="authored-diorama" />
        </NormalizedSceneRoot>
      </StrictMode>,
    );

    const root = renderer.scene.findByProps({
      name: "scene-root:home-hero",
    }).instance as Group;
    expect(root.rotation.y).toBeCloseTo(MathUtils.degToRad(10));
    expect(root.rotation.x).toBeCloseTo(MathUtils.degToRad(-4));
    expect(root.rotation.order).toBe("YXZ");
    const authored = renderer.scene.findByProps({ name: "authored-diorama" });
    expect(authored.instance.rotation.x).toBe(0);
    expect(authored.instance.rotation.y).toBe(0);
    const mountInvalidations = invalidate.mock.calls.length;
    expect(mountInvalidations).toBeGreaterThanOrEqual(1);

    await renderer.update(
      <StrictMode>
        <NormalizedSceneRoot
          sceneId="home-hero"
          rotation={{ yaw: -25, pitch: 8 }}
          invalidate={invalidate}
        >
          <mesh name="authored-diorama" />
        </NormalizedSceneRoot>
      </StrictMode>,
    );

    expect(root.rotation.y).toBeCloseTo(MathUtils.degToRad(-25));
    expect(root.rotation.x).toBeCloseTo(MathUtils.degToRad(8));
    const changedPoseInvalidations = invalidate.mock.calls.length;
    expect(changedPoseInvalidations).toBeGreaterThan(mountInvalidations);

    await renderer.update(
      <StrictMode>
        <NormalizedSceneRoot
          sceneId="home-hero"
          rotation={{ yaw: -25, pitch: 8 }}
          invalidate={invalidate}
        >
          <mesh name="authored-diorama" />
        </NormalizedSceneRoot>
      </StrictMode>,
    );
    expect(invalidate).toHaveBeenCalledTimes(changedPoseInvalidations);

    await renderer.update(
      <StrictMode>
        <NormalizedSceneRoot
          sceneId="experience-hero"
          rotation={{ yaw: -25, pitch: 8 }}
          invalidate={invalidate}
        >
          <mesh name="authored-diorama" />
        </NormalizedSceneRoot>
      </StrictMode>,
    );
    const destinationRoot = renderer.scene.findByProps({
      name: "scene-root:experience-hero",
    }).instance as Group;
    expect(destinationRoot.rotation.y).toBeCloseTo(
      MathUtils.degToRad(-25),
    );
    expect(destinationRoot.rotation.x).toBeCloseTo(MathUtils.degToRad(8));
    expect(
      renderer.scene.findAllByProps({ name: "scene-root:home-hero" }),
    ).toHaveLength(0);
    expect(
      renderer.scene.findAllByProps({ name: "scene-root:experience-hero" }),
    ).toHaveLength(1);
    expect(invalidate.mock.calls.length).toBeGreaterThan(
      changedPoseInvalidations,
    );

    const observedPose: number[][] = [];
    const replacementInvalidate = vi.fn(() => {
      const activeRoot = renderer.scene.findByProps({
        name: "scene-root:experience-hero",
      }).instance as Group;
      observedPose.push([
        activeRoot.rotation.x,
        activeRoot.rotation.y,
        activeRoot.rotation.z,
      ]);
    });
    await renderer.update(
      <StrictMode>
        <NormalizedSceneRoot
          sceneId="experience-hero"
          rotation={{ yaw: 5, pitch: -3 }}
          invalidate={replacementInvalidate}
        >
          <mesh name="authored-diorama" />
        </NormalizedSceneRoot>
      </StrictMode>,
    );
    expect(replacementInvalidate).toHaveBeenCalled();
    expect(observedPose.at(-1)).toEqual([
      MathUtils.degToRad(-3),
      MathUtils.degToRad(5),
      0,
    ]);
    await renderer.unmount();
  });

  it("clamps finite overflow and resets non-finite pose input", async () => {
    const invalidate = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <NormalizedSceneRoot
        sceneId="home-hero"
        rotation={{ yaw: 100, pitch: -100 }}
        invalidate={invalidate}
      >
        <mesh />
      </NormalizedSceneRoot>,
    );
    const root = renderer.scene.findByProps({
      name: "scene-root:home-hero",
    }).instance as Group;
    expect(root.rotation.y).toBeCloseTo(MathUtils.degToRad(25));
    expect(root.rotation.x).toBeCloseTo(MathUtils.degToRad(-8));
    expect(root.rotation.z).toBe(0);
    const boundedInvalidations = invalidate.mock.calls.length;

    await renderer.update(
      <NormalizedSceneRoot
        sceneId="home-hero"
        rotation={{ yaw: 200, pitch: -200 }}
        invalidate={invalidate}
      >
        <mesh />
      </NormalizedSceneRoot>,
    );
    expect(invalidate).toHaveBeenCalledTimes(boundedInvalidations);

    await renderer.update(
      <NormalizedSceneRoot
        sceneId="home-hero"
        rotation={{ yaw: Number.NaN, pitch: 4 }}
        invalidate={invalidate}
      >
        <mesh />
      </NormalizedSceneRoot>,
    );
    expect(root.rotation.y).toBe(0);
    expect(root.rotation.x).toBeCloseTo(MathUtils.degToRad(4));
    const mixedInvalidations = invalidate.mock.calls.length;
    expect(mixedInvalidations).toBeGreaterThan(boundedInvalidations);

    await renderer.update(
      <NormalizedSceneRoot
        sceneId="home-hero"
        rotation={{ yaw: Number.NaN, pitch: Number.POSITIVE_INFINITY }}
        invalidate={invalidate}
      >
        <mesh />
      </NormalizedSceneRoot>,
    );
    expect(root.rotation.y).toBe(0);
    expect(root.rotation.x).toBe(0);
    expect(root.rotation.z).toBe(0);
    expect(invalidate.mock.calls.length).toBeGreaterThan(mixedInvalidations);
    await renderer.unmount();
  });

  it("detaches the old model and poses one destination root on a keyed swap", async () => {
    const invalidate = vi.fn();
    const homeModel = new Group();
    homeModel.name = "home-model";
    const projectsModel = new Group();
    projectsModel.name = "projects-model";
    const renderer = await ReactThreeTestRenderer.create(
      <NormalizedSceneRoot
        key="home"
        sceneId="home-hero"
        rotation={{ yaw: 0, pitch: 0 }}
        invalidate={invalidate}
      >
        <primitive object={homeModel} />
      </NormalizedSceneRoot>,
    );
    const homeRoot = renderer.scene.findByProps({
      name: "scene-root:home-hero",
    }).instance as Group;
    expect(homeModel.parent).toBe(homeRoot);

    await renderer.update(
      <NormalizedSceneRoot
        key="projects"
        sceneId="projects-hero"
        rotation={{ yaw: 12, pitch: -2 }}
        invalidate={invalidate}
      >
        <primitive object={projectsModel} />
      </NormalizedSceneRoot>,
    );
    const projectsRoot = renderer.scene.findByProps({
      name: "scene-root:projects-hero",
    }).instance as Group;
    expect(projectsRoot).not.toBe(homeRoot);
    expect(homeRoot.parent).toBeNull();
    expect(homeModel.parent).toBeNull();
    expect(projectsModel.parent).toBe(projectsRoot);
    expect(projectsRoot.rotation.y).toBeCloseTo(MathUtils.degToRad(12));
    expect(projectsRoot.rotation.x).toBeCloseTo(MathUtils.degToRad(-2));
    expect(
      renderer.scene.findAllByProps({ name: "scene-root:projects-hero" }),
    ).toHaveLength(1);

    await renderer.unmount();
    expect(projectsModel.parent).toBeNull();
  });
});
