import { act, render } from "@testing-library/react";
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  type WebGLRenderer,
} from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSceneDefinition } from "./scene-registry";
import {
  createWebGL2Renderer,
  createWebGL2RendererFactory,
  SceneCanvas,
} from "./scene-canvas";

const canvasCalls = vi.hoisted(() => vi.fn());

vi.mock("@react-three/fiber", () => ({
  Canvas: (props: unknown) => {
    canvasCalls(props);
    return null;
  },
  useFrame: vi.fn(),
  useThree: vi.fn(),
}));

describe("SceneCanvas shell", () => {
  beforeEach(() => canvasCalls.mockClear());

  it("passes the bounded transparent demand contract to exactly one Canvas", () => {
    const scene = getSceneDefinition("home-hero");
    render(
      <SceneCanvas
        scene={scene}
        rotation={{ yaw: 0, pitch: 0 }}
        activationVersion={4}
        renderVersion={2}
        loadEnabled
        preloadReady={false}
        onFirstFrame={vi.fn()}
        onFailure={vi.fn()}
        onContextLost={vi.fn()}
        onContextRestored={vi.fn()}
      />,
    );

    expect(canvasCalls).toHaveBeenCalledOnce();
    expect(canvasCalls.mock.calls[0][0]).toMatchObject({
      "aria-hidden": "true",
      frameloop: "demand",
      dpr: [1, 1.5],
      shadows: false,
      camera: {
        position: [...scene.desktop.cameraPosition],
        fov: scene.desktop.fov,
      },
    });
    expect(canvasCalls.mock.calls[0][0].gl).toBeTypeOf("function");
  });

  it.each([
    [1280, "desktop"],
    [390, "mobile"],
  ] as const)(
    "applies the complete %s px %s camera frame before the Canvas can render",
    (width, mode) => {
      const scene = getSceneDefinition("home-hero");
      render(
        <SceneCanvas
          scene={scene}
          rotation={{ yaw: 0, pitch: 0 }}
          activationVersion={1}
          renderVersion={0}
          loadEnabled
          preloadReady={false}
          onFirstFrame={vi.fn()}
          onFailure={vi.fn()}
          onContextLost={vi.fn()}
          onContextRestored={vi.fn()}
        />,
      );
      const camera = new PerspectiveCamera();
      const frame = scene[mode];
      const expectedDirection = new Vector3(...frame.cameraTarget)
        .sub(new Vector3(...frame.cameraPosition))
        .normalize();

      canvasCalls.mock.calls[0][0].onCreated({
        camera,
        size: { width },
      });

      expect(camera.position.toArray()).toEqual([...frame.cameraPosition]);
      expect(camera.fov).toBe(frame.fov);
      expect(
        camera
          .getWorldDirection(new Vector3())
          .distanceTo(expectedDirection),
      ).toBeLessThan(0.000_001);
    },
  );

  it("creates WebGL2 once and turns construction failure into one inert fallback", async () => {
    const defaults = {
      canvas: document.createElement("canvas"),
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    } as Parameters<
      ReturnType<typeof createWebGL2RendererFactory>
    >[0];
    const renderer = { isWebGLRenderer: true } as unknown as WebGLRenderer;
    const create = vi.fn(() => renderer);
    const report = vi.fn();
    const success = createWebGL2RendererFactory(report, create);

    const successfulResult = success(defaults);
    expect(success(defaults)).toBe(successfulResult);
    await expect(successfulResult).resolves.toBe(renderer);
    expect(create).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();

    const failure = createWebGL2RendererFactory(
      report,
      vi.fn(() => {
        throw new Error("context quota exhausted");
      }),
    );
    const first = failure(defaults);
    const second = failure(defaults);
    expect(first).toBeInstanceOf(Promise);
    expect(second).toBe(first);
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith("webgl2-unavailable");
    await expect(first).resolves.toMatchObject({
      domElement: defaults.canvas,
      render: expect.any(Function),
      setPixelRatio: expect.any(Function),
      setSize: expect.any(Function),
    });
  });

  it("acquires one exact context and releases partial renderer construction", () => {
    const successCanvas = document.createElement("canvas");
    const successAdd = successCanvas.addEventListener;
    const successContext = {} as WebGL2RenderingContext;
    const successGetContext = vi
      .spyOn(successCanvas, "getContext")
      .mockReturnValue(successContext);
    const successfulRenderer = {
      isWebGLRenderer: true,
    } as unknown as WebGLRenderer;
    const construct = vi.fn(() => successfulRenderer);

    expect(
      createWebGL2Renderer({ canvas: successCanvas }, construct),
    ).toBe(successfulRenderer);
    expect(successGetContext).toHaveBeenCalledOnce();
    expect(construct).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas: successCanvas,
        context: successContext,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        stencil: false,
      }),
    );
    expect(successfulRenderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(successfulRenderer.toneMapping).toBe(ACESFilmicToneMapping);
    expect(successfulRenderer.toneMappingExposure).toBe(1);
    expect(successCanvas.addEventListener).toBe(successAdd);

    const canvas = document.createElement("canvas");
    const originalAdd = canvas.addEventListener;
    const loseContext = vi.fn();
    const context = {
      getExtension: (name: string) =>
        name === "WEBGL_lose_context" ? { loseContext } : null,
    } as unknown as WebGL2RenderingContext;
    const getContext = vi
      .spyOn(canvas, "getContext")
      .mockReturnValue(context);
    const remove = vi.spyOn(canvas, "removeEventListener");
    const partialListener = vi.fn();

    expect(() =>
      createWebGL2Renderer(
        { canvas },
        () => {
          canvas.addEventListener("webglcontextlost", partialListener);
          throw new Error("renderer initialization failed");
        },
      ),
    ).toThrow("renderer initialization failed");
    expect(getContext).toHaveBeenCalledOnce();
    expect(getContext).toHaveBeenCalledWith(
      "webgl2",
      expect.objectContaining({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        stencil: false,
      }),
    );
    expect(remove).toHaveBeenCalledWith(
      "webglcontextlost",
      partialListener,
      undefined,
    );
    expect(loseContext).toHaveBeenCalledOnce();
    expect(canvas.addEventListener).toBe(originalAdd);
  });

  it("replays a durable renderer failure immediately for each activation", async () => {
    const onFailure = vi.fn();
    const common = {
      rotation: { yaw: 0, pitch: 0 },
      renderVersion: 0,
      loadEnabled: true,
      preloadReady: false,
      onFirstFrame: vi.fn(),
      onFailure,
      onContextLost: vi.fn(),
      onContextRestored: vi.fn(),
    } as const;
    const view = render(
      <SceneCanvas
        {...common}
        scene={getSceneDefinition("home-hero")}
        activationVersion={1}
      />,
    );
    const canvas = document.createElement("canvas");
    const getContext = vi
      .spyOn(canvas, "getContext")
      .mockReturnValue(null);
    const factory = canvasCalls.mock.calls.at(-1)![0].gl as (
      defaults: { readonly canvas: HTMLCanvasElement },
    ) => Promise<WebGLRenderer>;

    act(() => {
      void factory({ canvas });
    });
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenLastCalledWith("webgl2-unavailable");
    expect(getContext).toHaveBeenCalledOnce();
    const gated = render(canvasCalls.mock.calls.at(-1)![0].children);
    expect(gated.container).toBeEmptyDOMElement();
    gated.unmount();

    view.rerender(
      <SceneCanvas
        {...common}
        scene={getSceneDefinition("contact-hero")}
        activationVersion={2}
      />,
    );
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenLastCalledWith("webgl2-unavailable");
    expect(getContext).toHaveBeenCalledOnce();
  });
});
