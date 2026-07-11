import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getSceneDefinition } from "./scene-registry";
import {
  SceneRuntimeContext,
  type SceneRuntimeContextValue,
} from "./scene-runtime-context";
import { ThreePreferenceToggle } from "./three-preference-toggle";

function value(overrides: Partial<SceneRuntimeContextValue> = {}) {
  const setThreeEnabled = vi.fn();
  const runtime: SceneRuntimeContextValue = {
    activeSceneId: "home-hero",
    activeScene: getSceneDefinition("home-hero"),
    activationVersion: 0,
    sceneActivationAllowed: true,
    status: "ready",
    rotation: { yaw: 0, pitch: 0 },
    threeInitialized: true,
    threeEnabled: true,
    threeSupported: true,
    activateScene: vi.fn(),
    registerSection: vi.fn(() => vi.fn()),
    setStatus: vi.fn(),
    rotateBy: vi.fn(),
    setThreeEnabled,
    ...overrides,
  };
  return { runtime, setThreeEnabled };
}

describe("ThreePreferenceToggle", () => {
  it("is keyboard-accessible and stores an explicit off request through context", () => {
    const { runtime, setThreeEnabled } = value();
    render(
      <SceneRuntimeContext.Provider value={runtime}>
        <ThreePreferenceToggle />
      </SceneRuntimeContext.Provider>,
    );

    const button = screen.getByRole("button", { name: "3D on" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(setThreeEnabled).toHaveBeenCalledWith(false);
  });

  it("stores an explicit on request from poster-only preference mode", () => {
    const { runtime, setThreeEnabled } = value({ threeEnabled: false });
    render(
      <SceneRuntimeContext.Provider value={runtime}>
        <ThreePreferenceToggle />
      </SceneRuntimeContext.Provider>,
    );

    const button = screen.getByRole("button", { name: "3D off" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(setThreeEnabled).toHaveBeenCalledWith(true);
  });

  it.each([
    { initialized: false, supported: true, label: "3D loading" },
    { initialized: true, supported: false, label: "3D unavailable" },
  ])(
    "disables the control when initialized=$initialized and supported=$supported",
    ({ initialized, supported, label }) => {
      const { runtime, setThreeEnabled } = value({
        threeEnabled: false,
        threeInitialized: initialized,
        threeSupported: supported,
      });
      render(
        <SceneRuntimeContext.Provider value={runtime}>
          <ThreePreferenceToggle />
        </SceneRuntimeContext.Provider>,
      );

      const button = screen.getByRole("button", { name: label });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("type", "button");
      fireEvent.click(button);
      expect(setThreeEnabled).not.toHaveBeenCalled();
    },
  );
});
