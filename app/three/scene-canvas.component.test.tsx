import ReactThreeTestRenderer from "@react-three/test-renderer";
import { PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_RUNTIME_EVENT_NAME } from "./runtime-events";
import { getSceneDefinition } from "./scene-registry";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { SceneCanvasContents } from "./scene-canvas";

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
      return React.createElement("group", {
        name: `mock-model:${scene.id}`,
      });
    },
  };
});

vi.mock("./adjacent-scene-preloader", async () => {
  const React = await import("react");
  return {
    AdjacentScenePreloader: ({ enabled }: { readonly enabled: boolean }) => {
      React.useEffect(() => {
        if (!enabled) lifecycle.events.push("cache-cleared");
      }, [enabled]);
      return null;
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

  it("detaches the model before the same-root preloader clears ownership", async () => {
    const initial = ports();
    const { renderer, gl } = await renderContents(initial);
    expect(
      renderer.scene.findAllByProps({ name: "mock-model:home-hero" }),
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
    expect(lifecycle.events).toEqual(["model-detached", "cache-cleared"]);

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

  it("reports first frame after a real render and reports render failure once", async () => {
    const onFirstFrame = vi.fn();
    const onFailure = vi.fn();
    const initial = ports({ onFirstFrame, onFailure });
    const { renderer, gl } = await renderContents(initial);
    const render = vi.spyOn(gl, "render");

    await renderer.advanceFrames(3, 1 / 60);
    expect(render).toHaveBeenCalledTimes(3);
    expect(onFirstFrame).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();

    await renderer.update(
      <SceneCanvasContents {...initial} renderVersion={1} />,
    );
    await renderer.advanceFrames(1, 1 / 60);
    expect(render).toHaveBeenCalledTimes(4);
    expect(onFirstFrame).toHaveBeenCalledTimes(2);
    await renderer.unmount();

    const failedFirstFrame = vi.fn();
    const failed = vi.fn();
    const failedTree = await renderContents(
      ports({ onFirstFrame: failedFirstFrame, onFailure: failed }),
    );
    const failedRender = vi
      .spyOn(failedTree.gl, "render")
      .mockImplementation(() => {
        throw new Error("GPU render failed");
      });
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
    );
    vi.spyOn(noFrame.gl, "render").mockImplementation(() => undefined);
    await noFrame.renderer.advanceFrames(1, 1 / 60);
    expect(noFrameReady).not.toHaveBeenCalled();
    await noFrame.renderer.unmount();

    const lostDuringRenderReady = vi.fn();
    const lostDuringRender = await renderContents(
      ports({ onFirstFrame: lostDuringRenderReady }),
    );
    vi.spyOn(lostDuringRender.gl.getContext(), "isContextLost")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    await lostDuringRender.renderer.advanceFrames(1, 1 / 60);
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
    const onFirstFrame = initial.onFirstFrame;
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
    await renderer.advanceFrames(1, 1 / 60);
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
