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

  it("does not server-render a permanently loading control before initialization", () => {
    const { runtime } = value({
      threeEnabled: false,
      threeInitialized: false,
    });
    render(
      <SceneRuntimeContext.Provider value={runtime}>
        <ThreePreferenceToggle />
      </SceneRuntimeContext.Provider>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("3D loading")).not.toBeInTheDocument();
  });

  it("disables the control when WebGL2 is unavailable", () => {
    const label = "3D unavailable";
    const { runtime, setThreeEnabled } = value({
      threeEnabled: false,
      threeInitialized: true,
      threeSupported: false,
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
  });
});
