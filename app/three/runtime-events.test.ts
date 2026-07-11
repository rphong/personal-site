import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emitSceneRuntimeEvent,
  SCENE_RUNTIME_EVENT_NAME,
} from "./runtime-events";

const listeners: EventListener[] = [];
const originalMark = Object.getOwnPropertyDescriptor(performance, "mark");
const originalSendBeacon = Object.getOwnPropertyDescriptor(
  navigator,
  "sendBeacon",
);

function listen() {
  const listener = vi.fn();
  window.addEventListener(SCENE_RUNTIME_EVENT_NAME, listener);
  listeners.push(listener);
  return listener;
}

describe("emitSceneRuntimeEvent", () => {
  beforeEach(() => {
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    for (const listener of listeners.splice(0)) {
      window.removeEventListener(SCENE_RUNTIME_EVENT_NAME, listener);
    }
    vi.unstubAllGlobals();
    if (originalMark) {
      Object.defineProperty(performance, "mark", originalMark);
    } else {
      Reflect.deleteProperty(performance, "mark");
    }
    if (originalSendBeacon) {
      Object.defineProperty(navigator, "sendBeacon", originalSendBeacon);
    } else {
      Reflect.deleteProperty(navigator, "sendBeacon");
    }
  });

  it("marks and dispatches the first ready-frame detail locally", () => {
    const listener = listen();

    emitSceneRuntimeEvent({
      status: "ready",
      sceneId: "home-hero",
      durationMs: 420,
    });

    expect(performance.mark).toHaveBeenCalledWith("scene-ready:home-hero");
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      status: "ready",
      sceneId: "home-hero",
      durationMs: 420,
    });
  });

  it("dispatches a coded failure without marking ready", () => {
    const listener = listen();

    emitSceneRuntimeEvent({
      status: "failure",
      sceneId: "league-ban",
      reason: "fetch",
      durationMs: 900,
    });

    expect(performance.mark).not.toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      status: "failure",
      sceneId: "league-ban",
      reason: "fetch",
      durationMs: 900,
    });
  });

  it("dispatches rotation frame health without a ready mark", () => {
    const listener = listen();

    emitSceneRuntimeEvent({
      status: "rotation-health",
      sceneId: "froggie-adventures",
      fps: 47,
    });

    expect(performance.mark).not.toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      status: "rotation-health",
      sceneId: "froggie-adventures",
      fps: 47,
    });
  });

  it("never performs network work", () => {
    const listener = listen();
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: beaconSpy,
    });

    emitSceneRuntimeEvent({
      status: "context-lost",
      sceneId: "nasa-rocket",
      reason: "context-lost",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      status: "context-lost",
      sceneId: "nasa-rocket",
      reason: "context-lost",
    });
  });

  it("is inert when imported and called during server rendering", () => {
    vi.stubGlobal("window", undefined);

    expect(() =>
      emitSceneRuntimeEvent({
        status: "ready",
        sceneId: "contact-hero",
        durationMs: 1,
      }),
    ).not.toThrow();
    expect(performance.mark).not.toHaveBeenCalled();
  });
});
