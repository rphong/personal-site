import ReactThreeTestRenderer from "@react-three/test-renderer";
import { StrictMode } from "react";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { getSceneDefinition } from "./scene-registry";
import { useSceneGltf } from "./scene-loader";
import {
  clearPreparedSceneModel,
  clearPreparedSceneModels,
  SceneModel,
} from "./scene-model";

vi.mock("./scene-loader", () => ({
  useSceneGltf: vi.fn(),
}));

describe("SceneModel", () => {
  it("survives StrictMode replay and retains the prepared clone until cache release", async () => {
    clearPreparedSceneModels();
    const sourceGeometry = new BoxGeometry();
    const source = new Group();
    source.name = "cached-source";
    source.add(new Mesh(sourceGeometry, new MeshStandardMaterial()));
    vi.mocked(useSceneGltf).mockReturnValue({ scene: source } as never);
    const sourceDispose = vi.spyOn(sourceGeometry, "dispose");
    const geometryDispose = vi.spyOn(BoxGeometry.prototype, "dispose");

    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <SceneModel
          attemptKey="home-hero:1:0"
          scene={getSceneDefinition("home-hero")}
          rotation={{ yaw: 0, pitch: 0 }}
        />
      </StrictMode>,
    );
    expect(useSceneGltf).toHaveBeenCalledWith(
      "/models/crane.glb",
      "home-hero:1:0",
    );
    await Promise.resolve();
    const root = renderer.scene.findByProps({
      name: "scene-root:home-hero",
    }).instance as Group;
    const attachedSource = root.getObjectByName("cached-source") as Group;
    expect(attachedSource).toBeTruthy();
    const attachedGeometry = (attachedSource.children[0] as Mesh).geometry;
    const attachedDispose = vi.spyOn(attachedGeometry, "dispose");
    const replayDisposals = geometryDispose.mock.calls.length;
    expect(attachedDispose).not.toHaveBeenCalled();
    expect(sourceDispose).not.toHaveBeenCalled();

    await renderer.unmount();
    await Promise.resolve();
    expect(attachedDispose).not.toHaveBeenCalled();
    expect(geometryDispose.mock.calls.length).toBe(replayDisposals);

    const secondRenderer = await ReactThreeTestRenderer.create(
      <SceneModel
        attemptKey="home-hero:2:0"
        scene={getSceneDefinition("home-hero")}
        rotation={{ yaw: 0, pitch: 0 }}
      />,
    );
    const secondRoot = secondRenderer.scene.findByProps({
      name: "scene-root:home-hero",
    }).instance as Group;
    const secondSource = secondRoot.getObjectByName("cached-source") as Group;
    expect((secondSource.children[0] as Mesh).geometry).toBe(attachedGeometry);
    await secondRenderer.unmount();

    clearPreparedSceneModel("home-hero");
    expect(attachedDispose).toHaveBeenCalledOnce();
    expect(geometryDispose.mock.calls.length).toBeGreaterThan(replayDisposals);
    expect(sourceDispose).not.toHaveBeenCalled();
    geometryDispose.mockRestore();
  });

  it("keeps simultaneous residents attached to distinct runtime roots", async () => {
    clearPreparedSceneModels();
    const source = new Group();
    source.name = "cached-source";
    source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    vi.mocked(useSceneGltf).mockReturnValue({ scene: source } as never);
    const scene = getSceneDefinition("home-hero");

    const renderer = await ReactThreeTestRenderer.create(
      <>
        <SceneModel
          attemptKey="home-hero:resident-one"
          scene={scene}
          rotation={scene.rotation.default}
        />
        <SceneModel
          attemptKey="home-hero:resident-two"
          scene={scene}
          rotation={scene.rotation.default}
        />
      </>,
    );
    await Promise.resolve();

    const residentInstances = renderer.scene.findAllByProps({
      name: "scene-instance:home-hero",
    });
    expect(residentInstances).toHaveLength(2);
    const [firstParent, secondParent] = residentInstances.map(
      (resident) => resident.instance as Group,
    );
    const firstRuntimeScene = firstParent.children[0] as Group;
    const secondRuntimeScene = secondParent.children[0] as Group;

    expect(firstRuntimeScene).toBeDefined();
    expect(secondRuntimeScene).toBeDefined();
    expect(firstRuntimeScene).not.toBe(secondRuntimeScene);
    expect(firstRuntimeScene.parent).toBe(firstParent);
    expect(secondRuntimeScene.parent).toBe(secondParent);
    expect(firstRuntimeScene.children).not.toHaveLength(0);
    expect(secondRuntimeScene.children).not.toHaveLength(0);

    await renderer.unmount();
    clearPreparedSceneModels();
  });
});
