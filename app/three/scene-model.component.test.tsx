import ReactThreeTestRenderer from "@react-three/test-renderer";
import { StrictMode } from "react";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { getSceneDefinition } from "./scene-registry";
import { useSceneGltf } from "./scene-loader";
import { SceneModel } from "./scene-model";

vi.mock("./scene-loader", () => ({
  useSceneGltf: vi.fn(),
}));

describe("SceneModel", () => {
  it("survives StrictMode replay and disposes only after final detachment", async () => {
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
          scene={getSceneDefinition("home-hero")}
          rotation={{ yaw: 0, pitch: 0 }}
        />
      </StrictMode>,
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
    expect(attachedDispose).toHaveBeenCalledOnce();
    expect(geometryDispose.mock.calls.length).toBeGreaterThan(
      replayDisposals,
    );
    expect(sourceDispose).not.toHaveBeenCalled();
    geometryDispose.mockRestore();
  });
});
