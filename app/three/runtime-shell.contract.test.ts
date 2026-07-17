import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(path, "utf8");
}

function cssRule(css: string, selector: string, last = false) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...css.matchAll(new RegExp(`^\\s*${escaped} \\{`, "gm"))];
  const match = last ? matches.at(-1) : matches[0];
  const start = match?.index ?? -1;
  expect(start, `missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf("{", start);
  const bodyEnd = css.indexOf("}", bodyStart);
  expect(bodyEnd, `unclosed CSS rule: ${selector}`).toBeGreaterThan(bodyStart);
  return css.slice(bodyStart + 1, bodyEnd);
}

describe("persistent runtime shell", () => {
  it("keeps the status host client-only and lazy-loads only the WebGL canvas", async () => {
    const [boundary, canvasBoundary, host] = await Promise.all([
      source("app/three/scene-runtime-boundary.tsx"),
      source("app/three/scene-canvas-boundary.tsx"),
      source("app/three/scene-runtime-host.tsx"),
    ]);
    expect(boundary).toContain('import("./scene-runtime-host")');
    expect(boundary).toContain("ssr: false");
    expect(boundary).toContain("loading: () => null");
    expect(boundary).toContain("RuntimeSiblingErrorBoundary");
    expect(boundary).toContain("<DynamicSceneRuntimeHost />");
    expect(boundary).not.toMatch(
      /useSceneRuntime|canLoadRuntime|threeEnabled|threeSupported|sceneActivationAllowed/,
    );
    expect(canvasBoundary).toContain('import("./scene-canvas")');
    expect(canvasBoundary).toContain("lazy(");
    expect(canvasBoundary).toContain("<Suspense fallback={null}>");
    expect(host).toContain("SceneCanvasBoundary");
    expect(host).toContain("createPortal(");
    expect(host).toContain("scene-stage--resident");
    expect(host).toContain("MAX_CONNECTED_LIVE_SCENES = 8");
    expect(host).toContain('attributeFilter: ["data-required-live", "data-scene-id"]');
    expect(host).toContain('resident.stage.dataset.scenePoolState = "pooled"');
    expect(host).toContain("left.lastSeen - right.lastSeen");
    expect(host).toContain("poolElement.append(resident.stage)");
    expect(host).toContain("resident.adoptionVersion += 1");
    expect(host).toContain("data-scene-resident-pool");
    expect(host).toContain("const becameActive = active && !wasActive.current");
    expect(host).toMatch(
      /createPortal\([\s\S]*?key=\{key\}[\s\S]*?stage,\s*key,\s*\)/,
    );
    expect(host).not.toContain("runtime.activeSectionElement");
    expect(host).not.toMatch(/import\s*\{[^}]*SceneCanvas[,}]/);
  });

  it("mounts one provider and one runtime boundary in the root shell", async () => {
    const [layout, provider, shell] = await Promise.all([
      source("app/layout.tsx"),
      source("app/three/scene-provider.tsx"),
      source("components/site-shell.tsx"),
    ]);
    expect(layout.match(/<SceneProvider>/g)).toHaveLength(1);
    expect(layout.match(/<InitialDocumentLoadingScreen\s*\/>/g)).toHaveLength(1);
    expect(layout.indexOf("<InitialDocumentLoadingScreen />")).toBeLessThan(
      layout.indexOf("<SiteShell>"),
    );
    expect(provider.match(/<SceneRuntimeBoundary\s*\/>/g)).toHaveLength(1);
    expect(provider.match(/<ThreePreferenceToggle\s*\/>/g)).toHaveLength(1);
    expect(provider.indexOf("{children}")).toBeLessThan(
      provider.indexOf("<ThreePreferenceToggle />"),
    );
    expect(shell).not.toMatch(/SceneProvider|SceneRuntimeBoundary|Canvas/);
    expect(layout.indexOf('import "./globals.css"')).toBeLessThan(
      layout.indexOf('import "./three/scene-runtime.css"'),
    );
  });

  it("uses immediate poster/canvas visibility and a section-anchored host", async () => {
    const [css, globalCss] = await Promise.all([
      source("app/three/scene-runtime.css"),
      source("app/globals.css"),
    ]);
    const host = cssRule(css, ".scene-runtime");
    const stage = cssRule(globalCss, ".scene-stage");
    expect(stage).toMatch(/position:\s*absolute/);
    expect(stage).not.toMatch(/position:\s*fixed/);
    expect(host).toMatch(/position:\s*absolute/);
    expect(host).not.toMatch(/position:\s*fixed/);
    expect(host).toMatch(/inset:\s*0/);
    expect(host).toMatch(/width:\s*100%/);
    expect(host).toMatch(/height:\s*100%/);
    expect(host).toMatch(/overflow:\s*hidden/);
    expect(host).toMatch(/pointer-events:\s*none/);
    expect(host).toMatch(/z-index:\s*1/);
    expect(host).toMatch(/background:\s*var\(--scene-background\)/);

    expect(cssRule(css, ".scene-runtime__poster")).toMatch(
      /visibility:\s*visible/,
    );
    expect(css).toMatch(
      /\.scene-section\[data-required-live="true"\][\s\S]*?> \.scene-stage--resident[\s\S]*?\.scene-runtime:not\(\[data-three-status="ready"\]\):not\([\s\S]*?\[data-three-status="loading"\][\s\S]*?\)[\s\S]*?\.scene-runtime__poster\s*\{[^}]*visibility:\s*visible/,
    );
    expect(css).toMatch(
      /\.scene-runtime__canvas,\s*\.scene-runtime__resident-canvas\s*\{[^}]*visibility:\s*hidden/,
    );
    expect(css).not.toContain(".scene-runtime__transition-frame");
    expect(
      cssRule(
        css,
        '.scene-runtime[data-three-status="loading"] .scene-runtime__poster',
      ),
    ).toMatch(/visibility:\s*hidden/);
    expect(
      cssRule(
        css,
        '.scene-runtime[data-three-status="ready"] .scene-runtime__poster',
      ),
    ).toMatch(/visibility:\s*hidden/);
    expect(css).toMatch(
      /\.scene-runtime\[data-three-status="ready"\] \.scene-runtime__canvas,\s*\.scene-runtime\[data-three-status="ready"\] \.scene-runtime__resident-canvas\s*\{[^}]*visibility:\s*visible/,
    );
    expect(css).not.toContain('data-transition-poster="suppressed"');
    expect(css).toMatch(
      /\.scene-section\[data-required-live="true"\]:has\([\s\S]*?> \.scene-stage--resident \.scene-runtime\[data-three-status="ready"\][\s\S]*?> \.scene-section__poster\s*\{[^}]*visibility:\s*hidden/,
    );
    expect(css).toMatch(
      /\.scene-section\[data-required-live="true"\]:has\([\s\S]*?\.scene-runtime\[data-poster-ready="true"\][\s\S]*?> \.scene-section__poster/,
    );
    expect(css).not.toMatch(
      /body:has\(\.scene-runtime\[data-poster-ready="true"\]\)/,
    );
    expect(css).toMatch(
      /\.scene-section\[data-required-live="true"\]:has\([\s\S]*?\.scene-runtime:not\(\[data-three-status="ready"\]\):not\([\s\S]*?\[data-three-status="loading"\][\s\S]*?\):not\(\[data-poster-ready="true"\]\)[\s\S]*?> \.scene-section__poster\s*\{[^}]*visibility:\s*visible/,
    );
    expect(css).toMatch(
      /\.scene-section\[data-required-live="true"\]:has\([\s\S]*?\.scene-runtime\[data-three-status="loading"\][\s\S]*?> \.scene-section__poster\s*\{[^}]*visibility:\s*hidden/,
    );
    const pool = cssRule(css, ".scene-resident-pool");
    expect(pool).toMatch(/position:\s*fixed/);
    expect(pool).toMatch(/visibility:\s*hidden/);
    expect(pool).toMatch(/pointer-events:\s*none/);

    const rotation = cssRule(css, ".scene-runtime__rotation-area");
    expect(rotation).toMatch(/position:\s*absolute/);
    expect(rotation).toMatch(/z-index:\s*2/);
    expect(rotation).toMatch(/pointer-events:\s*auto/);
    expect(rotation).toMatch(/touch-action:\s*pan-y pinch-zoom/);

    const section = cssRule(css, ".scene-section");
    expect(section).toMatch(/z-index:\s*2/);
    expect(section).toMatch(/isolation:\s*isolate/);
    expect(section).toMatch(/pointer-events:\s*none/);
    expect(cssRule(css, ".scene-section__content")).toMatch(
      /pointer-events:\s*none/,
    );
    expect(cssRule(css, ".scroll-cue")).toMatch(/pointer-events:\s*auto/);
    expect(cssRule(css, ".site-shell__content")).toMatch(/z-index:\s*auto/);
    expect(cssRule(css, ".page-hero.scene-section")).toMatch(
      /background:\s*transparent/,
    );
    const layeredHero = cssRule(css, ".page-hero--layered.scene-section");
    expect(layeredHero).toMatch(/z-index:\s*auto/);
    expect(layeredHero).toMatch(/isolation:\s*auto/);
    expect(css).toMatch(
      /\.page-hero--layered\s+\.page-hero__copy\s*\{[^}]*z-index:\s*0/,
    );
    expect(css).toMatch(
      /body:has\(\.page-hero--layered\[data-scene-active="true"\]\) \.scene-runtime,[\s\S]*?\.chapter > \.scene-stage \.scene-runtime\s*\{[^}]*background:\s*transparent/,
    );
    expect(cssRule(css, ".model-free-surface")).toMatch(
      /background:\s*var\(--surface\)/,
    );
    const toggle = cssRule(css, ".three-preference-toggle");
    expect(toggle).toMatch(/z-index:\s*100/);
    expect(toggle).toMatch(/color:\s*#505050/);
    expect(toggle).toMatch(/background:\s*#eeeeee/);

    const mediaStart = css.indexOf("@media (max-width: 767px)");
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    const mobileRotation = cssRule(
      css.slice(mediaStart),
      ".scene-runtime__rotation-area",
    );
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(mobileRotation).toContain(
        `${side}: var(--rotation-mobile-${side})`,
      );
    }
    expect(css).not.toMatch(/transition\s*:/);
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("keeps resident canvases mounted on errors and centralizes eager preload ownership", async () => {
    const [host, canvas] = await Promise.all([
      source("app/three/scene-runtime-host.tsx"),
      source("app/three/scene-canvas.tsx"),
    ]);
    expect(host).toContain("loadEnabled={status !== \"error\"}");
    expect(host).toContain("preloadReady={status === \"ready\"}");
    expect(host).toMatch(
      /<SceneRuntimeHostView[\s\S]*?active=\{active\}[\s\S]*?showPoster/,
    );
    expect(host).toContain("clearSceneModel(scene.modelUrl)");
    expect(host).toContain("<AdjacentScenePreloader");
    expect(canvas).not.toContain("AdjacentScenePreloader");
  });
});
