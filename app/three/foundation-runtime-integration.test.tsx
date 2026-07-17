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

  it("uses integrated chapter grids, project arches, and one 767px breakpoint", async () => {
    const [globalCss, runtimeCss] = await Promise.all([
      readFile("app/globals.css", "utf8"),
      readFile("app/three/scene-runtime.css", "utf8"),
    ]);

    expect(globalCss).toContain("@media (max-width: 767px)");
    expect(globalCss).not.toContain("@media (max-width: 720px)");
    expect(globalCss).toMatch(
      /\.chapter-layout--experience\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(19rem, 0\.42fr\) minmax\(0, 0\.58fr\)/,
    );
    expect(globalCss).toMatch(
      /\.chapter-layout--project\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:/,
    );
    expect(globalCss).toMatch(
      /\.project-chapter::before\s*\{[\s\S]*?border-radius:\s*50% 50% 0 0 \/ var\(--project-arch-rise\)[\s\S]*?background:\s*var\(--surface\)/,
    );
    expect(globalCss).toMatch(
      /\.project-chapter > \.scene-stage\s*\{[\s\S]*?width:\s*100%;[\s\S]*?border-radius:\s*0/,
    );
    expect(globalCss).toMatch(
      /\.experience-chapter--poster > \.scene-stage\s*\{[\s\S]*?display:\s*none/,
    );
    expect(globalCss).toMatch(
      /section\.experience-chapter--poster\[data-scene-active="true"\][\s\S]*?> \.scene-section__poster[\s\S]*?visibility:\s*visible/,
    );
    expect(globalCss).toMatch(
      /\.experience-chapter:not\(\.experience-chapter--poster\)[\s\S]*?> \.scene-section__poster,[\s\S]*?\.project-chapter > \.scene-section__poster\s*\{[\s\S]*?visibility:\s*hidden/,
    );
    expect(globalCss).toMatch(
      /\.project-chapter > \.scene-stage \.scene-runtime__poster,[\s\S]*?visibility:\s*hidden/,
    );
    expect(globalCss).toMatch(
      /data-three-status="disabled"[\s\S]*?section\.chapter\[data-scene-active="true"\][\s\S]*?visibility:\s*visible/,
    );
    expect(globalCss).not.toMatch(/\.chapter:nth-child\(even\)/);
    expect(runtimeCss).toMatch(
      /\.scene-runtime\s*\{[\s\S]*?height:\s*100%;[\s\S]*?background:\s*var\(--scene-background\)/,
    );
    expect(runtimeCss).toMatch(
      /body:has\(\.chapter\[data-scene-active="true"\]\) \.scene-runtime,[\s\S]*?\.chapter > \.scene-stage \.scene-runtime\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(runtimeCss).toMatch(
      /\.scene-section\[data-required-live="true"\]:has\([\s\S]*?>\s*\.scene-stage--resident\s+\.scene-runtime\[data-poster-ready="true"\][\s\S]*?\)[\s\S]*?>\s*\.scene-section__poster[\s\S]*?\{[\s\S]*?visibility:\s*hidden/,
    );
    expect(runtimeCss).toMatch(
      /\.scene-section\[data-required-live="true"\]:has\([\s\S]*?\.scene-runtime:not\(\[data-three-status="ready"\]\)[\s\S]*?\)[\s\S]*?>\s*\.scene-section__poster[\s\S]*?\{[\s\S]*?visibility:\s*visible/,
    );
  });
});
