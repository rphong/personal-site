import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("scene runtime boundary trace preparation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("next/dynamic");
    vi.doUnmock("./scene-runtime-host");
    vi.doUnmock("./scene-runtime-trace-core");
    vi.doUnmock("./scene-runtime-trace-loader");
  });

  it("does not resolve the host until trace preparation finishes", async () => {
    const preparation = deferred<void>();
    const prepareSceneRuntimeTrace = vi.fn(() => preparation.promise);
    const SceneRuntimeHost = vi.fn(() => null);
    let loadDynamicComponent: (() => Promise<unknown>) | undefined;
    vi.doMock("next/dynamic", () => ({
      default: (loader: () => Promise<unknown>) => {
        loadDynamicComponent = loader;
        return () => null;
      },
    }));
    vi.doMock("./scene-runtime-trace-core", () => ({
      sceneRuntimeTraceEnabled: () => true,
    }));
    vi.doMock("./scene-runtime-trace-loader", () => ({
      prepareSceneRuntimeTrace,
    }));
    vi.doMock("./scene-runtime-host", () => ({ SceneRuntimeHost }));
    await import("./scene-runtime-boundary");

    let hostResolved = false;
    const hostLoad = loadDynamicComponent?.().then((component) => {
      hostResolved = true;
      return component;
    });
    await vi.waitFor(() => {
      expect(prepareSceneRuntimeTrace).toHaveBeenCalledOnce();
    });
    expect(hostResolved).toBe(false);

    preparation.resolve();
    await expect(hostLoad).resolves.toBe(SceneRuntimeHost);
    expect(hostResolved).toBe(true);
  });

  it("does not gate the trace-disabled host import on preparation", async () => {
    const prepareSceneRuntimeTrace = vi.fn(
      () => new Promise<void>(() => undefined),
    );
    const SceneRuntimeHost = vi.fn(() => null);
    let loadDynamicComponent: (() => Promise<unknown>) | undefined;
    vi.doMock("next/dynamic", () => ({
      default: (loader: () => Promise<unknown>) => {
        loadDynamicComponent = loader;
        return () => null;
      },
    }));
    vi.doMock("./scene-runtime-trace-core", () => ({
      sceneRuntimeTraceEnabled: () => false,
    }));
    vi.doMock("./scene-runtime-trace-loader", () => ({
      prepareSceneRuntimeTrace,
    }));
    vi.doMock("./scene-runtime-host", () => ({ SceneRuntimeHost }));
    await import("./scene-runtime-boundary");

    await expect(loadDynamicComponent?.()).resolves.toBe(SceneRuntimeHost);
    expect(prepareSceneRuntimeTrace).not.toHaveBeenCalled();
  });

  it("prepares the complete trace after a mounted boundary is enabled later", async () => {
    const prepareSceneRuntimeTrace = vi.fn(async () => undefined);
    const unsubscribe = vi.fn();
    let enableListener: (() => void) | undefined;
    vi.doMock("next/dynamic", () => ({
      default: () => () => null,
    }));
    vi.doMock("./scene-runtime-trace-core", () => ({
      sceneRuntimeTraceEnabled: () => false,
      subscribeSceneRuntimeTraceEnable: vi.fn((listener: () => void) => {
        enableListener = listener;
        return unsubscribe;
      }),
    }));
    vi.doMock("./scene-runtime-trace-loader", () => ({
      prepareSceneRuntimeTrace,
    }));
    const { SceneRuntimeBoundary } = await import("./scene-runtime-boundary");
    const view = render(<SceneRuntimeBoundary />);

    expect(prepareSceneRuntimeTrace).not.toHaveBeenCalled();
    act(() => enableListener?.());
    await vi.waitFor(() => {
      expect(prepareSceneRuntimeTrace).toHaveBeenCalledOnce();
    });

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
