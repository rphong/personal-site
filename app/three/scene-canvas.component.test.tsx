import ReactThreeTestRenderer from "@react-three/test-renderer";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Group,
  PerspectiveCamera,
  RectAreaLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_RUNTIME_EVENT_NAME } from "./runtime-events";
import { getSceneDefinition } from "./scene-registry";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { SceneCanvasContents, sceneModelIsAttached } from "./scene-canvas";

const lifecycle = vi.hoisted(() => ({
  events: [] as string[],
  throwModel: false,
}));

vi.mock("./scene-model", async () => {
  const React = await import("react");
  return {
    SceneModel: ({ scene }: { readonly scene: { readonly id: string } }) => {
      if (lifecycle.throwModel) throw new Error("model decode failed");
      React.useLayoutEffect(
        () => () => {
          lifecycle.events.push("model-detached");
        },
        [],
      );
      return React.createElement(
        "group",
        { name: `scene-instance:${scene.id}` },
        React.createElement("group", {
          name: `mock-model:${scene.id}`,
        }),
      );
    },
  };
});

function ports(
  overrides: Partial<SceneCanvasPortProps> = {},
): SceneCanvasPortProps {
  return {
    scene: getSceneDefinition("home-hero"),
    rotation: { yaw: 0, pitch: 0 },
    activationVersion: 1,
    renderVersion: 0,
    loadEnabled: true,
    preloadReady: false,
    onFirstFrame: vi.fn(),
    onFailure: vi.fn(),
    onContextLost: vi.fn(),
    onContextRestored: vi.fn(),
    ...overrides,
  };
}

async function renderContents(
  props: SceneCanvasPortProps,
  width = 1280,
  configureRenderer?: (renderer: WebGLRenderer) => void,
) {
  const camera = new PerspectiveCamera();
  const projection = vi.spyOn(camera, "updateProjectionMatrix");
  let canvas!: HTMLCanvasElement;
  let gl!: WebGLRenderer;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneCanvasContents {...props} />,
    {
      width,
      height: 800,
      camera,
      beforeReturn: (created) => {
        canvas = created as HTMLCanvasElement;
      },
      gl: (defaults) => {
        gl = new WebGLRenderer(defaults);
        configureRenderer?.(gl);
        return gl;
      },
    },
  );
  return { renderer, camera, projection, canvas, gl };
}

