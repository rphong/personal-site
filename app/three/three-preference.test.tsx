import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStoredPreference,
  resolveThreePreference,
  supportsWebGL2,
  THREE_PREFERENCE_STORAGE_KEY,
  useThreePreference,
} from "./three-preference";

const originalConnection = Object.getOwnPropertyDescriptor(
  navigator,
  "connection",
);
const originalSendBeacon = Object.getOwnPropertyDescriptor(
  navigator,
  "sendBeacon",
);

describe("resolveThreePreference", () => {
  it("enables 3D by default when WebGL 2 is present", () => {
    expect(
      resolveThreePreference({ stored: null, saveData: false, webgl2: true }),
    ).toEqual({ mode: "enabled", explicit: false });
  });

  it("defaults to posters for reduced data until the visitor chooses", () => {
    expect(
      resolveThreePreference({ stored: null, saveData: true, webgl2: true }),
    ).toEqual({ mode: "disabled", explicit: false });
  });

  it("lets an explicit on choice override reduced data", () => {
    expect(
      resolveThreePreference({ stored: "on", saveData: true, webgl2: true }),
    ).toEqual({ mode: "enabled", explicit: true });
  });

  it("always reports unsupported without WebGL 2", () => {
    expect(
      resolveThreePreference({ stored: "on", saveData: false, webgl2: false }),
    ).toEqual({ mode: "unsupported", explicit: true });
  });
});

describe("preference capability and storage boundaries", () => {
  it("requests a high-performance WebGL 2 context and releases the probe", () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    const getContext = vi.fn(() => ({ getExtension }));
    const documentRef = {
      createElement: () => ({ getContext }),
    } as unknown as Document;

    expect(supportsWebGL2(documentRef)).toBe(true);
    expect(getContext).toHaveBeenCalledWith("webgl2", {
      powerPreference: "high-performance",
    });
    expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("fails WebGL 2 detection closed when canvas access throws", () => {
    const documentRef = {
      createElement: () => ({
        getContext: () => {
          throw new DOMException("Context denied", "SecurityError");
        },
      }),
    } as unknown as Document;

    expect(supportsWebGL2(documentRef)).toBe(false);
  });

  it("ignores unrecognized storage values", () => {
    expect(
      readStoredPreference({
        getItem: () => "yes",
        setItem: () => undefined,
      }),
    ).toBeNull();
  });

  it("does not touch browser globals during server rendering", () => {
    function PreferenceProbe() {
      useThreePreference();
      return null;
    }

    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("navigator", undefined);
    try {
      expect(() => renderToString(<PreferenceProbe />)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("useThreePreference", () => {
  let loseContext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((contextId: string) =>
        contextId === "webgl2"
          ? ({
              getExtension: (name: string) =>
                name === "WEBGL_lose_context" ? { loseContext } : null,
            } as unknown as WebGL2RenderingContext)
          : null) as typeof HTMLCanvasElement.prototype.getContext,
    );
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    if (originalConnection) {
      Object.defineProperty(navigator, "connection", originalConnection);
    } else {
      Reflect.deleteProperty(navigator, "connection");
    }
    if (originalSendBeacon) {
      Object.defineProperty(navigator, "sendBeacon", originalSendBeacon);
    } else {
      Reflect.deleteProperty(navigator, "sendBeacon");
    }
  });

  it("probes and releases WebGL 2 only once across toggles and rerenders", async () => {
    const { result, rerender } = renderHook(() => useThreePreference());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    rerender();
    act(() => result.current.setEnabled(false));
    act(() => result.current.setEnabled(true));

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1);
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("defaults to posters for Save-Data without persisting an implicit choice", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });

    const { result } = renderHook(() => useThreePreference());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    expect(result.current).toMatchObject({
      enabled: false,
      explicit: false,
      supported: true,
    });
    expect(localStorage.getItem(THREE_PREFERENCE_STORAGE_KEY)).toBeNull();
  });

  it.each([
    { stored: "on", saveData: true, enabled: true },
    { stored: "off", saveData: false, enabled: false },
  ] as const)(
    "honors stored $stored when saveData is $saveData",
    async ({ stored, saveData, enabled }) => {
      localStorage.setItem(THREE_PREFERENCE_STORAGE_KEY, stored);
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData },
      });

      const { result } = renderHook(() => useThreePreference());
      await waitFor(() => expect(result.current.initialized).toBe(true));

      expect(result.current).toMatchObject({
        enabled,
        explicit: true,
        supported: true,
      });
    },
  );

  it("reports unsupported without mutating storage", async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(
      () => null,
    );

    const { result } = renderHook(() => useThreePreference());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    expect(result.current).toMatchObject({
      enabled: false,
      explicit: false,
      supported: false,
    });
    expect(localStorage.getItem(THREE_PREFERENCE_STORAGE_KEY)).toBeNull();
  });

  it("persists only the explicit on/off value on-device", async () => {
    const { result } = renderHook(() => useThreePreference());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    act(() => result.current.setEnabled(false));
    expect(localStorage.getItem(THREE_PREFERENCE_STORAGE_KEY)).toBe("off");
    expect(result.current.enabled).toBe(false);

    act(() => result.current.setEnabled(true));
    expect(localStorage.getItem(THREE_PREFERENCE_STORAGE_KEY)).toBe("on");
    expect(result.current.enabled).toBe(true);
  });

  it("keeps the poster-first shell alive when storage access is denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    const { result } = renderHook(() => useThreePreference());
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(() => act(() => result.current.setEnabled(false))).not.toThrow();
    expect(result.current.enabled).toBe(false);
  });

  it("never sends preference or capability data over the network", async () => {
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: beaconSpy,
    });

    const { result } = renderHook(() => useThreePreference());
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.setEnabled(false));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });
});
