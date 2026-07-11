import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  classifySceneError,
  SceneErrorBoundary,
} from "./scene-error-boundary";

function MaybeBroken({
  message,
}: {
  readonly message: string | null;
}) {
  if (message) throw new Error(message);
  return <span>scene healthy</span>;
}

describe("SceneErrorBoundary", () => {
  it.each([
    ["Scene model fetch failed for /models/a.glb", "fetch"],
    ["Could not decode glTF Meshopt buffer", "decode"],
    ["Unexpected renderer failure", "unknown"],
  ] as const)("maps %s to the %s failure code", (message, reason) => {
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { container } = render(
      <SceneErrorBoundary resetKey="home-hero:0:0" onError={onError}>
        <MaybeBroken message={message} />
      </SceneErrorBoundary>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(reason);
    consoleError.mockRestore();
  });

  it("resets only when the complete activation key changes", () => {
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const view = render(
      <SceneErrorBoundary resetKey="home-hero:1:0" onError={onError}>
        <MaybeBroken message="decode failed" />
      </SceneErrorBoundary>,
    );

    view.rerender(
      <SceneErrorBoundary resetKey="home-hero:1:0" onError={onError}>
        <MaybeBroken message={null} />
      </SceneErrorBoundary>,
    );
    expect(screen.queryByText("scene healthy")).not.toBeInTheDocument();

    view.rerender(
      <SceneErrorBoundary resetKey="home-hero:2:0" onError={onError}>
        <MaybeBroken message={null} />
      </SceneErrorBoundary>,
    );
    expect(screen.getByText("scene healthy")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("classifies non-Error values without throwing", () => {
    expect(classifySceneError("network unavailable")).toBe("fetch");
    expect(classifySceneError({ reason: "opaque" })).toBe("unknown");
  });
});
