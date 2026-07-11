import { createRoot } from "@react-three/fiber";
import { describe, expect, it, vi } from "vitest";
import { createWebGL2RendererFactory } from "./scene-canvas";

describe("SceneCanvas failed renderer root", () => {
  it("settles repeated R3F configure calls without retrying construction", async () => {
    const canvas = document.createElement("canvas");
    const report = vi.fn();
    const construct = vi.fn(() => {
      throw new Error("context unavailable");
    });
    const factory = createWebGL2RendererFactory(report, construct);
    const root = createRoot(canvas);
    const configuration = {
      gl: factory,
      frameloop: "demand" as const,
      dpr: [1, 1.5] as [number, number],
      shadows: false,
      size: { width: 1280, height: 800, top: 0, left: 0 },
    };

    await expect(root.configure(configuration)).resolves.toBe(root);
    await expect(root.configure(configuration)).resolves.toBe(root);
    expect(construct).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
    root.render(null);
    root.unmount();
  });
});
