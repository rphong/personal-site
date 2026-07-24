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

  it("hands a speculative request to a resident without starting another load", async () => {
    const pending = deferred<{ id: string }>();
    let signal: AbortSignal | undefined;
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi.fn((_url, nextSignal) => {
        signal = nextSignal;
        return pending.promise;
      }),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);

    const preload = cache.preload("/models/a.glb");
    const resident = cache.activate(
      "/models/a.glb",
      "scene-a:activation-1",
    );
    expect(resident).toBe(preload);

    expect(cache.size).toBe(1);
    expect(signal?.aborted).toBe(false);

    const value = { id: "resident" };
    pending.resolve(value);
    await expect(resident).resolves.toBe(value);

    cache.clear("/models/a.glb");
    expect(cache.size).toBe(0);
    expect(loader.dispose).toHaveBeenCalledWith(value);
  });

  it("retains a decoded resident source once after a completed preload", async () => {
    const pending = deferred<{ id: string }>();
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi.fn(() => pending.promise),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);
    const lease = cache.acquireHostLease();
    const preload = cache.preload("/models/a.glb");
    const value = { id: "decoded" };
    pending.resolve(value);
    await expect(preload).resolves.toBe(value);

    expect(
      cache.activate("/models/a.glb", "scene-a:activation-1"),
    ).toBe(preload);
    for (let index = 0; index < 20; index += 1) {
      expect(
        cache.activate("/models/a.glb", `scene-a:activation-${index + 2}`),
      ).toBe(preload);
    }
    expect(cache.size).toBe(1);
    expect(loader.load).toHaveBeenCalledOnce();

    expect(cache.releaseHostLease(lease)).toBe(true);
    expect(cache.size).toBe(0);
    expect(loader.dispose).toHaveBeenCalledWith(value);
  });

  it("returns the existing rejected promise to speculative callers", async () => {
    const failure = new Error("active failed");
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi.fn(() => Promise.reject(failure)),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);
    const activation = cache.activate(
      "/models/a.glb",
      "scene-a:activation-1",
    );
    await expect(activation).rejects.toBe(failure);

    expect(cache.preload("/models/a.glb")).toBe(activation);
    cache.clear("/models/a.glb");
    expect(cache.size).toBe(0);
  });

  it("keeps rejected activation ownership independent for concurrent URLs", async () => {
    const failures = new Map([
      ["a", new Error("a failed")],
      ["b", new Error("b failed")],
    ]);
    const loader: SceneResourceLoader<{ id: string }> = {
      load: vi.fn((url) => Promise.reject(failures.get(url))),
      dispose: vi.fn(),
    };
    const cache = new SceneResourceCache(loader);

    const a = cache.activate("a", "scene-a:1");
    const b = cache.activate("b", "scene-b:1");
    await expect(a).rejects.toBe(failures.get("a"));
    await expect(b).rejects.toBe(failures.get("b"));
    expect(cache.size).toBe(2);
    expect(cache.activate("a", "scene-a:1")).toBe(a);
    expect(cache.activate("b", "scene-b:1")).toBe(b);

    const retryA = cache.activate("a", "scene-a:2");
    await expect(retryA).rejects.toBe(failures.get("a"));
    expect(loader.load).toHaveBeenCalledTimes(3);
    expect(cache.activate("b", "scene-b:1")).toBe(b);
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

  it("retains every warmed URL until the current host lease is released", () => {
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
    const warmedB = cache.preload("b");
    const warmedC = cache.preload("c");
    expect(cache.size).toBe(3);

    const replacementHostLease = cache.acquireHostLease();
    expect(cache.releaseHostLease(firstHostLease)).toBe(false);
    expect(cache.activate("b", "scene-b")).toBe(warmedB);
    expect(cache.activate("a", "scene-a-again")).toBe(currentA);
    expect(cache.size).toBe(3);
    expect(signals.get("a")?.aborted).toBe(false);
    expect(signals.get("b")?.aborted).toBe(false);
    expect(signals.get("c")?.aborted).toBe(false);
    expect(loader.load).toHaveBeenCalledTimes(3);

    expect(cache.releaseHostLease(replacementHostLease)).toBe(true);
    expect(cache.size).toBe(0);
    expect(signals.get("a")?.aborted).toBe(true);
    expect(signals.get("b")?.aborted).toBe(true);
    expect(signals.get("c")?.aborted).toBe(true);
    void currentA.catch(() => undefined);
    void warmedB.catch(() => undefined);
    void warmedC.catch(() => undefined);
  });
});
