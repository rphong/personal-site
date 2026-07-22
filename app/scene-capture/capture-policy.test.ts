import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isSceneCaptureEnabled } from "./capture-policy";

describe("scene capture route", () => {
  it("is available only under an explicit local or CI preview flag", () => {
    expect(
      isSceneCaptureEnabled({ SCENE_CAPTURE: "1", SITE_ENV: "preview" }),
    ).toBe(true);
    expect(isSceneCaptureEnabled({ SCENE_CAPTURE: "1" })).toBe(false);
    expect(isSceneCaptureEnabled({ SCENE_CAPTURE: "0" })).toBe(false);
    expect(isSceneCaptureEnabled({})).toBe(false);
    expect(
      isSceneCaptureEnabled({
        SCENE_CAPTURE: "1",
        SITE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isSceneCaptureEnabled({ SCENE_CAPTURE: "1", NODE_ENV: "production" }),
    ).toBe(false);
    expect(
      isSceneCaptureEnabled({
        SCENE_CAPTURE: "1",
        NODE_ENV: "production",
        SITE_ENV: "preview",
      }),
    ).toBe(true);
  });

  it("is noindex and validates its scene query against the registry", async () => {
    const [page, loading] = await Promise.all([
      readFile("app/scene-capture/page.tsx", "utf8"),
      readFile("app/scene-capture/loading.tsx", "utf8"),
    ]);
    expect(page).toContain("robots: { index: false, follow: false }");
    expect(page).toContain("isSceneId(sceneValue)");
    expect(page).toContain("notFound()");
    expect(page).toContain('dynamic = "force-dynamic"');
    expect(page).toContain("export async function SceneCaptureContent");
    expect(page).toContain("<SceneCaptureContent searchParams={searchParams} />");
    expect(loading).toContain("SceneCaptureLoading");
    expect(loading).toContain("return null");
  });

  it("forces a registered capture section without exposing visual controls", async () => {
    const viewport = await readFile(
      "app/scene-capture/scene-capture-viewport.tsx",
      "utf8",
    );
    expect(viewport).toContain("<SceneSection");
    expect(viewport).toContain("forceActive");
    expect(viewport).toContain("scene.nextSceneId ?? \"home-hero\"");
    expect(viewport).toContain('data-capture-controls={showControls ? "true" : "false"}');
  });

  it("keeps ordinary browser tests preview-safe and poster capture opt-in", async () => {
    const [playwright, vite] = await Promise.all([
      readFile("playwright.config.ts", "utf8"),
      readFile("vite.config.ts", "utf8"),
    ]);
    expect(playwright).toContain("testIgnore: process.env.POSTER_CAPTURE_MODE");
    expect(playwright).toContain(
      'process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1"',
    );
    expect(playwright).toContain('NODE_ENV: "development"');
    expect(playwright).toContain('const serverHostname = "127.0.0.1"');
    expect(playwright).toContain('NEXT_PUBLIC_SITE_ENV: "preview"');
    expect(playwright).toContain('SITE_ENV: "preview"');
    expect(playwright).toContain('"--use-gl=angle"');
    expect(playwright).toContain('"--use-angle=swiftshader"');
    expect(playwright).toContain('"--enable-unsafe-swiftshader"');
    expect(vite).toContain(
      'SCENE_CAPTURE: process.env.SCENE_CAPTURE ?? "0"',
    );
    expect(vite).toContain('SITE_ENV: process.env.SITE_ENV ?? ""');
  });
});
