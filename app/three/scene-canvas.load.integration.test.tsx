import { readFile } from "node:fs/promises";
import ReactThreeTestRenderer, {
  waitFor as waitForThree,
} from "@react-three/test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneCanvasContents, type SceneCanvasPortProps } from "./scene-canvas";
import { getSceneDefinition } from "./scene-registry";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function responseFrom(bytes: Uint8Array): Response {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Response(buffer, { status: 200 });
}

describe("SceneCanvas load ordering", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aborts only after suspended detachment and starts one fresh activation", async () => {
    const bytes = new Uint8Array(await readFile("public/models/crane.glb"));
    const firstResponse = deferred<Response>();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal as AbortSignal);
        return fetcher.mock.calls.length === 1
          ? firstResponse.promise
          : Promise.resolve(responseFrom(bytes));
      },
    );
    vi.stubGlobal("fetch", fetcher);
    const onFirstFrame = vi.fn();
    const onFailure = vi.fn();
    const initial: SceneCanvasPortProps = {
      scene: getSceneDefinition("home-hero"),
      rotation: { yaw: 0, pitch: 0 },
      activationVersion: 1,
      renderVersion: 0,
      loadEnabled: true,
      preloadReady: false,
      onFirstFrame,
      onFailure,
      onContextLost: vi.fn(),
      onContextRestored: vi.fn(),
    };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneCanvasContents {...initial} />,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(signals[0].aborted).toBe(false);

    await renderer.update(
      <SceneCanvasContents {...initial} loadEnabled={false} />,
    );
    expect(signals[0].aborted).toBe(true);
    firstResponse.resolve(responseFrom(bytes));
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(onFirstFrame).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    await renderer.update(
      <SceneCanvasContents
        {...initial}
        activationVersion={2}
        loadEnabled
      />,
    );
    await waitForThree(
      () =>
        renderer.scene.findAllByProps({
          name: "scene-instance:home-hero",
        }).length === 1,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    await renderer.advanceFrames(1, 1 / 60);
    expect(onFirstFrame).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();

    await renderer.unmount();
    await Promise.resolve();
  });
});