describe("SceneCanvasContents", () => {
  beforeEach(() => {
    lifecycle.events.length = 0;
    lifecycle.throwModel = false;
  });

  it.each([
    [1280, "desktop"],
    [768, "desktop"],
    [767, "mobile"],
    [390, "mobile"],
  ] as const)("applies the %s px %s registry camera", async (width, mode) => {
    const props = ports();
    const { renderer, camera, projection } = await renderContents(
      props,
      width,
    );
    const frame = props.scene[mode];
    const direction = new Vector3();
    const expectedDirection = new Vector3(...frame.cameraTarget)
      .sub(new Vector3(...frame.cameraPosition))
      .normalize();

    expect(camera.position.toArray()).toEqual([...frame.cameraPosition]);
    expect(camera.fov).toBe(frame.fov);
    expect(camera.getWorldDirection(direction).distanceTo(expectedDirection)).toBeLessThan(
      0.000_001,
    );
    expect(projection).toHaveBeenCalled();
    await renderer.unmount();
  });

  it("renders the aimed source area rig and applies scene exposure", async () => {
    const initial = ports();
    const { renderer, gl } = await renderContents(initial);
    const ambients = renderer.scene.findAll(
      (node) => node.instance.type === "AmbientLight",
    );
    const areas = renderer.scene.findAll(
      (node) => node.instance.type === "RectAreaLight",
    );

    expect(ambients).toHaveLength(1);
    const ambient = ambients[0].instance as AmbientLight;
    expect(`#${ambient.color.getHexString()}`).toBe(
      initial.scene.lighting.ambient.color,
    );
    expect(ambient.intensity).toBe(initial.scene.lighting.ambient.intensity);

    expect(areas).toHaveLength(1);
    const light = areas[0].instance as RectAreaLight;
    const definition = initial.scene.lighting.key;
    expect(`#${light.color.getHexString()}`).toBe(definition.color);
    expect(light.intensity).toBe(definition.intensity);
    expect(light.position.toArray()).toEqual([...definition.position]);
    expect(light.width).toBe(definition.width);
    expect(light.height).toBe(definition.height);
    expect(light.castShadow).toBe(false);
    const expectedDirection = new Vector3(...definition.target)
      .sub(new Vector3(...definition.position))
      .normalize();
    const emissionDirection = light.getWorldDirection(new Vector3()).negate();
    expect(emissionDirection.distanceTo(expectedDirection)).toBeLessThan(
      0.000_001,
    );
    expect(gl.outputColorSpace).toBe(SRGBColorSpace);
    expect(gl.toneMapping).toBe(ACESFilmicToneMapping);
    expect(gl.toneMappingExposure).toBe(initial.scene.lighting.exposure);

    const rocket = getSceneDefinition("nasa-rocket");
    await renderer.update(
      <SceneCanvasContents
        {...initial}
        scene={rocket}
        activationVersion={2}
      />,
    );
    expect(gl.toneMappingExposure).toBe(rocket.lighting.exposure);
    await renderer.unmount();
  });

  it("detaches the model when a resident canvas releases loading", async () => {
    const initial = ports();
    const { renderer, gl } = await renderContents(initial);
    expect(
      renderer.scene.findAllByProps({ name: "mock-model:home-hero" }),
    ).toHaveLength(1);
    expect(
      renderer.scene.findAllByProps({ name: "contact-blob-shadow" }),
    ).toHaveLength(1);
    lifecycle.events.length = 0;

    await renderer.update(
      <SceneCanvasContents
        {...initial}
        loadEnabled={false}
        preloadReady={false}
      />,
    );

    expect(
      renderer.scene.findAllByProps({ name: "mock-model:home-hero" }),
    ).toHaveLength(0);
    expect(
      renderer.scene.findAllByProps({ name: "contact-blob-shadow" }),
    ).toHaveLength(0);
    expect(lifecycle.events).toEqual(["model-detached"]);

    const render = vi.spyOn(gl, "render");
    await renderer.update(
      <SceneCanvasContents
        {...initial}
        scene={getSceneDefinition("eog-poster")}
        activationVersion={2}
        loadEnabled
      />,
    );
    await renderer.advanceFrames(1, 1 / 60);
    expect(
      renderer.scene.findAll(
        (node) => node.instance.name.startsWith("mock-model:"),
      ),
    ).toHaveLength(0);
    expect(render).not.toHaveBeenCalled();
    await renderer.unmount();
  });

  it("does not consider an empty scene instance ready to present", () => {
    const scene = new Scene();
    const instance = new Group();
    instance.name = "scene-instance:home-hero";
    scene.add(instance);

    expect(sceneModelIsAttached(scene, "home-hero")).toBe(false);
    instance.add(new Group());
    expect(sceneModelIsAttached(scene, "home-hero")).toBe(true);
  });

  it("reports the first attached-model frame during layout and render failure once", async () => {
    const onFirstFrame = vi.fn();
    const onFailure = vi.fn();
    const initial = ports({ onFirstFrame, onFailure });
    const { renderer, gl } = await renderContents(initial);

    expect(
      renderer.scene.findAllByProps({ name: "mock-model:home-hero" }),
    ).toHaveLength(1);
    expect(gl.info.render.frame).toBeGreaterThan(0);
    expect(onFirstFrame).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();

    const render = vi.spyOn(gl, "render");
    await renderer.advanceFrames(3, 1 / 60);
    expect(render).toHaveBeenCalledTimes(3);
    expect(onFirstFrame).toHaveBeenCalledOnce();

    await renderer.update(
      <SceneCanvasContents {...initial} renderVersion={1} />,
    );
    await renderer.advanceFrames(1, 1 / 60);
    expect(render).toHaveBeenCalledTimes(5);
    expect(onFirstFrame).toHaveBeenCalledTimes(2);
    await renderer.unmount();

    const failedFirstFrame = vi.fn();
    const failed = vi.fn();
    let failedRender!: ReturnType<typeof vi.spyOn>;
    const failedTree = await renderContents(
      ports({ onFirstFrame: failedFirstFrame, onFailure: failed }),
      1280,
      (gl) => {
        failedRender = vi.spyOn(gl, "render").mockImplementation(() => {
          throw new Error("GPU render failed");
        });
      },
    );
    await failedTree.renderer.advanceFrames(3, 1 / 60);
    expect(failedRender).toHaveBeenCalledOnce();
    expect(failedFirstFrame).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledWith("unknown");
    await failedTree.renderer.unmount();
  });

  it("requires a frame increment and a still-live context after render", async () => {
    const noFrameReady = vi.fn();
    const noFrame = await renderContents(
      ports({ onFirstFrame: noFrameReady }),
      1280,
      (gl) => {
        vi.spyOn(gl, "render").mockImplementation(() => undefined);
      },
    );
    await noFrame.renderer.advanceFrames(1, 1 / 60);
    expect(noFrameReady).not.toHaveBeenCalled();
    await noFrame.renderer.unmount();

    const lostDuringRenderReady = vi.fn();
    const lostDuringRender = await renderContents(
      ports({ onFirstFrame: lostDuringRenderReady }),
      1280,
      (gl) => {
        vi.spyOn(gl.getContext(), "isContextLost")
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true)
          .mockReturnValue(false);
      },
    );
    expect(lostDuringRender.gl.info.render.frame).toBeGreaterThan(0);
    expect(lostDuringRenderReady).not.toHaveBeenCalled();
    await lostDuringRender.renderer.unmount();
  });

  it("keeps readiness blocked while context is lost and cleans up listeners", async () => {
    const originalLost = vi.fn();
    const originalRestored = vi.fn();
    const initial = ports({
      onFirstFrame: vi.fn(),
      onContextLost: originalLost,
      onContextRestored: originalRestored,
    });
    const { renderer, canvas } = await renderContents(
      initial,
    );
    const onFirstFrame = vi.mocked(initial.onFirstFrame);
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();
    const add = vi.spyOn(canvas, "addEventListener");
    const remove = vi.spyOn(canvas, "removeEventListener");

    await renderer.update(
      <SceneCanvasContents
        {...initial}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
      />,
    );
    expect(add).not.toHaveBeenCalled();
    onFirstFrame.mockClear();
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);

    expect(lost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledOnce();
    expect(originalLost).not.toHaveBeenCalled();
    await renderer.advanceFrames(1, 1 / 60);
    expect(onFirstFrame).not.toHaveBeenCalled();

    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(onContextRestored).toHaveBeenCalledOnce();
    expect(originalRestored).not.toHaveBeenCalled();
    await renderer.update(
      <SceneCanvasContents
        {...initial}
        renderVersion={1}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
      />,
    );
    expect(onFirstFrame).toHaveBeenCalledOnce();

    await renderer.unmount();
    expect(remove).toHaveBeenCalledWith(
      "webglcontextlost",
      expect.any(Function),
    );
    expect(remove).toHaveBeenCalledWith(
      "webglcontextrestored",
      expect.any(Function),
    );
  });

  it("keeps context monitoring alive after the model boundary fails", async () => {
    lifecycle.throwModel = true;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const onFailure = vi.fn();
    const onContextLost = vi.fn();
    const { renderer, canvas } = await renderContents(
      ports({ onFailure, onContextLost }),
    );

    expect(onFailure).toHaveBeenCalledWith("decode");
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledOnce();

    await renderer.unmount();
    consoleError.mockRestore();
  });

  it("emits one finite health sample after twelve deliberate frames", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => {
      now += 16;
      return now;
    });
    const listener = vi.fn();
    window.addEventListener(SCENE_RUNTIME_EVENT_NAME, listener);
    const { renderer, gl } = await renderContents(ports());
    const render = vi.spyOn(gl, "render");

    await renderer.advanceFrames(12, 1 / 60);
    expect(render).toHaveBeenCalledTimes(12);
    const healthEvents = listener.mock.calls
      .map(([event]) => (event as CustomEvent).detail)
      .filter((detail) => detail.status === "rotation-health");
    expect(healthEvents).toHaveLength(1);
    expect(healthEvents[0]).toMatchObject({
      status: "rotation-health",
      sceneId: "home-hero",
    });
    expect(Number.isFinite(healthEvents[0].fps)).toBe(true);

    await renderer.unmount();
    window.removeEventListener(SCENE_RUNTIME_EVENT_NAME, listener);
  });
});
