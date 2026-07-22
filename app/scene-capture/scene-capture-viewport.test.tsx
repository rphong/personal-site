import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { SceneProvider } from "../three/scene-provider";
import { SceneCaptureViewport } from "./scene-capture-viewport";

vi.mock("next/navigation", () => ({
  usePathname: () => "/scene-capture",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    scroll: _scroll,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { readonly scroll?: boolean }) => {
    void _scroll;
    return createElement("a", props, children);
  },
}));

vi.mock("../three/three-preference", () => ({
  useThreePreference: () => ({
    initialized: true,
    enabled: true,
    supported: true,
    explicit: false,
    setEnabled: vi.fn(),
  }),
}));

vi.mock("../three/scene-runtime-boundary", () => ({
  SceneRuntimeBoundary: () => null,
}));

vi.mock("../three/three-preference-toggle", () => ({
  ThreePreferenceToggle: () => null,
}));

describe("SceneCaptureViewport", () => {
  it("authorizes the blocked Home fallback and preserves capture flags", async () => {
    render(
      <SceneProvider>
        <SceneCaptureViewport
          sceneId="home-hero"
          scrollTest
          showControls
        />
      </SceneProvider>,
    );

    const section = screen.getByRole("heading", {
      name: "Origami crane home scene",
    }).closest("section");
    await waitFor(() => {
      expect(section).toHaveAttribute("data-scene-active", "true");
      expect(section).toHaveAttribute("data-scene-status", "loading");
    });
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-capture-controls",
      "true",
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-scroll-test",
      "true",
    );
    expect(screen.getByRole("main")).toHaveStyle({
      background: "#9ECCC0",
    });
    expect(document.querySelector(".scene-capture-scroll-space"))
      .toBeInTheDocument();
    expect(screen.getByTestId("capture-next-scene")).toHaveAttribute(
      "href",
      "/scene-capture?scene=experience-hero&controls=1",
    );
  });

  it("reactivates poster-only and terminal scenes on query-style rerenders", async () => {
    const view = render(
      <SceneProvider>
        <SceneCaptureViewport
          sceneId="eog-poster"
          scrollTest={false}
          showControls={false}
        />
      </SceneProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("EOG Resources poster").closest("section"))
        .toHaveAttribute("data-scene-status", "poster");
    });
    expect(screen.getByRole("main")).toHaveStyle({
      background: "#DFA9B5",
    });
    expect(screen.getByTestId("capture-next-scene")).toHaveAttribute(
      "href",
      "/scene-capture?scene=paycom-poster&controls=1",
    );

    view.rerender(
      <SceneProvider>
        <SceneCaptureViewport
          sceneId="contact-hero"
          scrollTest={false}
          showControls={false}
        />
      </SceneProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Workout crane contact scene").closest("section"))
        .toHaveAttribute("data-scene-status", "loading");
    });
    expect(screen.getByRole("main")).toHaveStyle({
      background: "#C9BAE4",
    });
    expect(screen.getByTestId("capture-next-scene")).toHaveAttribute(
      "href",
      "/scene-capture?scene=home-hero&controls=1",
    );
    expect(document.querySelector(".scene-capture-scroll-space"))
      .not.toBeInTheDocument();
  });
});
