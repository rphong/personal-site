import { readFile } from "node:fs/promises";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactPage from "../contact/page";
import ExperiencePage from "../experience/page";
import HomePage from "../page";
import ProjectsPage from "../projects/page";
import { experience, projects, routes } from "../../content/site-content";
import { getSceneDefinition } from "./scene-registry";
import {
  SceneRuntimeContext,
  type SceneRuntimeContextValue,
} from "./scene-runtime-context";
import type { SceneId } from "./types";

const routeCases: readonly {
  readonly name: string;
  readonly page: ReactElement;
  readonly scenes: readonly SceneId[];
}[] = [
  { name: "Home", page: <HomePage />, scenes: ["home-hero"] },
  {
    name: "Experience",
    page: <ExperiencePage />,
    scenes: [
      "experience-hero",
      "experience-intro",
      "nasa-rocket",
      "eog-poster",
      "paycom-poster",
    ],
  },
  {
    name: "Projects",
    page: <ProjectsPage />,
    scenes: ["projects-hero", "league-ban", "froggie-adventures"],
  },
  { name: "Contact", page: <ContactPage />, scenes: ["contact-hero"] },
];

afterEach(cleanup);

function sceneSections(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("section.scene-section"),
  );
}

function runtimeValue(
  activeSceneId: SceneId,
  registerSection: SceneRuntimeContextValue["registerSection"],
): SceneRuntimeContextValue {
  const activeScene = getSceneDefinition(activeSceneId);
  return {
    activeScene,
    activeSceneId,
    activeSectionElement: null,
    sceneStageElement: null,
    activationVersion: 0,
    sceneActivationAllowed: true,
    status: activeScene.requiredLive ? "loading" : "poster",
    rotation: activeScene.rotation.default,
    threeEnabled: true,
    threeInitialized: true,
    threeSupported: true,
    activateScene: vi.fn(),
    registerSection,
    registerSceneStage: vi.fn(),
    rotateBy: vi.fn(),
    setStatus: vi.fn(),
    setThreeEnabled: vi.fn(),
  };
}

describe("foundation to runtime integration", () => {
  it.each(routeCases)(
    "renders $name scenes in exact registry order with complete picture fallbacks",
    ({ page, scenes }) => {
      const { container } = render(page);
      const sections = sceneSections(container);

      expect(sections.map((section) => section.dataset.sceneId)).toEqual(
        scenes,
      );
      expect(
        sections.map((section) => section.dataset.requiredLive),
      ).toEqual(
        scenes.map((sceneId) =>
          String(getSceneDefinition(sceneId).requiredLive),
        ),
      );

      for (const [index, section] of sections.entries()) {
        const scene = getSceneDefinition(scenes[index]);
        const source = section.querySelector("picture > source");
        const image = section.querySelector("picture > img");
        expect(source).toHaveAttribute("media", "(max-width: 767px)");
        expect(source).toHaveAttribute("srcset", scene.poster.mobile);
        expect(source).toHaveAttribute("width", "585");
        expect(source).toHaveAttribute("height", "1266");
        expect(image).toHaveAttribute("src", scene.poster.desktop);
        expect(image).toHaveAttribute("width", "1920");
        expect(image).toHaveAttribute("height", "1080");
        expect(image).toHaveAttribute("alt", scene.poster.alt);
      }
    },
  );

  it("registers every rendered production section exactly once", async () => {
    for (const { page, scenes } of routeCases) {
      const registerSection = vi.fn<
        SceneRuntimeContextValue["registerSection"]
      >(() => vi.fn());
      const { unmount } = render(
        <SceneRuntimeContext.Provider
          value={runtimeValue(scenes[0], registerSection)}
        >
          {page}
        </SceneRuntimeContext.Provider>,
      );

      await waitFor(() => expect(registerSection).toHaveBeenCalledTimes(scenes.length));
      expect(
        registerSection.mock.calls.map(([sceneId]) => sceneId),
      ).toEqual(scenes);
      expect(
        new Set(registerSection.mock.calls.map(([, element]) => element)).size,
      ).toBe(scenes.length);
      unmount();
    }
  });

  it("keeps poster authority in the registry and removes foundation image fields", () => {
    for (const route of routes) expect(route).not.toHaveProperty("heroPoster");
    for (const chapter of experience) {
      expect(chapter).not.toHaveProperty("poster");
      expect(chapter).not.toHaveProperty("requiredLive");
    }
    for (const project of projects) {
      expect(project).not.toHaveProperty("poster");
      expect(project).not.toHaveProperty("posterAlt");
      expect(project).not.toHaveProperty("requiredLive");
    }
  });

  it("uses full visual stages, opaque copy blocks, and one 767px breakpoint", async () => {
    const [globalCss, runtimeCss] = await Promise.all([
      readFile("app/globals.css", "utf8"),
      readFile("app/three/scene-runtime.css", "utf8"),
    ]);

    expect(globalCss).toContain("@media (max-width: 767px)");
    expect(globalCss).not.toContain("@media (max-width: 720px)");
    expect(globalCss).toMatch(
      /\.chapter-model-space\s*\{[\s\S]*?min-height:\s*calc\(100svh - var\(--nav-height\)\)/,
    );
    expect(globalCss).toMatch(
      /\.chapter-copy\s*\{[\s\S]*?background:\s*var\(--surface\)/,
    );
    expect(globalCss).not.toMatch(/\.chapter:nth-child\(even\)/);
    expect(runtimeCss).toMatch(
      /\.scene-runtime\[data-poster-ready="true"\][\s\S]*?\.scene-section\[data-scene-active="true"\][\s\S]*?>\s*\.scene-section__poster\s*\{[\s\S]*?visibility:\s*hidden/,
    );
  });
});
