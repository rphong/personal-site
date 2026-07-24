import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("scene runtime trace chunk loading", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("./scene-runtime-trace");
    vi.doUnmock("./scene-alpha-capture");
    delete window.__enableSceneRuntimeTrace;
    delete window.__sceneRuntimeTrace;
    delete window.__sceneRuntimeTraceObserverCleanup;
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    delete window.__enableSceneRuntimeTrace;
    delete window.__sceneRuntimeTrace;
    window.__sceneRuntimeTraceObserverCleanup?.();
    delete window.__sceneRuntimeTraceObserverCleanup;
    window.history.replaceState(null, "", "/");
  });

  it("does not evaluate heavy trace modules when tracing is disabled", async () => {
    const traceModuleEvaluated = vi.fn();
    const alphaModuleEvaluated = vi.fn();
    vi.doMock("./scene-runtime-trace", () => {
      traceModuleEvaluated();
      return {};
    });
    vi.doMock("./scene-alpha-capture", () => {
      alphaModuleEvaluated();
      return {};
    });
    const {
      getLoadedSceneAlphaCaptureModule,
      getLoadedSceneRuntimeTraceModule,
      loadSceneAlphaCaptureModule,
      loadSceneRuntimeTraceModule,
    } = await import("./scene-runtime-trace-loader");

    await expect(loadSceneRuntimeTraceModule()).resolves.toBeNull();
    await expect(loadSceneAlphaCaptureModule()).resolves.toBeNull();
    expect(getLoadedSceneRuntimeTraceModule()).toBeNull();
    expect(getLoadedSceneAlphaCaptureModule()).toBeNull();
    expect(traceModuleEvaluated).not.toHaveBeenCalled();
    expect(alphaModuleEvaluated).not.toHaveBeenCalled();
  });

  it("deduplicates each trace-enabled dynamic module request", async () => {
    window.__enableSceneRuntimeTrace = true;
    const traceModuleEvaluated = vi.fn();
    const alphaModuleEvaluated = vi.fn();
    vi.doMock("./scene-runtime-trace", () => {
      traceModuleEvaluated();
      return { installSceneRuntimeTraceObservers: vi.fn() };
    });
    vi.doMock("./scene-alpha-capture", () => {
      alphaModuleEvaluated();
      return { captureSceneAlphaTraceFrame: vi.fn() };
    });
    const {
      loadSceneAlphaCaptureModule,
      loadSceneRuntimeTraceModule,
    } = await import("./scene-runtime-trace-loader");

    const [firstTrace, secondTrace, firstAlpha, secondAlpha] =
      await Promise.all([
        loadSceneRuntimeTraceModule(),
        loadSceneRuntimeTraceModule(),
        loadSceneAlphaCaptureModule(),
        loadSceneAlphaCaptureModule(),
      ]);

    expect(firstTrace).toBe(secondTrace);
    expect(firstAlpha).toBe(secondAlpha);
    expect(traceModuleEvaluated).toHaveBeenCalledOnce();
    expect(alphaModuleEvaluated).toHaveBeenCalledOnce();
  });

  it("prepares both delayed trace chunks before resolving and installs observers", async () => {
    window.__enableSceneRuntimeTrace = true;
    const traceChunk = deferred<void>();
    const alphaChunk = deferred<void>();
    const installSceneRuntimeTraceObservers = vi.fn();
    vi.doMock("./scene-runtime-trace", async () => {
      await traceChunk.promise;
      return { installSceneRuntimeTraceObservers };
    });
    vi.doMock("./scene-alpha-capture", async () => {
      await alphaChunk.promise;
      return { captureSceneAlphaTraceFrame: vi.fn() };
    });
    const { prepareSceneRuntimeTrace } = await import(
      "./scene-runtime-trace-loader"
    );
    let prepared = false;

    const preparation = prepareSceneRuntimeTrace().then(() => {
      prepared = true;
    });
    await vi.waitFor(() => {
      expect(installSceneRuntimeTraceObservers).not.toHaveBeenCalled();
      expect(prepared).toBe(false);
    });

    traceChunk.resolve();
    await vi.waitFor(() => {
      expect(installSceneRuntimeTraceObservers).toHaveBeenCalledOnce();
    });
    expect(prepared).toBe(false);

    alphaChunk.resolve();
    await preparation;
    expect(prepared).toBe(true);
  });

  it("starts a fresh trace chunk request after a rejected request", async () => {
    window.__enableSceneRuntimeTrace = true;
    vi.doMock("./scene-runtime-trace", async () => {
      throw new Error("temporary trace failure");
    });
    const { loadSceneRuntimeTraceModule } = await import(
      "./scene-runtime-trace-loader"
    );

    const firstRequest = loadSceneRuntimeTraceModule();
    await expect(firstRequest).rejects.toBeDefined();
    const retryRequest = loadSceneRuntimeTraceModule();
    expect(retryRequest).not.toBe(firstRequest);
    await expect(retryRequest).rejects.toBeDefined();
  });

  it("reports trace and alpha chunk failures independently", async () => {
    window.__enableSceneRuntimeTrace = true;
    window.__sceneRuntimeTrace = [];
    vi.doMock("./scene-runtime-trace", async () => {
      throw new Error("trace unavailable");
    });
    vi.doMock("./scene-alpha-capture", async () => {
      throw new Error("alpha unavailable");
    });
    const { prepareSceneRuntimeTrace } = await import(
      "./scene-runtime-trace-loader"
    );

    await expect(prepareSceneRuntimeTrace()).resolves.toBeUndefined();

    expect(
      window.__sceneRuntimeTrace
        ?.filter(({ phase }) => phase === "trace-module:load-error")
        .map(({ details }) => details.moduleName)
        .sort(),
    ).toEqual(["alpha-capture", "runtime-trace"]);
  });
});
