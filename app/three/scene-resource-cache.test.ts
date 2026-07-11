import { describe, expect, it, vi } from "vitest";
import {
  SceneResourceCache,
  type SceneResourceLoader,
} from "./scene-resource-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("SceneResourceCache", () => {
  it("deduplicates a URL and disposes a resolved entry when cleared", async () => {
    const pending = deferred<{ id: string }>();
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi.fn(() => pending.promise),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);

    const first = cache.load("/models/a.glb");
    const second = cache.load("/models/a.glb");
    expect(first).toBe(second);
    expect(loader.load).toHaveBeenCalledOnce();
    expect(cache.size).toBe(1);

    const value = { id: "a" };
    pending.resolve(value);
    await expect(first).resolves.toBe(value);
    cache.clear("/models/a.glb");
    expect(loader.dispose).toHaveBeenCalledOnce();
    expect(loader.dispose).toHaveBeenCalledWith(value);
    expect(cache.size).toBe(0);
  });

  it("aborts stale ownership, rejects its promise, and disposes a late result", async () => {
    const old = deferred<{ id: string }>();
    const fresh = deferred<{ id: string }>();
    const signals: AbortSignal[] = [];
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi
        .fn()
        .mockImplementationOnce((_url, signal) => {
          signals.push(signal);
          return old.promise;
        })
        .mockImplementationOnce((_url, signal) => {
          signals.push(signal);
          return fresh.promise;
        }),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);

    const oldPromise = cache.load("/models/a.glb");
    cache.clear("/models/a.glb");
    expect(signals[0].aborted).toBe(true);
    const freshPromise = cache.load("/models/a.glb");
    expect(freshPromise).not.toBe(oldPromise);

    const staleValue = { id: "stale" };
    old.resolve(staleValue);
    await expect(oldPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(loader.dispose).toHaveBeenCalledWith(staleValue);
    expect(cache.size).toBe(1);

    const freshValue = { id: "fresh" };
    fresh.resolve(freshValue);
    await expect(freshPromise).resolves.toBe(freshValue);
    expect(cache.peek("/models/a.glb")).toBe(freshValue);
  });

  it("pins an active failure only for the same attempt owner", async () => {
    const activeFailure = new Error("active failed");
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi
        .fn()
        .mockRejectedValueOnce(new Error("preload failed"))
        .mockRejectedValueOnce(activeFailure)
        .mockResolvedValueOnce({ id: "retry" }),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);

    await expect(cache.preload("/models/a.glb")).rejects.toThrow(
      "preload failed",
    );
    expect(cache.size).toBe(0);

    const failedActivation = cache.activate(
      "/models/a.glb",
      "scene-a:activation-1",
    );
    await expect(failedActivation).rejects.toBe(activeFailure);
    expect(cache.size).toBe(1);
    expect(
      cache.activate("/models/a.glb", "scene-a:activation-1"),
    ).toBe(failedActivation);
    expect(loader.load).toHaveBeenCalledTimes(2);

    await expect(
      cache.activate("/models/a.glb", "scene-a:activation-2"),
    ).resolves.toEqual({ id: "retry" });
    expect(loader.load).toHaveBeenCalledTimes(3);
  });

  it("clears every pending entry and ignores later completions", async () => {
    const a = deferred<{ id: string }>();
    const b = deferred<{ id: string }>();
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi
        .fn()
        .mockImplementationOnce(() => a.promise)
        .mockImplementationOnce(() => b.promise),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);
    const aPromise = cache.load("a");
    const bPromise = cache.load("b");

    cache.clearAll();
    expect(cache.size).toBe(0);
    a.resolve({ id: "a" });
    b.resolve({ id: "b" });
    await expect(aPromise).rejects.toMatchObject({ name: "AbortError" });
    await expect(bPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(loader.dispose).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it("promotes one speculative URL and never owns more than current plus next", () => {
    const signals = new Map<string, AbortSignal>();
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi.fn((url, signal) => {
        const request = deferred<{ id: string }>();
        signals.set(url, signal);
        return request.promise;
      }),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);
    const firstHostLease = cache.acquireHostLease();

    const currentA = cache.activate("a", "scene-a");
    const nextB = cache.preload("b");
    expect(cache.size).toBe(2);
    const replacementHostLease = cache.acquireHostLease();
    expect(cache.releaseHostLease(firstHostLease)).toBe(false);
    expect(cache.size).toBe(2);
    expect(signals.get("a")?.aborted).toBe(false);
    expect(signals.get("b")?.aborted).toBe(false);

    expect(cache.activate("b", "scene-b")).toBe(nextB);
    expect(cache.size).toBe(1);
    expect(signals.get("a")?.aborted).toBe(true);
    expect(signals.get("b")?.aborted).toBe(false);
    expect(loader.load).toHaveBeenCalledTimes(2);

    const nextC = cache.preload("c");
    expect(cache.size).toBe(2);
    expect(cache.activate("b", "scene-b-shared-url")).toBe(nextB);
    expect(cache.size).toBe(1);
    expect(signals.get("c")?.aborted).toBe(true);
    expect(loader.load).toHaveBeenCalledTimes(3);

    const retryC = cache.preload("c");
    expect(cache.size).toBe(2);
    expect(cache.releaseHostLease(replacementHostLease)).toBe(true);
    expect(cache.size).toBe(0);
    expect(signals.get("b")?.aborted).toBe(true);
    expect(signals.get("c")?.aborted).toBe(true);
    void currentA.catch(() => undefined);
    void nextB.catch(() => undefined);
    void nextC.catch(() => undefined);
    void retryC.catch(() => undefined);
  });
});
