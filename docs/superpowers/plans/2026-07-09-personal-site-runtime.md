# Persistent Three.js Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one resilient, poster-first, full-viewport Three.js runtime that persists across routes, activates registered sections, and keeps every page complete when 3D cannot run.

**Architecture:** Server-rendered pages place `SceneSection` markers and deterministic posters in normal document flow, while the root layout mounts one client provider and one dynamically imported fixed R3F canvas behind the HTML. The canvas stays alpha-transparent so the exact route color is the visible ground; curated GLBs contain no authored receiver plane, and one low-resolution transparent contact shadow supplies optional grounding without a finite colored floor. A typed registry owns scene composition, a shared observer owns activation, and small pure modules own preference, rotation, preloading, and zero-network runtime events so each contract can be tested without WebGL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Three.js 0.185.1, React Three Fiber 9.6.1, Drei 10.7.7, MeshoptDecoder, Vitest, Testing Library, React Three Test Renderer 9.1.0, Playwright Chromium.

---

## Scope and execution rules

- Execute this plan in an isolated worktree created with `superpowers:using-git-worktrees`.
- Follow red-green-refactor exactly. A behavioral implementation step begins only after its named test fails for the expected reason.
- The eight required live IDs are immutable: `home-hero`, `experience-hero`, `experience-intro`, `nasa-rocket`, `projects-hero`, `league-ban`, `froggie-adventures`, and `contact-hero`.
- `SceneSection` always renders `data-scene-id="<id>"`. Release checks use that hook.
- The runtime host always owns `data-three-status` with one of `poster|loading|ready|error|unsupported|disabled|context-lost`, plus `data-active-scene-id`.
- The drag surface always owns `data-testid="scene-rotation-area"` and `touch-action: pan-y pinch-zoom`.
- Route-hero and active-host posters use eager/high fetch priority; offscreen feature posters keep SSR markup but use native lazy loading.
- The first successful frame calls `performance.mark("scene-ready:<sceneId>")` through `emitSceneRuntimeEvent`. The event module dispatches only local `ready`, `failure`, `context-lost`, and `rotation-health` details on `site:scene-runtime` and performs no network work.
- Runtime asset paths in the registry are the handoff contract for the asset-pipeline plan. Browser tests intercept them with a valid deterministic glTF document, so this runtime plan remains testable before production GLBs arrive.
- Never set `scene.background` or mount opaque ground geometry. Keep `gl.alpha=true`, preserve the CSS-bound route background, and use only the demand-rendered low-resolution `ContactShadows` layer. If it cannot meet placement/performance gates, omit it.
- Do not add route transitions, animation playback, orbit controls, camera zoom
  or pan, selection, physics, post-processing, or engagement tracking. Browser
  page zoom remains available.

## Focused file map

### Runtime contracts and pure policy

- Create `app/three/types.ts` — stable scene/status/rotation/camera/light types.
- Create `app/three/scene-registry.ts` — all live and poster-only scene definitions, route heroes, and adjacent preload policy.
- Create `app/three/runtime-events.ts` — zero-network local event seam and ready performance mark.
- Create `app/three/three-preference.ts` — WebGL 2 detection, local-only preference, and reduced-data default.
- Create `app/three/rotation.ts` — degree-based delta application and clamps.

### Persistent client shell and section activation

- Create `app/three/scene-runtime-context.tsx` — narrow provider interface.
- Create `app/three/scene-provider.tsx` — route reset, shared IntersectionObserver, active scene, status, rotation, and preference state.
- Create `app/three/scene-poster.tsx` — deterministic desktop/mobile poster markup.
- Create `app/three/scene-section.tsx` — server-prerenderable section registration and stable DOM hook.
- Create `app/three/scene-runtime-boundary.tsx` — `next/dynamic` boundary with SSR disabled only for the WebGL host.
- Create `app/three/three-preference-toggle.tsx` — persistent keyboard-accessible local preference control.
- Modify `app/layout.tsx` — mount exactly one persistent `SceneProvider` around route content.
- Create `app/three/scene-runtime.css` — fixed `100svh` host, poster/canvas swap, bounded input surface, and capture styling.

### R3F rendering and resource policy

- Create `app/three/scene-rotation-area.tsx` — bounded pointer/touch delta forwarding.
- Create `app/three/normalized-scene-root.tsx` — rotate the complete authored root and invalidate demand rendering.
- Create `app/three/scene-loader.ts` — GLTFLoader configured with the bundled Meshopt decoder.
- Create `app/three/adjacent-scene-preloader.tsx` — let the current model load normally, then idle-preload at most its immediate next neighbor.
- Create `app/three/scene-model.tsx` — clone one normalized root and dispose instance-owned resources.
- Create `app/three/scene-error-boundary.tsx` — turn load/decode failures into poster fallback.
- Create `app/three/scene-canvas.tsx` — the sole alpha-transparent demand-loop R3F canvas, registry camera/lights, low-resolution contact shadow, first-frame reporting, and context lifecycle.
- Create `app/three/scene-runtime-host.tsx` — poster-first state machine and stable non-content DOM hooks.

### Capture and tests

- Create `app/scene-capture/capture-policy.ts` — production gate for the render-only route.
- Create `app/scene-capture/scene-capture-viewport.tsx` — force a registry scene and expose a hidden next-scene link.
- Create `app/scene-capture/page.tsx` — noindex, environment-gated deterministic capture route.
- Modify `vitest.config.ts` and `tests/setup.ts` — extend the foundation component harness for runtime/R3F tests.
- Create `playwright.config.ts` — Chromium browser harness with capture route enabled.
- Create focused tests under `app/three/*.test.ts(x)`, `app/scene-capture/*.test.ts`, and `tests/browser/three-runtime.spec.ts`.
- Modify `package.json` and `package-lock.json` — approved runtime versions and reproducible test commands.

## Task 1: Pin dependencies and establish the runtime type contract

> **Implementation amendment (2026-07-11):** The React act-environment test
> property must be writable. Testing Library 16.3 assigns that flag around
> render and cleanup; the original non-writable descriptor makes every existing
> component test fail before rendering. The stable scene type is also a
> discriminated union: live IDs require a `/models/*.glb` URL, EOG and Paycom
> require `null`, and `castShadow` is the literal `false` required by the v1
> no-shadow-map contract. Runtime scale is intentionally omitted because the
> asset contract exports one normalized root and registry camera framing owns
> composition. The shared Node engine is narrowed to `^22.15.0 || >=24.0.0`
> because Vitest 4 excludes Node 23 even though the asset minimum alone did not.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `playwright.config.ts`
- Modify: `tests/setup.ts`
- Create: `app/three/types.test.ts`
- Create: `app/three/types.ts`

- [ ] **Step 1: Install the approved runtime and test packages**

Run:

```bash
npm install --save-exact three@0.185.1 @react-three/fiber@9.6.1 @react-three/drei@10.7.7
npm install --save-dev --save-exact @react-three/test-renderer@9.1.0 @testing-library/user-event@14.6.1 @playwright/test@1.61.1
```

Expected: both commands exit 0; `package-lock.json` records the exact approved Three/R3F versions.

- [ ] **Step 2: Add narrow test scripts to `package.json`**

Add these keys to the existing `scripts` object without changing the current `dev`, `build`, `start`, `test`, `lint`, or database commands:

```json
{
"test:browser": "playwright test tests/browser/three-runtime.spec.ts",
"test:runtime": "npm run test:unit && npm run test:browser"
}
```

Expected: `npm pkg get scripts.test:browser scripts.test:runtime` prints both exact commands above. A later plan may append `-- tests/browser/accessibility.spec.ts`; bare `npm run test:browser` never discovers the poster-capture-only spec.

- [ ] **Step 3: Create the Vitest DOM setup**

Replace `vitest.config.ts` with the foundation-preserving merged configuration:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.{ts,tsx}",
      "app/three/**/*.test.{ts,tsx}",
      "app/scene-capture/**/*.test.{ts,tsx}",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
```

Update the existing imports in `tests/setup.ts` exactly; keep its `next/image` and `next/link` mocks unchanged:

```diff
 import "@testing-library/jest-dom/vitest";
+import { cleanup } from "@testing-library/react";
 import type * as ReactTypes from "react";
-import { vi } from "vitest";
+import { afterEach, vi } from "vitest";
```

Append these lifecycle helpers after the existing mocks:

```ts
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

if (!("ResizeObserver" in globalThis)) {
  class TestResizeObserver implements ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: TestResizeObserver,
  });
}

afterEach(() => cleanup());
```

- [ ] **Step 4: Create the Playwright harness**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  snapshotPathTemplate:
    "{testDir}/visual-regression.spec.ts-snapshots/{arg}{ext}",
  testIgnore: process.env.POSTER_CAPTURE_MODE
    ? []
    : ["**/poster-capture.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: [
            "--enable-webgl",
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer:
      process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1",
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_ENV: "preview",
      SCENE_CAPTURE: "1",
      SITE_ENV: "preview",
    },
  },
});
```

- [ ] **Step 5: Write the failing status/type test**

Create `app/three/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { THREE_STATUSES } from "./types";

describe("THREE_STATUSES", () => {
  it("exposes the complete stable host status contract", () => {
    expect(THREE_STATUSES).toEqual([
      "poster",
      "loading",
      "ready",
      "error",
      "unsupported",
      "disabled",
      "context-lost",
    ]);
  });
});
```

- [ ] **Step 6: Run the test to verify RED**

Run: `npm run test:unit -- app/three/types.test.ts`

Expected: FAIL with `Failed to resolve import "./types"`.

- [ ] **Step 7: Implement the complete type contract**

Create `app/three/types.ts`:

```ts
export const THREE_STATUSES = [
  "poster",
  "loading",
  "ready",
  "error",
  "unsupported",
  "disabled",
  "context-lost",
] as const;

export type ThreeStatus = (typeof THREE_STATUSES)[number];

export type SceneId =
  | "home-hero"
  | "experience-hero"
  | "experience-intro"
  | "nasa-rocket"
  | "eog-poster"
  | "paycom-poster"
  | "projects-hero"
  | "league-ban"
  | "froggie-adventures"
  | "contact-hero";

export type SiteRoute = "/" | "/experience" | "/projects" | "/contact";

export type Vector3Tuple = readonly [x: number, y: number, z: number];

export interface SceneRotation {
  readonly yaw: number;
  readonly pitch: number;
}

export interface RotationLimits {
  readonly yaw: readonly [min: number, max: number];
  readonly pitch: readonly [min: number, max: number];
  readonly default: SceneRotation;
  readonly degreesPerPixel: number;
}

export interface PercentInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface SceneFrame {
  readonly cameraPosition: Vector3Tuple;
  readonly cameraTarget: Vector3Tuple;
  readonly fov: number;
  readonly rotationArea: PercentInsets;
}

export interface SceneLighting {
  readonly ambient: {
    readonly color: string;
    readonly intensity: number;
  };
  readonly key: {
    readonly color: string;
    readonly intensity: number;
    readonly position: Vector3Tuple;
    readonly castShadow: boolean;
  };
}

export interface ScenePosterDefinition {
  readonly desktop: string;
  readonly mobile: string;
  readonly alt: "";
}

export interface SceneDefinition {
  readonly id: SceneId;
  readonly label: string;
  readonly route: SiteRoute;
  readonly background: string;
  readonly requiredLive: boolean;
  readonly modelUrl: string | null;
  readonly poster: ScenePosterDefinition;
  readonly desktop: SceneFrame;
  readonly mobile: SceneFrame;
  readonly lighting: SceneLighting;
  readonly rotation: RotationLimits;
  readonly nextSceneId: SceneId | null;
}

export type SceneFailureReason =
  | "fetch"
  | "decode"
  | "timeout"
  | "webgl2-unavailable"
  | "context-lost"
  | "unknown";
```

- [ ] **Step 8: Run the focused test to verify GREEN**

Run: `npm run test:unit -- app/three/types.test.ts`

Expected: PASS, `1 passed`.

- [ ] **Step 9: Refactor and verify package integrity**

Run:

```bash
npm pkg get dependencies.three dependencies.@react-three/fiber dependencies.@react-three/drei devDependencies.@react-three/test-renderer
npm run test:unit -- app/three/types.test.ts
```

Expected: versions print as `0.185.1`, `9.6.1`, `10.7.7`, and `9.1.0`; the focused test remains green.

- [ ] **Step 10: Commit the toolchain and type contract**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/setup.ts app/three/types.ts app/three/types.test.ts
git commit -m "test: establish three runtime contract"
```

## Task 2: Define the complete scene registry and adjacent preload policy

> **Implementation amendment (2026-07-11):** Registry tests independently
> bind the literal ten-scene order, adjacency chain, and scene-to-model map in
> addition to checking the two generated manifests. `LIVE_SCENE_IDS` and route
> heroes use `LiveSceneId`, every key light keeps `castShadow: false`, and both
> poster-only scenes return an empty preload list instead of crossing into a
> later live scene.

**Files:**
- Create: `app/three/scene-registry.test.ts`
- Create: `app/three/registry-assets.contract.test.ts`
- Create: `app/three/scene-registry.ts`

- [ ] **Step 1: Write the failing registry tests**

Create `app/three/scene-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getRouteHeroSceneId,
  getSceneDefinition,
  getScenePreloadUrls,
  isSceneId,
  LIVE_SCENE_IDS,
  SCENE_DEFINITIONS,
} from "./scene-registry";

describe("scene registry", () => {
  it("uses the eight immutable live section IDs", () => {
    expect(LIVE_SCENE_IDS).toEqual([
      "home-hero",
      "experience-hero",
      "experience-intro",
      "nasa-rocket",
      "projects-hero",
      "league-ban",
      "froggie-adventures",
      "contact-hero",
    ]);
  });

  it("gives every live scene a model, posters, framing, light, and bounded rotation", () => {
    for (const id of LIVE_SCENE_IDS) {
      const scene = getSceneDefinition(id);
      expect(scene.requiredLive).toBe(true);
      expect(scene.modelUrl).toMatch(/^\/models\/.+\.glb$/);
      expect(scene.poster.desktop).toMatch(/^\/posters\/.+-desktop\.webp$/);
      expect(scene.poster.mobile).toMatch(/^\/posters\/.+-mobile\.webp$/);
      for (const frame of [scene.desktop, scene.mobile]) {
        expect(frame.cameraPosition).toHaveLength(3);
        expect(frame.cameraTarget).toHaveLength(3);
        expect(frame.fov).toBeGreaterThan(0);
        expect(frame.fov).toBeLessThanOrEqual(120);
        for (const inset of Object.values(frame.rotationArea)) {
          expect(Number.isFinite(inset)).toBe(true);
          expect(inset).toBeGreaterThanOrEqual(0);
          expect(inset).toBeLessThanOrEqual(100);
        }
        expect(frame.rotationArea.top + frame.rotationArea.bottom).toBeLessThan(100);
        expect(frame.rotationArea.left + frame.rotationArea.right).toBeLessThan(100);
      }
      expect(scene.lighting.ambient.intensity).toBeGreaterThan(0);
      expect(scene.lighting.ambient.color).toMatch(/^#[A-Fa-f0-9]{6}$/);
      expect(scene.lighting.key.intensity).toBeGreaterThan(0);
      expect(scene.lighting.key.color).toMatch(/^#[A-Fa-f0-9]{6}$/);
      expect(scene.lighting.key.position).toHaveLength(3);
      expect(scene.lighting.key.castShadow).toEqual(expect.any(Boolean));
      expect(scene.rotation.yaw[0]).toBeGreaterThanOrEqual(-25);
      expect(scene.rotation.yaw[1]).toBeLessThanOrEqual(25);
      expect(scene.rotation.pitch[0]).toBeGreaterThanOrEqual(-8);
      expect(scene.rotation.pitch[1]).toBeLessThanOrEqual(8);
    }
  });

  it("keeps EOG and Paycom intentionally poster-only", () => {
    expect(getSceneDefinition("eog-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("eog-poster").requiredLive).toBe(false);
    expect(getSceneDefinition("paycom-poster").modelUrl).toBeNull();
    expect(getSceneDefinition("paycom-poster").requiredLive).toBe(false);
  });

  it("maps each real route to its destination hero", () => {
    expect(getRouteHeroSceneId("/")).toBe("home-hero");
    expect(getRouteHeroSceneId("/experience")).toBe("experience-hero");
    expect(getRouteHeroSceneId("/projects")).toBe("projects-hero");
    expect(getRouteHeroSceneId("/contact")).toBe("contact-hero");
  });

  it("preloads no more than current plus the immediate next model", () => {
    expect(getScenePreloadUrls("home-hero")).toEqual([
      "/models/crane.glb",
      "/models/crane-workout.glb",
    ]);
    expect(getScenePreloadUrls("experience-intro")).toEqual([
      "/models/crane-throwing-plane.glb",
      "/models/rocket.glb",
    ]);
    expect(getScenePreloadUrls("eog-poster")).toEqual([]);
    expect(getScenePreloadUrls("league-ban")).toEqual([
      "/models/crane-on-league.glb",
      "/models/froggie-display.glb",
    ]);
    for (const scene of Object.values(SCENE_DEFINITIONS)) {
      expect(getScenePreloadUrls(scene.id).length).toBeLessThanOrEqual(2);
    }
  });

  it("validates capture-route scene parameters", () => {
    expect(isSceneId("nasa-rocket")).toBe(true);
    expect(isSceneId("not-a-scene")).toBe(false);
  });
});
```

Create `app/three/registry-assets.contract.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { SCENE_DEFINITIONS } from "./scene-registry";

interface PosterContract {
  readonly scenes: readonly {
    readonly id: string;
    readonly route: string;
    readonly background: string;
    readonly source:
      | { readonly kind: "web-scene"; readonly modelKey: string }
      | { readonly kind: "svg"; readonly path: string };
    readonly outputs: Readonly<Record<"desktop" | "mobile", string>>;
  }[];
}

interface ModelManifest {
  readonly models: Readonly<Record<string, { readonly url: string }>>;
}

function publicOutputToUrl(output: string): string {
  expect(output).toMatch(/^public\/posters\/.+\.webp$/);
  return `/${output.replace(/^public\//, "")}`;
}

describe("registry asset ownership", () => {
  it("matches every registry scene to the poster and model manifests", async () => {
    const [contract, manifest] = (await Promise.all([
      readFile("assets/poster-contract.json", "utf8").then((source) =>
        JSON.parse(source),
      ),
      readFile("public/models/assets-manifest.json", "utf8").then((source) =>
        JSON.parse(source),
      ),
    ])) as [PosterContract, ModelManifest];

    expect(contract.scenes.map((scene) => scene.id)).toEqual(
      Object.keys(SCENE_DEFINITIONS),
    );

    for (const contractScene of contract.scenes) {
      const scene =
        SCENE_DEFINITIONS[
          contractScene.id as keyof typeof SCENE_DEFINITIONS
        ];
      expect(scene.route).toBe(contractScene.route);
      expect(scene.background).toBe(contractScene.background);
      expect(scene.poster.desktop).toBe(
        publicOutputToUrl(contractScene.outputs.desktop),
      );
      expect(scene.poster.mobile).toBe(
        publicOutputToUrl(contractScene.outputs.mobile),
      );

      if (contractScene.source.kind === "web-scene") {
        const model = manifest.models[contractScene.source.modelKey];
        if (!model) {
          throw new Error(`${contractScene.id}: missing manifest model`);
        }
        expect(scene.modelUrl).toBe(model.url);
        expect(scene.requiredLive).toBe(true);
      } else {
        expect(scene.modelUrl).toBeNull();
        expect(scene.requiredLive).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run the registry test to verify RED**

Run: `npm run test:unit -- app/three/scene-registry.test.ts app/three/registry-assets.contract.test.ts`

Expected: FAIL with `Failed to resolve import "./scene-registry"`.

- [ ] **Step 3: Implement registry helpers and shared composition defaults**

Create `app/three/scene-registry.ts` with this complete content:

```ts
import type {
  PercentInsets,
  RotationLimits,
  SceneDefinition,
  SceneFrame,
  SceneId,
  SceneLighting,
  SiteRoute,
  Vector3Tuple,
} from "./types";

export const LIVE_SCENE_IDS = [
  "home-hero",
  "experience-hero",
  "experience-intro",
  "nasa-rocket",
  "projects-hero",
  "league-ban",
  "froggie-adventures",
  "contact-hero",
] as const satisfies readonly SceneId[];

const DEFAULT_ROTATION: RotationLimits = {
  yaw: [-25, 25],
  pitch: [-8, 8],
  default: { yaw: 0, pitch: 0 },
  degreesPerPixel: 0.14,
};

const DESKTOP_AREA: PercentInsets = { top: 12, right: 8, bottom: 12, left: 42 };
const MOBILE_AREA: PercentInsets = { top: 8, right: 8, bottom: 48, left: 8 };

function frame(
  cameraPosition: Vector3Tuple,
  cameraTarget: Vector3Tuple,
  fov: number,
  rotationArea: PercentInsets,
): SceneFrame {
  return { cameraPosition, cameraTarget, fov, rotationArea };
}

function lighting(background: string, position: Vector3Tuple): SceneLighting {
  return {
    ambient: { color: "#ffffff", intensity: 1.2 },
    key: {
      color: background,
      intensity: 2.4,
      position,
      castShadow: false,
    },
  };
}

export const SCENE_DEFINITIONS = {
  "home-hero": {
    id: "home-hero",
    label: "Origami crane home scene",
    route: "/",
    background: "#9ECCC0",
    requiredLive: true,
    modelUrl: "/models/crane.glb",
    poster: {
      desktop: "/posters/home-hero-desktop.webp",
      mobile: "/posters/home-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([4.2, 2.7, 6.8], [0, 0.8, 0], 34, DESKTOP_AREA),
    mobile: frame([3.8, 3.2, 8.6], [0, 1.2, 0], 38, MOBILE_AREA),
    lighting: lighting("#9ECCC0", [4, 6, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "experience-hero",
  },
  "experience-hero": {
    id: "experience-hero",
    label: "Workout crane experience scene",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: true,
    modelUrl: "/models/crane-workout.glb",
    poster: {
      desktop: "/posters/experience-hero-desktop.webp",
      mobile: "/posters/experience-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([5.8, 3.2, 7.4], [0, 0.9, 0], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0, 1.4, 0], 40, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [5, 7, 4]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "experience-intro",
  },
  "experience-intro": {
    id: "experience-intro",
    label: "Crane throwing a paper plane",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: true,
    modelUrl: "/models/crane-throwing-plane.glb",
    poster: {
      desktop: "/posters/experience-intro-desktop.webp",
      mobile: "/posters/experience-intro-mobile.webp",
      alt: "",
    },
    desktop: frame([5.4, 3.1, 7.8], [0, 1, 0], 35, DESKTOP_AREA),
    mobile: frame([4.8, 4, 9.8], [0, 1.4, 0], 39, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [4, 6, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "nasa-rocket",
  },
  "nasa-rocket": {
    id: "nasa-rocket",
    label: "NASA rocket scene",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: true,
    modelUrl: "/models/rocket.glb",
    poster: {
      desktop: "/posters/nasa-rocket-desktop.webp",
      mobile: "/posters/nasa-rocket-mobile.webp",
      alt: "",
    },
    desktop: frame([5.8, 3.8, 8.2], [0, 1.5, 0], 34, DESKTOP_AREA),
    mobile: frame([5, 4.7, 10.6], [0, 2, 0], 39, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [6, 8, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "eog-poster",
  },
  "eog-poster": {
    id: "eog-poster",
    label: "EOG Resources poster",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: false,
    modelUrl: null,
    poster: {
      desktop: "/posters/eog-poster-desktop.webp",
      mobile: "/posters/eog-poster-mobile.webp",
      alt: "",
    },
    desktop: frame([0, 0, 5], [0, 0, 0], 35, DESKTOP_AREA),
    mobile: frame([0, 0, 6], [0, 0, 0], 40, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [4, 6, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "paycom-poster",
  },
  "paycom-poster": {
    id: "paycom-poster",
    label: "Paycom poster",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: false,
    modelUrl: null,
    poster: {
      desktop: "/posters/paycom-poster-desktop.webp",
      mobile: "/posters/paycom-poster-mobile.webp",
      alt: "",
    },
    desktop: frame([0, 0, 5], [0, 0, 0], 35, DESKTOP_AREA),
    mobile: frame([0, 0, 6], [0, 0, 0], 40, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [4, 6, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "projects-hero",
  },
  "projects-hero": {
    id: "projects-hero",
    label: "Crane making table project scene",
    route: "/projects",
    background: "#AFD4E1",
    requiredLive: true,
    modelUrl: "/models/crane-making-table.glb",
    poster: {
      desktop: "/posters/projects-hero-desktop.webp",
      mobile: "/posters/projects-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([6.2, 3.6, 8.4], [0, 1, 0], 36, DESKTOP_AREA),
    mobile: frame([5.5, 4.4, 10.8], [0, 1.5, 0], 40, MOBILE_AREA),
    lighting: lighting("#AFD4E1", [5, 7, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "league-ban",
  },
  "league-ban": {
    id: "league-ban",
    label: "League Ban Site workstation scene",
    route: "/projects",
    background: "#AFD4E1",
    requiredLive: true,
    modelUrl: "/models/crane-on-league.glb",
    poster: {
      desktop: "/posters/league-ban-desktop.webp",
      mobile: "/posters/league-ban-mobile.webp",
      alt: "",
    },
    desktop: frame([6.6, 4, 8.8], [0, 1.1, 0], 35, DESKTOP_AREA),
    mobile: frame([5.8, 4.8, 11.2], [0, 1.5, 0], 40, MOBILE_AREA),
    lighting: lighting("#AFD4E1", [5, 7, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "froggie-adventures",
  },
  "froggie-adventures": {
    id: "froggie-adventures",
    label: "Froggie Adventures display scene",
    route: "/projects",
    background: "#AFD4E1",
    requiredLive: true,
    modelUrl: "/models/froggie-display.glb",
    poster: {
      desktop: "/posters/froggie-adventures-desktop.webp",
      mobile: "/posters/froggie-adventures-mobile.webp",
      alt: "",
    },
    desktop: frame([5.8, 3.5, 7.8], [0, 1, 0], 35, DESKTOP_AREA),
    mobile: frame([5.1, 4.3, 10.2], [0, 1.4, 0], 40, MOBILE_AREA),
    lighting: lighting("#AFD4E1", [5, 7, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "contact-hero",
  },
  "contact-hero": {
    id: "contact-hero",
    label: "Workout crane contact scene",
    route: "/contact",
    background: "#C9BAE4",
    requiredLive: true,
    modelUrl: "/models/crane-workout.glb",
    poster: {
      desktop: "/posters/contact-hero-desktop.webp",
      mobile: "/posters/contact-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([5.8, 3.2, 7.4], [0, 0.9, 0], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0, 1.4, 0], 40, MOBILE_AREA),
    lighting: lighting("#C9BAE4", [5, 7, 4]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: null,
  },
} as const satisfies Record<SceneId, SceneDefinition>;

const SCENE_IDS = Object.keys(SCENE_DEFINITIONS) as SceneId[];

const ROUTE_HEROES: Record<SiteRoute, SceneId> = {
  "/": "home-hero",
  "/experience": "experience-hero",
  "/projects": "projects-hero",
  "/contact": "contact-hero",
};

export function isSceneId(value: string): value is SceneId {
  return SCENE_IDS.includes(value as SceneId);
}

export function getSceneDefinition(sceneId: SceneId): SceneDefinition {
  return SCENE_DEFINITIONS[sceneId];
}

export function getRouteHeroSceneId(pathname: string): SceneId {
  return ROUTE_HEROES[pathname as SiteRoute] ?? "home-hero";
}

export function getScenePreloadUrls(sceneId: SceneId): readonly string[] {
  const current = getSceneDefinition(sceneId);
  const next = current.nextSceneId
    ? getSceneDefinition(current.nextSceneId)
    : null;
  return [...new Set([current.modelUrl, next?.modelUrl].filter(Boolean))] as string[];
}
```

- [ ] **Step 4: Run the registry test to verify GREEN**

Run: `npm run test:unit -- app/three/scene-registry.test.ts app/three/registry-assets.contract.test.ts`

Expected: PASS, `2 test files passed`, `7 tests passed`.

- [ ] **Step 5: Refactor by running the type and registry tests together**

Run: `npm run test:unit -- app/three/types.test.ts app/three/scene-registry.test.ts app/three/registry-assets.contract.test.ts`

Expected: PASS, `3 test files passed`, `8 tests passed`.

- [ ] **Step 6: Commit the scene contract**

```bash
git add app/three/scene-registry.ts app/three/scene-registry.test.ts app/three/registry-assets.contract.test.ts
git commit -m "feat: define persistent scene registry"
```

## Task 3: Add the zero-network runtime event seam

**Files:**
- Create: `app/three/runtime-events.test.ts`
- Create: `app/three/runtime-events.ts`

- [ ] **Step 1: Write the failing local-event tests**

Create `app/three/runtime-events.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emitSceneRuntimeEvent,
  SCENE_RUNTIME_EVENT_NAME,
} from "./runtime-events";

describe("emitSceneRuntimeEvent", () => {
  beforeEach(() => {
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("marks and dispatches the first ready-frame detail locally", () => {
    const listener = vi.fn();
    window.addEventListener(SCENE_RUNTIME_EVENT_NAME, listener);

    emitSceneRuntimeEvent({
      status: "ready",
      sceneId: "home-hero",
      durationMs: 420,
    });

    expect(performance.mark).toHaveBeenCalledWith("scene-ready:home-hero");
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      status: "ready",
      sceneId: "home-hero",
      durationMs: 420,
    });
  });

  it("dispatches a coded failure without marking ready", () => {
    const listener = vi.fn();
    window.addEventListener(SCENE_RUNTIME_EVENT_NAME, listener);

    emitSceneRuntimeEvent({
      status: "failure",
      sceneId: "league-ban",
      reason: "fetch",
      durationMs: 900,
    });

    expect(performance.mark).not.toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      status: "failure",
      sceneId: "league-ban",
      reason: "fetch",
    });
  });

  it("dispatches rotation frame health without a ready mark", () => {
    const listener = vi.fn();
    window.addEventListener(SCENE_RUNTIME_EVENT_NAME, listener);

    emitSceneRuntimeEvent({
      status: "rotation-health",
      sceneId: "froggie-adventures",
      fps: 47,
    });

    expect(performance.mark).not.toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      status: "rotation-health",
      sceneId: "froggie-adventures",
      fps: 47,
    });
  });

  it("never performs network work", () => {
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: beaconSpy,
    });

    emitSceneRuntimeEvent({
      status: "context-lost",
      sceneId: "nasa-rocket",
      reason: "context-lost",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the event test to verify RED**

Run: `npm run test:unit -- app/three/runtime-events.test.ts`

Expected: FAIL with `Failed to resolve import "./runtime-events"`.

- [ ] **Step 3: Implement the typed event seam**

Create `app/three/runtime-events.ts`:

```ts
import type { SceneFailureReason, SceneId } from "./types";

export const SCENE_RUNTIME_EVENT_NAME = "site:scene-runtime";

export type SceneRuntimeEventDetail =
  | {
      readonly status: "ready";
      readonly sceneId: SceneId;
      readonly durationMs: number;
    }
  | {
      readonly status: "failure";
      readonly sceneId: SceneId;
      readonly reason: SceneFailureReason;
      readonly durationMs: number;
    }
  | {
      readonly status: "context-lost";
      readonly sceneId: SceneId;
      readonly reason: "context-lost";
    }
  | {
      readonly status: "rotation-health";
      readonly sceneId: SceneId;
      readonly fps: number;
    };

declare global {
  interface WindowEventMap {
    "site:scene-runtime": CustomEvent<SceneRuntimeEventDetail>;
  }
}

export function emitSceneRuntimeEvent(detail: SceneRuntimeEventDetail): void {
  if (typeof window === "undefined") return;

  if (detail.status === "ready") {
    performance.mark(`scene-ready:${detail.sceneId}`);
  }

  window.dispatchEvent(
    new CustomEvent<SceneRuntimeEventDetail>(SCENE_RUNTIME_EVENT_NAME, {
      detail,
    }),
  );
}
```

- [ ] **Step 4: Run the event test to verify GREEN**

Run: `npm run test:unit -- app/three/runtime-events.test.ts`

Expected: PASS, `4 passed`.

- [ ] **Step 5: Refactor by checking TypeScript and the focused suite**

Run:

```bash
npx tsc --noEmit
npm run test:unit -- app/three/runtime-events.test.ts app/three/types.test.ts
```

Expected: TypeScript exits 0; Vitest reports `2 test files passed`, `5 tests passed`.

- [ ] **Step 6: Commit the event seam**

```bash
git add app/three/runtime-events.ts app/three/runtime-events.test.ts
git commit -m "feat: expose local scene runtime events"
```

## Task 4: Resolve WebGL 2, saved preference, and reduced-data defaults

> **Implementation amendment (2026-07-11):** WebGL capability detection asks
> for the approved high-performance WebGL 2 context and then best-effort loses
> that temporary probe context so it does not consume a GPU context slot.
> Browser globals fail closed during SSR. Post-mount preference initialization
> runs in a cancellation-safe microtask, preserving the poster-first hydration
> state while satisfying the React 19 no-synchronous-effect-update rule.

**Files:**
- Create: `app/three/three-preference.test.tsx`
- Create: `app/three/three-preference.ts`

- [ ] **Step 1: Write the failing preference tests**

Create `app/three/three-preference.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveThreePreference,
  THREE_PREFERENCE_STORAGE_KEY,
  useThreePreference,
} from "./three-preference";

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

describe("useThreePreference", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((contextId: string) =>
        contextId === "webgl2" ? ({} as WebGL2RenderingContext) : null) as typeof HTMLCanvasElement.prototype.getContext,
    );
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false },
    });
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
});
```

- [ ] **Step 2: Run the preference test to verify RED**

Run: `npm run test:unit -- app/three/three-preference.test.tsx`

Expected: FAIL with `Failed to resolve import "./three-preference"`.

- [ ] **Step 3: Implement capability and preference resolution**

Create `app/three/three-preference.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

export const THREE_PREFERENCE_STORAGE_KEY = "personal-site:three-enabled";

export type StoredThreePreference = "on" | "off" | null;
export type ThreePreferenceMode = "enabled" | "disabled" | "unsupported";

export interface ThreePreferenceResolution {
  readonly mode: ThreePreferenceMode;
  readonly explicit: boolean;
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: { readonly saveData?: boolean };
}

export function resolveThreePreference(input: {
  readonly stored: StoredThreePreference;
  readonly saveData: boolean;
  readonly webgl2: boolean;
}): ThreePreferenceResolution {
  if (!input.webgl2) {
    return { mode: "unsupported", explicit: input.stored !== null };
  }
  if (input.stored === "off") return { mode: "disabled", explicit: true };
  if (input.stored === "on") return { mode: "enabled", explicit: true };
  if (input.saveData) return { mode: "disabled", explicit: false };
  return { mode: "enabled", explicit: false };
}

export function supportsWebGL2(documentRef: Document = document): boolean {
  try {
    const canvas = documentRef.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2", {
        powerPreference: "high-performance",
      }),
    );
  } catch {
    return false;
  }
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): PreferenceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredPreference(
  storage: PreferenceStorage | null = browserStorage(),
): StoredThreePreference {
  try {
    const value = storage?.getItem(THREE_PREFERENCE_STORAGE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPreference(
  value: Exclude<StoredThreePreference, null>,
  storage: PreferenceStorage | null = browserStorage(),
): boolean {
  try {
    storage?.setItem(THREE_PREFERENCE_STORAGE_KEY, value);
    return storage !== null;
  } catch {
    return false;
  }
}

function readsReducedData(): boolean {
  return Boolean((navigator as NavigatorWithConnection).connection?.saveData);
}

export interface ThreePreferenceState {
  readonly initialized: boolean;
  readonly enabled: boolean;
  readonly supported: boolean;
  readonly explicit: boolean;
  readonly setEnabled: (enabled: boolean) => void;
}

export function useThreePreference(): ThreePreferenceState {
  const [resolution, setResolution] = useState<ThreePreferenceResolution>({
    mode: "disabled",
    explicit: false,
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setResolution(
      resolveThreePreference({
        stored: readStoredPreference(),
        saveData: readsReducedData(),
        webgl2: supportsWebGL2(),
      }),
    );
    setInitialized(true);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const stored: Exclude<StoredThreePreference, null> = enabled ? "on" : "off";
    writeStoredPreference(stored);
    setResolution(
      resolveThreePreference({
        stored,
        saveData: readsReducedData(),
        webgl2: supportsWebGL2(),
      }),
    );
    setInitialized(true);
  }, []);

  return {
    initialized,
    enabled: resolution.mode === "enabled",
    supported: resolution.mode !== "unsupported",
    explicit: resolution.explicit,
    setEnabled,
  };
}
```

- [ ] **Step 4: Run the preference tests to verify GREEN**

Run: `npm run test:unit -- app/three/three-preference.test.tsx`

Expected: PASS, `6 passed`; a storage `SecurityError` degrades to the in-memory/default preference without escaping the hook or unmounting semantic content.

- [ ] **Step 5: Refactor by verifying reduced-data and unsupported paths remain distinct**

Run: `npm run test:unit -- app/three/three-preference.test.tsx app/three/types.test.ts`

Expected: PASS, `2 test files passed`, `7 tests passed`.

- [ ] **Step 6: Commit local preference behavior**

```bash
git add app/three/three-preference.ts app/three/three-preference.test.tsx
git commit -m "feat: add local three preference policy"
```

## Task 5: Clamp temporary scene rotation as a pure policy

> **Implementation amendment (2026-07-11):** Rotation limits are validated as
> finite ordered ranges with a positive sensitivity and an in-range default.
> Non-finite runtime pointer values are ignored, invalid current angles recover
> to the registered default, and both axes remain clamped even when touch pitch
> is disabled, preventing NaN from reaching the R3F Euler transform.

**Files:**
- Create: `app/three/rotation.test.ts`
- Create: `app/three/rotation.ts`

- [ ] **Step 1: Write the failing clamp and reset tests**

Create `app/three/rotation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyRotationDelta, resetSceneRotation } from "./rotation";
import type { RotationLimits } from "./types";

const limits: RotationLimits = {
  yaw: [-25, 25],
  pitch: [-8, 8],
  default: { yaw: 3, pitch: -2 },
  degreesPerPixel: 0.2,
};

describe("scene rotation policy", () => {
  it("converts pointer pixels to bounded yaw and pitch degrees", () => {
    expect(
      applyRotationDelta(
        { yaw: 0, pitch: 0 },
        { deltaX: 200, deltaY: -100, allowPitch: true },
        limits,
      ),
    ).toEqual({ yaw: 25, pitch: -8 });
  });

  it("ignores vertical touch deltas when pitch is not allowed", () => {
    expect(
      applyRotationDelta(
        { yaw: 5, pitch: 4 },
        { deltaX: -20, deltaY: 200, allowPitch: false },
        limits,
      ),
    ).toEqual({ yaw: 1, pitch: 4 });
  });

  it("returns a fresh copy of the registered default pose", () => {
    const rotation = resetSceneRotation(limits);
    expect(rotation).toEqual({ yaw: 3, pitch: -2 });
    expect(rotation).not.toBe(limits.default);
  });
});
```

- [ ] **Step 2: Run the rotation test to verify RED**

Run: `npm run test:unit -- app/three/rotation.test.ts`

Expected: FAIL with `Failed to resolve import "./rotation"`.

- [ ] **Step 3: Implement minimal bounded rotation math**

Create `app/three/rotation.ts`:

```ts
import type { RotationLimits, SceneRotation } from "./types";

export interface RotationDelta {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly allowPitch: boolean;
}

function clamp(value: number, [minimum, maximum]: readonly [number, number]) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function applyRotationDelta(
  current: SceneRotation,
  delta: RotationDelta,
  limits: RotationLimits,
): SceneRotation {
  return {
    yaw: clamp(
      current.yaw + delta.deltaX * limits.degreesPerPixel,
      limits.yaw,
    ),
    pitch: delta.allowPitch
      ? clamp(
          current.pitch + delta.deltaY * limits.degreesPerPixel,
          limits.pitch,
        )
      : current.pitch,
  };
}

export function resetSceneRotation(limits: RotationLimits): SceneRotation {
  return { ...limits.default };
}
```

- [ ] **Step 4: Run the rotation test to verify GREEN**

Run: `npm run test:unit -- app/three/rotation.test.ts`

Expected: PASS, `3 passed`.

- [ ] **Step 5: Refactor by running all pure-policy tests**

Run:

```bash
npm run test:unit -- app/three/types.test.ts app/three/scene-registry.test.ts app/three/runtime-events.test.ts app/three/rotation.test.ts
```

Expected: PASS, `4 test files passed`, `14 tests passed`.

- [ ] **Step 6: Commit rotation policy**

```bash
git add app/three/rotation.ts app/three/rotation.test.ts
git commit -m "feat: clamp decorative scene rotation"
```

## Task 6: Register sections, activate a shared viewport line, and reset routes

> **Implementation amendment (2026-07-11):** The provider performs one guarded
> render-time pathname reset instead of synchronous state updates in effects.
> Context exposes `sceneActivationAllowed`; unknown routes remain poster-only
> until an explicit capture activation, and normal activation rejects
> cross-route IDs. Status/rotation callbacks are scoped to pathname, scene ID,
> and activation version, while preference toggles invalidate the version.
> Poster-only scenes resolve to `poster` before WebGL capability state. Posters
> declare their actual 1920x1080 and 585x1266 intrinsic sizes, and
> `SceneSection` accepts `contentClassName` so later grid layouts apply to the
> content wrapper rather than collapsing into one outer-grid child. Focused
> tests verify that active/loading and inactive/poster section attributes flip
> together at the shared viewport line. The committed Task 6 source supersedes
> the earlier minimal code sketches in this section.

**Files:**
- Create: `app/three/scene-runtime-context.tsx`
- Create: `app/three/scene-poster.tsx`
- Create: `app/three/scene-section.tsx`
- Create: `app/three/scene-provider.test.tsx`
- Create: `app/three/scene-provider.tsx`

- [ ] **Step 1: Write the failing provider and observer tests**

Create `app/three/scene-provider.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SceneProvider } from "./scene-provider";
import { SceneSection } from "./scene-section";
import { useSceneRuntime } from "./scene-runtime-context";

let pathname = "/experience";
const setEnabled = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("./three-preference", () => ({
  useThreePreference: () => ({
    initialized: true,
    enabled: true,
    supported: true,
    explicit: false,
    setEnabled,
  }),
}));

class ObserverMock implements IntersectionObserver {
  static instances: ObserverMock[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin ?? "0px";
    this.thresholds = [Number(options?.threshold ?? 0)];
    ObserverMock.instances.push(this);
  }

  trigger(target: Element, top: number) {
    this.callback(
      [
        {
          boundingClientRect: { top } as DOMRectReadOnly,
          intersectionRatio: 1,
          intersectionRect: {} as DOMRectReadOnly,
          isIntersecting: true,
          rootBounds: null,
          target,
          time: performance.now(),
        },
      ],
      this,
    );
  }
}

function Probe() {
  const runtime = useSceneRuntime();
  return (
    <output data-testid="runtime-probe">
      <span>{runtime.activeSceneId}</span>
      <span>{runtime.status}</span>
      <span>{runtime.rotation.yaw},{runtime.rotation.pitch}</span>
      <button onClick={() => runtime.rotateBy(400, 400, true)}>rotate</button>
      <button onClick={() => runtime.setStatus("ready")}>mark ready</button>
      <button onClick={() => runtime.activateScene("experience-intro")}>
        activate intro
      </button>
      <button onClick={() => runtime.setThreeEnabled(false)}>disable 3D</button>
    </output>
  );
}

function ExperienceSections({ children }: { children?: ReactNode }) {
  return (
    <>
      <SceneSection sceneId="experience-hero">hero</SceneSection>
      <SceneSection sceneId="experience-intro">intro</SceneSection>
      <SceneSection sceneId="nasa-rocket">nasa</SceneSection>
      {children}
    </>
  );
}

describe("SceneProvider", () => {
  beforeEach(() => {
    pathname = "/experience";
    ObserverMock.instances = [];
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: ObserverMock,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1_000,
    });
  });

  it("renders complete poster markup outside the provider", () => {
    render(
      <SceneSection sceneId="projects-hero">fallback copy</SceneSection>,
    );
    const section = screen.getByText("fallback copy").closest("section");
    expect(section).toHaveAttribute("data-scene-active", "false");
    expect(section).toHaveAttribute("data-scene-status", "poster");
    expect(section?.querySelector("img")).toHaveAttribute(
      "src",
      "/posters/projects-hero-desktop.webp",
    );
    expect(section?.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("uses one shared activation line and exposes stable section IDs", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
        "experience-hero",
      ),
    );
    expect(ObserverMock.instances).toHaveLength(1);
    expect(ObserverMock.instances[0].rootMargin).toBe("-45% 0px -54% 0px");
    expect(
      screen.getByText("intro").closest("[data-scene-id]"),
    ).toHaveAttribute("data-scene-id", "experience-intro");

    act(() => {
      ObserverMock.instances[0].trigger(
        screen.getByText("intro").closest("section")!,
        450,
      );
    });

    expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
      "experience-intro",
    );
  });

  it("clears stale registrations, selects the destination hero, and resets pose", async () => {
    const view = render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent("loading"),
    );

    fireEvent.click(screen.getByRole("button", { name: "rotate" }));
    expect(screen.getByTestId("runtime-probe")).toHaveTextContent("25,8");

    pathname = "/projects";
    view.rerender(
      <SceneProvider>
        <SceneSection sceneId="projects-hero">projects</SceneSection>
        <Probe />
      </SceneProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent(
        "projects-hero",
      );
      expect(screen.getByTestId("runtime-probe")).toHaveTextContent("0,0");
    });
    expect(ObserverMock.instances[0].unobserve).toHaveBeenCalled();
  });

  it("resets a ready scene to loading in the same activation commit", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    await waitFor(() => expect(probe).toHaveTextContent("loading"));

    fireEvent.click(screen.getByRole("button", { name: "rotate" }));
    fireEvent.click(screen.getByRole("button", { name: "mark ready" }));
    expect(probe).toHaveTextContent("experience-heroready25,8");

    fireEvent.click(screen.getByRole("button", { name: "activate intro" }));
    expect(probe).toHaveTextContent("experience-introloading0,0");
  });

  it("moves ready to disabled in the same explicit preference commit", async () => {
    render(
      <SceneProvider>
        <ExperienceSections />
        <Probe />
      </SceneProvider>,
    );
    const probe = screen.getByTestId("runtime-probe");
    await waitFor(() => expect(probe).toHaveTextContent("loading"));
    fireEvent.click(screen.getByRole("button", { name: "mark ready" }));
    expect(probe).toHaveTextContent("ready");

    fireEvent.click(screen.getByRole("button", { name: "disable 3D" }));
    expect(probe).toHaveTextContent("disabled");
    expect(setEnabled).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the provider test to verify RED**

Run: `npm run test:unit -- app/three/scene-provider.test.tsx`

Expected: FAIL with unresolved `./scene-provider`, `./scene-section`, and `./scene-runtime-context` imports.

- [ ] **Step 3: Create the narrow client context**

Create `app/three/scene-runtime-context.tsx`:

```tsx
"use client";

import { createContext, useContext } from "react";
import type {
  SceneDefinition,
  SceneId,
  SceneRotation,
  ThreeStatus,
} from "./types";

export interface SceneRuntimeContextValue {
  readonly activeSceneId: SceneId;
  readonly activeScene: SceneDefinition;
  readonly activationVersion: number;
  readonly sceneActivationAllowed: boolean;
  readonly status: ThreeStatus;
  readonly rotation: SceneRotation;
  readonly threeInitialized: boolean;
  readonly threeEnabled: boolean;
  readonly threeSupported: boolean;
  readonly activateScene: (sceneId: SceneId) => void;
  readonly registerSection: (sceneId: SceneId, element: HTMLElement) => () => void;
  readonly setStatus: (status: ThreeStatus) => void;
  readonly rotateBy: (
    deltaX: number,
    deltaY: number,
    allowPitch: boolean,
  ) => void;
  readonly setThreeEnabled: (enabled: boolean) => void;
}

export const SceneRuntimeContext =
  createContext<SceneRuntimeContextValue | null>(null);

export function useOptionalSceneRuntime(): SceneRuntimeContextValue | null {
  return useContext(SceneRuntimeContext);
}

export function useSceneRuntime(): SceneRuntimeContextValue {
  const value = useOptionalSceneRuntime();
  if (!value) {
    throw new Error("useSceneRuntime must be used inside SceneProvider");
  }
  return value;
}
```

- [ ] **Step 4: Create reusable deterministic poster markup**

Create `app/three/scene-poster.tsx`:

```tsx
import type { SceneDefinition } from "./types";

export function ScenePoster({
  scene,
  className,
  priority = false,
}: {
  readonly scene: SceneDefinition;
  readonly className: string;
  readonly priority?: boolean;
}) {
  return (
    <picture className={className} aria-hidden="true">
      <source media="(max-width: 767px)" srcSet={scene.poster.mobile} />
      <img
        src={scene.poster.desktop}
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
      />
    </picture>
  );
}
```

- [ ] **Step 5: Implement `SceneSection` registration and the stable release hook**

Create `app/three/scene-section.tsx`:

```tsx
"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { getSceneDefinition } from "./scene-registry";
import { ScenePoster } from "./scene-poster";
import { useOptionalSceneRuntime } from "./scene-runtime-context";
import type { SceneId } from "./types";

interface SceneSectionProps
  extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  readonly sceneId: SceneId;
  readonly forceActive?: boolean;
  readonly posterClassName?: string;
  readonly posterPriority?: boolean;
  readonly children: ReactNode;
}

export function SceneSection({
  sceneId,
  forceActive = false,
  posterClassName = "",
  posterPriority = false,
  className = "",
  children,
  ...sectionProps
}: SceneSectionProps) {
  const elementRef = useRef<HTMLElement>(null);
  const runtime = useOptionalSceneRuntime();
  const scene = getSceneDefinition(sceneId);
  const isActive = runtime?.activeSceneId === sceneId;
  const registerSection = runtime?.registerSection;
  const activateScene = runtime?.activateScene;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !registerSection) return;
    return registerSection(sceneId, element);
  }, [registerSection, sceneId]);

  useEffect(() => {
    if (forceActive) activateScene?.(sceneId);
  }, [activateScene, forceActive, sceneId]);

  return (
    <section
      {...sectionProps}
      ref={elementRef}
      className={`scene-section ${className}`.trim()}
      data-scene-id={sceneId}
      data-scene-active={isActive ? "true" : "false"}
      data-scene-status={isActive && runtime ? runtime.status : "poster"}
    >
      <ScenePoster
        scene={scene}
        className={`scene-section__poster ${posterClassName}`.trim()}
        priority={posterPriority}
      />
      <div className="scene-section__content">{children}</div>
    </section>
  );
}
```

- [ ] **Step 6: Implement the provider, shared observer, route reset, and status resolution**

Create `app/three/scene-provider.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyRotationDelta, resetSceneRotation } from "./rotation";
import {
  getRouteHeroSceneId,
  getSceneDefinition,
} from "./scene-registry";
import {
  SceneRuntimeContext,
  type SceneRuntimeContextValue,
} from "./scene-runtime-context";
import { useThreePreference } from "./three-preference";
import type { SceneId, SceneRotation, ThreeStatus } from "./types";

interface Registration {
  readonly sceneId: SceneId;
  readonly pathname: string;
}

interface PreferenceSnapshot {
  readonly initialized: boolean;
  readonly supported: boolean;
  readonly enabled: boolean;
}

function statusForScene(
  sceneId: SceneId,
  preference: PreferenceSnapshot,
): ThreeStatus {
  const scene = getSceneDefinition(sceneId);
  if (!preference.initialized) return "poster";
  if (!preference.supported) return "unsupported";
  if (!preference.enabled) return "disabled";
  if (!scene.modelUrl) return "poster";
  return "loading";
}

export function SceneProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const preference = useThreePreference();
  const preferenceRef = useRef<PreferenceSnapshot>(preference);
  preferenceRef.current = preference;
  const initialSceneId = getRouteHeroSceneId(pathname);
  const [activeSceneId, setActiveSceneId] = useState<SceneId>(initialSceneId);
  const activeSceneIdRef = useRef(activeSceneId);
  const [activationVersion, setActivationVersion] = useState(0);
  const [status, setStatus] = useState<ThreeStatus>("poster");
  const [rotation, setRotation] = useState<SceneRotation>(() =>
    resetSceneRotation(getSceneDefinition(initialSceneId).rotation),
  );
  const registrations = useRef(new Map<Element, Registration>());
  const observer = useRef<IntersectionObserver | null>(null);

  const activateScene = useCallback((sceneId: SceneId) => {
    if (activeSceneIdRef.current === sceneId) return;
    activeSceneIdRef.current = sceneId;
    setActiveSceneId(sceneId);
    setRotation(resetSceneRotation(getSceneDefinition(sceneId).rotation));
    setStatus(statusForScene(sceneId, preferenceRef.current));
    setActivationVersion((version) => version + 1);
  }, []);

  const ensureObserver = useCallback(() => {
    if (observer.current || typeof IntersectionObserver === "undefined") {
      return observer.current;
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        const candidates = entries
          .filter((entry) => {
            const registration = registrations.current.get(entry.target);
            return (
              entry.isIntersecting &&
              registration?.pathname === pathnameRef.current
            );
          })
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top - window.innerHeight * 0.45) -
              Math.abs(right.boundingClientRect.top - window.innerHeight * 0.45),
          );

        const registration = candidates[0]
          ? registrations.current.get(candidates[0].target)
          : null;
        if (registration) activateScene(registration.sceneId);
      },
      {
        root: null,
        rootMargin: "-45% 0px -54% 0px",
        threshold: 0,
      },
    );
    return observer.current;
  }, [activateScene]);

  const registerSection = useCallback(
    (sceneId: SceneId, element: HTMLElement) => {
      registrations.current.set(element, {
        sceneId,
        pathname: pathnameRef.current,
      });
      ensureObserver()?.observe(element);

      return () => {
        observer.current?.unobserve(element);
        registrations.current.delete(element);
      };
    },
    [ensureObserver],
  );

  useEffect(() => {
    for (const [element, registration] of registrations.current) {
      if (registration.pathname !== pathname) {
        observer.current?.unobserve(element);
        registrations.current.delete(element);
      }
    }
    activateScene(getRouteHeroSceneId(pathname));
  }, [activateScene, pathname]);

  useEffect(() => {
    setStatus(
      statusForScene(activeSceneId, {
        enabled: preference.enabled,
        initialized: preference.initialized,
        supported: preference.supported,
      }),
    );
  }, [
    activeSceneId,
    preference.enabled,
    preference.initialized,
    preference.supported,
  ]);

  useEffect(
    () => () => {
      observer.current?.disconnect();
      registrations.current.clear();
    },
    [],
  );

  const rotateBy = useCallback(
    (deltaX: number, deltaY: number, allowPitch: boolean) => {
      const limits = getSceneDefinition(activeSceneIdRef.current).rotation;
      setRotation((current) =>
        applyRotationDelta(
          current,
          { deltaX, deltaY, allowPitch },
          limits,
        ),
      );
    },
    [],
  );

  const setThreeEnabled = useCallback(
    (enabled: boolean) => {
      setStatus(
        enabled
          ? statusForScene(activeSceneIdRef.current, {
              enabled: true,
              initialized: true,
              supported: preferenceRef.current.supported,
            })
          : "disabled",
      );
      preference.setEnabled(enabled);
    },
    [preference.setEnabled],
  );

  const activeScene = getSceneDefinition(activeSceneId);
  const value = useMemo<SceneRuntimeContextValue>(
    () => ({
      activeSceneId,
      activeScene,
      activationVersion,
      status,
      rotation,
      threeInitialized: preference.initialized,
      threeEnabled: preference.enabled,
      threeSupported: preference.supported,
      activateScene,
      registerSection,
      setStatus,
      rotateBy,
      setThreeEnabled,
    }),
    [
      activeScene,
      activeSceneId,
      activateScene,
      activationVersion,
      preference.enabled,
      preference.initialized,
      preference.supported,
      registerSection,
      rotateBy,
      rotation,
      setThreeEnabled,
      status,
    ],
  );

  return (
    <SceneRuntimeContext.Provider value={value}>
      {children}
    </SceneRuntimeContext.Provider>
  );
}
```

- [ ] **Step 7: Run the provider tests to verify GREEN**

Run: `npm run test:unit -- app/three/scene-provider.test.tsx`

Expected: PASS, `5 passed`.

- [ ] **Step 8: Refactor by type-checking stable hooks and state signatures**

Run:

```bash
npx tsc --noEmit
npm run test:unit -- app/three/scene-provider.test.tsx app/three/rotation.test.ts
```

Expected: TypeScript exits 0; Vitest reports `2 test files passed`, `8 tests passed`.

- [ ] **Step 9: Commit shared activation state**

```bash
git add app/three/scene-runtime-context.tsx app/three/scene-poster.tsx app/three/scene-section.tsx app/three/scene-provider.tsx app/three/scene-provider.test.tsx
git commit -m "feat: activate registered three sections"
```

## Task 7: Forward bounded pointer and touch input without trapping scroll

> **Implementation amendment (2026-07-11):** The final input boundary
> supersedes the minimal snippets below. Touch intent uses cumulative movement,
> a 6px slop, and a permanent vertical/horizontal lock; vertical gestures never
> become rotation later in the same pointer sequence. `pan-y pinch-zoom`
> preserves page scrolling and browser zoom. Capture, cancel, and lost-capture
> paths are best-effort and exception-safe; competing/non-primary pointers and
> malformed pointer IDs/coordinates are ignored without poisoning later input.
> Unknown pointer types follow fine-pointer behavior. Insets are runtime-checked
> and fail closed with no intercepting surface, while registry tests remain the
> build-time failure gate; any active pointer is cleared across invalid/valid
> prop recovery. Eleven component cases cover these contracts.

**Files:**
- Create: `app/three/scene-rotation-area.test.tsx`
- Create: `app/three/scene-rotation-area.tsx`

- [ ] **Step 1: Write failing pointer/touch component tests**

Create `app/three/scene-rotation-area.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SceneRotationArea } from "./scene-rotation-area";

const desktop = { top: 10, right: 8, bottom: 12, left: 40 };
const mobile = { top: 8, right: 8, bottom: 45, left: 8 };

describe("SceneRotationArea", () => {
  it("forwards mouse yaw and pitch deltas", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(area, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 120,
      clientY: 92,
    });

    expect(onDelta).toHaveBeenCalledWith(20, -8, true);
  });

  it("locks vertical touch gestures and forwards horizontal touch yaw only", () => {
    const onDelta = vi.fn();
    render(
      <SceneRotationArea
        desktop={desktop}
        mobile={mobile}
        onDelta={onDelta}
      />,
    );
    const area = screen.getByTestId("scene-rotation-area");

    fireEvent.pointerDown(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 102,
      clientY: 140,
    });
    expect(onDelta).not.toHaveBeenCalled();

    fireEvent.pointerMove(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 132,
      clientY: 142,
    });
    expect(onDelta).not.toHaveBeenCalled();

    fireEvent.pointerUp(area, {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
    });
    fireEvent.pointerDown(area, {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(area, {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 132,
      clientY: 102,
    });
    expect(onDelta).toHaveBeenCalledWith(32, 0, false);
    expect(area).toHaveStyle({ touchAction: "pan-y pinch-zoom" });
    expect(area).not.toHaveAttribute("tabindex");
    expect(area).not.toHaveAttribute("role");
  });
});
```

- [ ] **Step 2: Run the interaction test to verify RED**

Run: `npm run test:unit -- app/three/scene-rotation-area.test.tsx`

Expected: FAIL with `Failed to resolve import "./scene-rotation-area"`.

- [ ] **Step 3: Implement the transparent drag surface**

Create `app/three/scene-rotation-area.tsx`:

```tsx
"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useRef } from "react";
import type { PercentInsets } from "./types";

interface ActivePointer {
  readonly id: number;
  readonly type: string;
  x: number;
  y: number;
}

type RotationAreaStyle = CSSProperties &
  Record<
    | "--rotation-top"
    | "--rotation-right"
    | "--rotation-bottom"
    | "--rotation-left"
    | "--rotation-mobile-top"
    | "--rotation-mobile-right"
    | "--rotation-mobile-bottom"
    | "--rotation-mobile-left",
    string
  >;

function percent(value: number) {
  return `${value}%`;
}

export function SceneRotationArea({
  desktop,
  mobile,
  onDelta,
}: {
  readonly desktop: PercentInsets;
  readonly mobile: PercentInsets;
  readonly onDelta: (
    deltaX: number,
    deltaY: number,
    allowPitch: boolean,
  ) => void;
}) {
  const active = useRef<ActivePointer | null>(null);
  const style: RotationAreaStyle = {
    touchAction: "pan-y pinch-zoom",
    "--rotation-top": percent(desktop.top),
    "--rotation-right": percent(desktop.right),
    "--rotation-bottom": percent(desktop.bottom),
    "--rotation-left": percent(desktop.left),
    "--rotation-mobile-top": percent(mobile.top),
    "--rotation-mobile-right": percent(mobile.right),
    "--rotation-mobile-bottom": percent(mobile.bottom),
    "--rotation-mobile-left": percent(mobile.left),
  };

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    active.current = {
      id: event.pointerId,
      type: event.pointerType,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = active.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (pointer.type === "touch") {
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      onDelta(deltaX, 0, false);
      return;
    }

    onDelta(deltaX, deltaY, true);
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current?.id !== event.pointerId) return;
    active.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      aria-hidden="true"
      className="scene-runtime__rotation-area"
      data-testid="scene-rotation-area"
      style={style}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}
```

- [ ] **Step 4: Run interaction tests to verify GREEN**

Run: `npm run test:unit -- app/three/scene-rotation-area.test.tsx`

Expected: PASS, `11 passed`.

- [ ] **Step 5: Refactor by running component and pure clamp tests together**

Run: `npm run test:unit -- app/three/scene-rotation-area.test.tsx app/three/rotation.test.ts`

Expected: PASS, `2 test files passed`, `21 tests passed`.

- [ ] **Step 6: Commit scroll-safe input**

```bash
git add app/three/scene-rotation-area.tsx app/three/scene-rotation-area.test.tsx
git commit -m "feat: add scroll-safe scene rotation input"
```

## Task 8: Rotate one normalized R3F root and invalidate on demand

> **Implementation amendment (2026-07-11):** The final source supersedes the
> minimal snippets below. A shared `normalizeSceneRotation` policy independently
> defaults/clamps both axes before Three.js sees them; the root uses explicit
> `YXZ` order, radians, and a layout effect that mutates before invalidating.
> Effective pose plus `sceneId` drive the effect, so equivalent clamped inputs
> stay idle while scene changes render. StrictMode assertions use relative call
> counts because duplicate development invalidations coalesce in R3F. Tests also
> cover replacement callbacks, keyed model detachment/remount, and exact
> post-mutation pose observation. `@types/three@0.185.1` is a required direct
> dev dependency for isolated pnpm type resolution. The focused slice contains
> 26 tests.

**Files:**
- Create: `app/three/normalized-scene-root.test.tsx`
- Create: `app/three/normalized-scene-root.tsx`
- Modify: `app/three/rotation.test.ts`
- Modify: `app/three/rotation.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing R3F root test**

Create `app/three/normalized-scene-root.test.tsx`:

```tsx
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { MathUtils, type Group } from "three";
import { describe, expect, it, vi } from "vitest";
import { NormalizedSceneRoot } from "./normalized-scene-root";

describe("NormalizedSceneRoot", () => {
  it("applies bounded degrees to the complete root and invalidates each change", async () => {
    const invalidate = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <NormalizedSceneRoot
        sceneId="home-hero"
        rotation={{ yaw: 10, pitch: -4 }}
        invalidate={invalidate}
      >
        <mesh name="authored-diorama" />
      </NormalizedSceneRoot>,
    );

    const root = renderer.scene.findByProps({
      name: "scene-root:home-hero",
    }).instance as Group;
    expect(root.rotation.y).toBeCloseTo(MathUtils.degToRad(10));
    expect(root.rotation.x).toBeCloseTo(MathUtils.degToRad(-4));
    expect(renderer.scene.findByProps({ name: "authored-diorama" })).toBeTruthy();
    expect(invalidate).toHaveBeenCalledOnce();

    await renderer.update(
      <NormalizedSceneRoot
        sceneId="home-hero"
        rotation={{ yaw: -25, pitch: 8 }}
        invalidate={invalidate}
      >
        <mesh name="authored-diorama" />
      </NormalizedSceneRoot>,
    );

    expect(root.rotation.y).toBeCloseTo(MathUtils.degToRad(-25));
    expect(root.rotation.x).toBeCloseTo(MathUtils.degToRad(8));
    expect(invalidate).toHaveBeenCalledTimes(2);
    await renderer.unmount();
  });
});
```

- [ ] **Step 2: Run the R3F test to verify RED**

Run: `npm run test:unit -- app/three/normalized-scene-root.test.tsx`

Expected: FAIL with `Failed to resolve import "./normalized-scene-root"`.

- [ ] **Step 3: Implement normalized-root rotation and demand invalidation**

Create `app/three/normalized-scene-root.tsx`:

```tsx
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { Group, MathUtils } from "three";
import type { SceneId, SceneRotation } from "./types";

export function NormalizedSceneRoot({
  sceneId,
  rotation,
  invalidate,
  children,
}: {
  readonly sceneId: SceneId;
  readonly rotation: SceneRotation;
  readonly invalidate: () => void;
  readonly children: ReactNode;
}) {
  const root = useRef<Group>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    root.current.rotation.set(
      MathUtils.degToRad(rotation.pitch),
      MathUtils.degToRad(rotation.yaw),
      0,
    );
    invalidate();
  }, [invalidate, rotation.pitch, rotation.yaw]);

  return (
    <group ref={root} name={`scene-root:${sceneId}`}>
      {children}
    </group>
  );
}
```

- [ ] **Step 4: Run the R3F test to verify GREEN**

Run: `npm run test:unit -- app/three/normalized-scene-root.test.tsx`

Expected: PASS, `4 passed`.

- [ ] **Step 5: Refactor through the full rotation test slice**

Run:

```bash
npm run test:unit -- app/three/rotation.test.ts app/three/scene-rotation-area.test.tsx app/three/normalized-scene-root.test.tsx
npx tsc --noEmit
```

Expected: Vitest reports `3 test files passed`, `26 tests passed`; TypeScript exits 0.

- [ ] **Step 6: Commit normalized scene rotation**

```bash
git add app/three/normalized-scene-root.tsx app/three/normalized-scene-root.test.tsx app/three/rotation.ts app/three/rotation.test.ts package.json package-lock.json docs/superpowers/plans/2026-07-09-personal-site-runtime.md
git commit -m "feat: rotate normalized scene root on demand"
```

## Task 9: Load Meshopt GLBs and defer the bounded next-scene cache

> **Implementation amendment (2026-07-11):** The final source supersedes the
> `useLoader` sketches below. `useLoader.clear()` cannot abort or dispose an
> in-flight GLB, so Task 9 now owns an abortable URL cache: `fetch` with an
> `AbortSignal`, configured `GLTFLoader.parseAsync`, stale-generation rejection,
> late-result disposal, retryable speculative failures, pinned active failures
> until explicit clear, synchronous current promotion, and at most one
> speculative record. Pure desired-set policy is split from the client/Meshopt
> adapter. Idle work is generation-guarded, and a cache-wide latest-host lease
> defers final cleanup by one microtask so StrictMode replay or same-tick host
> replacement cannot evict a live request. A committed Meshopt-compressed crane
> GLB is decoded in tests.
>
> Runtime clones preserve source geometry/material/texture/skeleton aliases,
> recursively clone ordinary texture references without mutating cached array
> or plain-record containers, consistently flatten `UniformsGroup` array
> entries, clone skeleton inverse matrices, reject render-target textures
> outside the shipped glTF contract, and dispose exact owned resources once.
> Clone lifetime uses a commit-time layout attachment: every StrictMode setup
> owns one clone, cleanup detaches before disposal, and render creates no
> resource graph. Shared ImageBitmap-like payloads close only after cached and
> runtime Texture owners are both gone. Cached-source eviction is proven
> independent from a live runtime clone. The expanded Task 9 slice contains 27
> tests.

**Files:**
- Create: `app/three/adjacent-scene-preloader.test.ts`
- Create: `app/three/adjacent-scene-preloader.tsx`
- Create: `app/three/scene-loader.ts`
- Create: `app/three/scene-model.test.ts`
- Create: `app/three/scene-model.tsx`
- Create: `app/three/adjacent-scene-preloader.component.test.tsx`
- Create: `app/three/scene-loader.test.ts`
- Create: `app/three/scene-model.component.test.tsx`
- Create: `app/three/scene-preload-policy.ts`
- Create: `app/three/scene-resource-cache.test.ts`
- Create: `app/three/scene-resource-cache.ts`
- Create: `app/three/scene-resources.ts`

- [ ] **Step 1: Write the failing adjacent-cache test**

Create `app/three/adjacent-scene-preloader.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  reconcileScenePreloads,
  type ModelCachePort,
} from "./adjacent-scene-preloader";

describe("reconcileScenePreloads", () => {
  it("lets SceneModel own current and adds only next after readiness", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };

    const homeCurrent = reconcileScenePreloads(
      "home-hero",
      new Set(),
      cache,
      false,
    );
    expect([...homeCurrent]).toEqual(["/models/crane.glb"]);
    expect(cache.preload).not.toHaveBeenCalled();

    const homeIdle = reconcileScenePreloads(
      "home-hero",
      homeCurrent,
      cache,
      true,
    );
    expect([...homeIdle]).toEqual([
      "/models/crane.glb",
      "/models/crane-workout.glb",
    ]);
    expect(cache.preload).toHaveBeenCalledOnce();
    expect(cache.preload).toHaveBeenLastCalledWith(
      "/models/crane-workout.glb",
    );

    const experienceCurrent = reconcileScenePreloads(
      "experience-hero",
      homeIdle,
      cache,
      false,
    );
    expect([...experienceCurrent]).toEqual(["/models/crane-workout.glb"]);
    expect(cache.clear).toHaveBeenCalledWith("/models/crane.glb");

    const experienceIdle = reconcileScenePreloads(
      "experience-hero",
      experienceCurrent,
      cache,
      true,
    );
    expect([...experienceIdle]).toEqual([
      "/models/crane-workout.glb",
      "/models/crane-throwing-plane.glb",
    ]);
    expect(cache.preload).toHaveBeenLastCalledWith(
      "/models/crane-throwing-plane.glb",
    );
  });

  it("clears all model cache entries when 3D is disabled", () => {
    const cache: ModelCachePort = {
      preload: vi.fn(),
      clear: vi.fn(),
    };
    const previous = new Set(["/models/crane.glb", "/models/crane-workout.glb"]);

    expect(reconcileScenePreloads(null, previous, cache, false)).toEqual(new Set());
    expect(cache.clear).toHaveBeenCalledTimes(2);
    expect(cache.preload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write the failing clone/disposal test**

Create `app/three/scene-model.test.ts`:

```ts
import {
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { cloneRuntimeScene, disposeRuntimeScene } from "./scene-model";

describe("runtime scene resources", () => {
  it("clones and disposes instance-owned geometry, material, and textures", () => {
    const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const sourceGeometry = new BoxGeometry();
    const sourceMaterial = new MeshStandardMaterial({ map: texture });
    const source = new Group();
    source.add(new Mesh(sourceGeometry, sourceMaterial));

    const runtime = cloneRuntimeScene(source);
    const runtimeMesh = runtime.children[0] as Mesh<
      BoxGeometry,
      MeshStandardMaterial
    >;
    expect(runtimeMesh.geometry).not.toBe(sourceGeometry);
    expect(runtimeMesh.material).not.toBe(sourceMaterial);
    expect(runtimeMesh.material.map).not.toBe(texture);

    const geometryDispose = vi.spyOn(runtimeMesh.geometry, "dispose");
    const materialDispose = vi.spyOn(runtimeMesh.material, "dispose");
    const textureDispose = vi.spyOn(runtimeMesh.material.map!, "dispose");
    const sourceDispose = vi.spyOn(sourceGeometry, "dispose");

    disposeRuntimeScene(runtime);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run both tests to verify RED**

Run:

```bash
npm run test:unit -- app/three/adjacent-scene-preloader.test.ts app/three/scene-model.test.ts
```

Expected: FAIL with unresolved preloader and scene-model imports.

- [ ] **Step 4: Configure GLTFLoader with the self-hosted Meshopt decoder**

Create `app/three/scene-loader.ts`:

```ts
import { useLoader } from "@react-three/fiber";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

function configureSceneLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

export function useSceneGltf(url: string): GLTF {
  return useLoader(GLTFLoader, url, configureSceneLoader) as GLTF;
}

export function preloadSceneModel(url: string): void {
  void useLoader.preload(GLTFLoader, url, configureSceneLoader);
}

export function clearSceneModel(url: string): void {
  useLoader.clear(GLTFLoader, url);
}
```

- [ ] **Step 5: Let the live model own current loading and add next only after ready/idle**

Create `app/three/adjacent-scene-preloader.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  getSceneDefinition,
  getScenePreloadUrls,
} from "./scene-registry";
import { clearSceneModel, preloadSceneModel } from "./scene-loader";
import type { SceneId } from "./types";

export interface ModelCachePort {
  readonly preload: (url: string) => void;
  readonly clear: (url: string) => void;
}

const browserModelCache: ModelCachePort = {
  preload: preloadSceneModel,
  clear: clearSceneModel,
};

export function reconcileScenePreloads(
  activeSceneId: SceneId | null,
  previous: ReadonlySet<string>,
  cache: ModelCachePort,
  preloadNext: boolean,
): Set<string> {
  const currentUrl = activeSceneId
    ? getSceneDefinition(activeSceneId).modelUrl
    : null;
  const next = new Set(currentUrl ? [currentUrl] : []);
  if (activeSceneId && preloadNext) {
    const nextUrl = getScenePreloadUrls(activeSceneId).find(
      (url) => url !== currentUrl,
    );
    if (nextUrl) next.add(nextUrl);
  }

  for (const url of next) {
    if (url !== currentUrl && !previous.has(url)) cache.preload(url);
  }
  for (const url of previous) {
    if (!next.has(url)) cache.clear(url);
  }
  return next;
}

export function AdjacentScenePreloader({
  activeSceneId,
  enabled,
  ready,
}: {
  readonly activeSceneId: SceneId;
  readonly enabled: boolean;
  readonly ready: boolean;
}) {
  const allowed = useRef<Set<string>>(new Set());

  useEffect(() => {
    allowed.current = reconcileScenePreloads(
      enabled ? activeSceneId : null,
      allowed.current,
      browserModelCache,
      false,
    );
    if (!enabled || !ready) return;

    const preloadNext = () => {
      allowed.current = reconcileScenePreloads(
        activeSceneId,
        allowed.current,
        browserModelCache,
        true,
      );
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preloadNext, { timeout: 1_500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(preloadNext, 500);
    return () => window.clearTimeout(timeoutId);
  }, [activeSceneId, enabled, ready]);

  useEffect(
    () => () => {
      allowed.current = reconcileScenePreloads(
        null,
        allowed.current,
        browserModelCache,
        false,
      );
    },
    [],
  );

  return null;
}
```

- [ ] **Step 6: Implement isolated cloning, disposal, and one normalized model root**

Create `app/three/scene-model.tsx`:

```tsx
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Material,
  Mesh,
  Object3D,
  Texture,
  type Scene,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { NormalizedSceneRoot } from "./normalized-scene-root";
import { useSceneGltf } from "./scene-loader";
import type { SceneDefinition, SceneRotation } from "./types";

function cloneMaterial(material: Material): Material {
  const clone = material.clone();
  const cloneRecord = clone as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(cloneRecord)) {
    if (value instanceof Texture) cloneRecord[key] = value.clone();
  }
  return clone;
}

export function cloneRuntimeScene(source: Object3D): Scene {
  const runtime = cloneSkeleton(source) as Scene;
  runtime.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });
  return runtime;
}

export function disposeRuntimeScene(runtime: Object3D): void {
  const disposedTextures = new Set<Texture>();
  runtime.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      for (const value of Object.values(
        material as unknown as Record<string, unknown>,
      )) {
        if (value instanceof Texture && !disposedTextures.has(value)) {
          disposedTextures.add(value);
          value.dispose();
        }
      }
      material.dispose();
    }
  });
}

export function SceneModel({
  scene,
  rotation,
}: {
  readonly scene: SceneDefinition;
  readonly rotation: SceneRotation;
}) {
  if (!scene.modelUrl) {
    throw new Error(`Scene ${scene.id} has no live model`);
  }

  const gltf = useSceneGltf(scene.modelUrl);
  const runtimeScene = useMemo(() => cloneRuntimeScene(gltf.scene), [gltf.scene]);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(
    () => () => {
      disposeRuntimeScene(runtimeScene);
    },
    [runtimeScene],
  );

  return (
    <NormalizedSceneRoot
      sceneId={scene.id}
      rotation={rotation}
      invalidate={invalidate}
    >
      <primitive object={runtimeScene} dispose={null} />
    </NormalizedSceneRoot>
  );
}
```

- [ ] **Step 7: Run cache and resource tests to verify GREEN**

Run:

```bash
npm run test:unit -- app/three/adjacent-scene-preloader.test.ts app/three/scene-model.test.ts
```

Expected: PASS, `2 test files passed`, `15 tests passed`.

- [ ] **Step 8: Refactor by checking Meshopt import and all R3F types**

Run:

```bash
npx tsc --noEmit
rg -n "MeshoptDecoder|setMeshoptDecoder" app/three/scene-loader.ts
npm run test:unit -- app/three/adjacent-scene-preloader.test.ts app/three/adjacent-scene-preloader.component.test.tsx app/three/scene-resource-cache.test.ts app/three/scene-model.test.ts app/three/scene-loader.test.ts app/three/scene-model.component.test.tsx app/three/normalized-scene-root.test.tsx
```

Expected: TypeScript exits 0; `rg` prints the import and configuration lines; Vitest reports `7 test files passed`, `31 tests passed`.

- [ ] **Step 9: Commit loading and bounded cache behavior**

```bash
git add app/three/scene-loader.ts app/three/scene-loader.test.ts app/three/adjacent-scene-preloader.tsx app/three/adjacent-scene-preloader.test.ts app/three/adjacent-scene-preloader.component.test.tsx app/three/scene-preload-policy.ts app/three/scene-resource-cache.ts app/three/scene-resource-cache.test.ts app/three/scene-resources.ts app/three/scene-model.tsx app/three/scene-model.test.ts app/three/scene-model.component.test.tsx docs/superpowers/plans/2026-07-09-personal-site-runtime.md
git commit -m "feat: load meshopt scenes with bounded cache"
```

## Task 10: Build the sole demand-loop canvas and context lifecycle

> **Implementation amendment (2026-07-11):** The final source supersedes the
> Canvas sketches below. `AdjacentScenePreloader` mounts inside the R3F root,
> outside the model Suspense/error subtree, so `loadEnabled={false}` commits
> model detachment before the same-root passive cache eviction. Camera, lights,
> context monitoring, and the preloader remain mounted when the model boundary
> fails. The Canvas port adds `preloadReady`, while the complete reset key stays
> `scene.id:activationVersion:renderVersion` below the sole Canvas and is also
> the cache owner. Pending/resolved shared URLs promote across owners, while a
> rejected URL stays pinned only for repeat renders of its failed owner and is
> fetched once for a new activation owner.
>
> Three r185 is WebGL2-only. The renderer acquires the exact attributed
> `webgl2` context once and passes it into Three, preventing Three's diagnostic
> second acquisition. If later construction fails, captured partial listeners
> are removed and the context is released. A stable, single-attempt async
> factory then records durable unavailability and resolves one minimal inert
> renderer behind a synchronous availability gate. R3F's un-awaited configure
> task therefore settles without rejection or retained waiters, while no model,
> context monitor, or cache owner can mount. The failure re-reports
> `webgl2-unavailable` immediately for each new activation. Readiness requires
> a live context both before and after render
> plus an observed increment of `renderer.info.render.frame`; a context lost
> during render can never produce a false first-frame report. Context listeners
> use current callback ports but remain registered once per renderer.
>
> Drei 10.7.7 `ContactShadows` is intentionally omitted in v1. That component
> retains non-declarative render targets/materials without cleanup and mutates
> scene render state without `try/finally`; it also costs five offscreen passes
> per demanded frame with smooth blur. The approved fallback is no shadow layer:
> alpha remains transparent, no background or ground plane is mounted, native
> shadows stay disabled, and the exact CSS route color remains the seamless
> visual ground. Task 10 now owns 21 tests across boundary, static contract,
> Canvas-port, real R3F component, failed-root, and suspended-load integration
> suites.

> **Demand-loop acceptance amendment (2026-07-11):** In addition to the
> injected invalidation spy from Task 8, Task 10/14 must exercise the real
> `frameloop="demand"`: a changed effective pose schedules a rendered frame,
> the frame observes the new Euler (never one pose behind), and an identical or
> idle pose does not keep rendering continuously.
>
> **Cancelable-load amendment (2026-07-11):** `SceneCanvasPortProps` also owns
> `activationVersion` and `loadEnabled`. Its reset key includes the activation
> version, and `SceneContents` mounts the model only while `loadEnabled` is
> true. A loader failure already trips the error boundary; a ten-second host
> timeout must likewise render `loadEnabled={false}` before the adjacent owner
> clears/aborts the cache record. This prevents a still-suspended SceneModel
> from retrying behind the error poster. A later explicit activation gets a new
> reset key and exactly one fresh current request.

**Files:**
- Create: `app/three/scene-error-boundary.test.tsx`
- Create: `app/three/scene-error-boundary.tsx`
- Create: `app/three/scene-canvas.contract.test.ts`
- Create: `app/three/scene-canvas.shell.test.tsx`
- Create: `app/three/scene-canvas.component.test.tsx`
- Create: `app/three/scene-canvas.init.integration.test.ts`
- Create: `app/three/scene-canvas.load.integration.test.tsx`
- Create: `app/three/scene-canvas.tsx`
- Modify: `app/three/scene-model.tsx`
- Modify: `app/three/scene-model.component.test.tsx`
- Modify: `app/three/scene-resource-cache.ts`
- Modify: `app/three/scene-resource-cache.test.ts`

- [ ] **Step 1: Write the failing error-boundary test**

Create `app/three/scene-error-boundary.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SceneErrorBoundary } from "./scene-error-boundary";

function BrokenScene({ message }: { readonly message: string }) {
  throw new Error(message);
}

describe("SceneErrorBoundary", () => {
  it.each([
    ["Failed to fetch model", "fetch"],
    ["Could not decode glTF buffer", "decode"],
  ] as const)("maps %s to the %s failure code", (message, reason) => {
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { container } = render(
      <SceneErrorBoundary resetKey="home-hero:0" onError={onError}>
        <BrokenScene message={message} />
      </SceneErrorBoundary>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(onError).toHaveBeenCalledWith(reason);
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Write the failing static canvas-contract test**

Create `app/three/scene-canvas.contract.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("persistent Canvas source contract", () => {
  it("uses demand rendering, bounded DPR, context recovery, and no orbit controls", async () => {
    const source = await readFile(
      new URL("./scene-canvas.tsx", import.meta.url),
      "utf8",
    );

    expect(source.match(/<Canvas\b/g)).toHaveLength(1);
    expect(source.indexOf("<Canvas")).toBeLessThan(
      source.indexOf("<SceneErrorBoundary"),
    );
    expect(source).toContain('frameloop="demand"');
    expect(source).toContain("dpr={[1, 1.5]}");
    expect(source).toContain('addEventListener("webglcontextlost"');
    expect(source).toContain('addEventListener("webglcontextrestored"');
    expect(source).toContain("gl.render(scene, camera)");
    expect(source).not.toContain("ContactShadows");
    expect(source).toContain("shadows={false}");
    expect(source).toContain("alpha: true");
    expect(source).not.toMatch(/scene\.background|attach=["']background["']/);
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/OrbitControls|MapControls|PresentationControls/);
  });
});
```

- [ ] **Step 3: Run both canvas tests to verify RED**

Run:

```bash
npm run test:unit -- app/three/scene-error-boundary.test.tsx app/three/scene-canvas.contract.test.ts
```

Expected: FAIL because `scene-error-boundary.tsx` and `scene-canvas.tsx` do not exist.

- [ ] **Step 4: Implement coded error mapping and resettable boundary**

Create `app/three/scene-error-boundary.tsx`:

```tsx
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { SceneFailureReason } from "./types";

export function classifySceneError(error: unknown): SceneFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|404|load failed/i.test(message)) return "fetch";
  if (/decode|parse|gltf|buffer|meshopt/i.test(message)) return "decode";
  return "unknown";
}

interface Props {
  readonly resetKey: string;
  readonly onError: (reason: SceneFailureReason) => void;
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _errorInfo: ErrorInfo) {
    this.props.onError(classifySceneError(error));
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
```

- [ ] **Step 5: Implement registry camera, light, first-frame, frame-health, and context components**

Create `app/three/scene-canvas.tsx`:

```tsx
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { PerspectiveCamera, type WebGLRenderer } from "three";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { SceneErrorBoundary } from "./scene-error-boundary";
import { SceneModel } from "./scene-model";
import type {
  SceneDefinition,
  SceneFailureReason,
  SceneRotation,
} from "./types";

export interface SceneCanvasPortProps {
  readonly scene: SceneDefinition;
  readonly rotation: SceneRotation;
  readonly activationVersion: number;
  readonly renderVersion: number;
  readonly loadEnabled: boolean;
  readonly preloadReady: boolean;
  readonly onFirstFrame: () => void;
  readonly onFailure: (reason: SceneFailureReason) => void;
  readonly onContextLost: () => void;
  readonly onContextRestored: () => void;
}

function ResponsiveCamera({ scene }: { readonly scene: SceneDefinition }) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const frame = width <= 767 ? scene.mobile : scene.desktop;
    camera.position.set(...frame.cameraPosition);
    camera.lookAt(...frame.cameraTarget);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = frame.fov;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, invalidate, scene, width]);

  return null;
}

function SceneLights({ scene }: { readonly scene: SceneDefinition }) {
  return (
    <>
      <ambientLight
        color={scene.lighting.ambient.color}
        intensity={scene.lighting.ambient.intensity}
      />
      <directionalLight
        color={scene.lighting.key.color}
        intensity={scene.lighting.key.intensity}
        position={scene.lighting.key.position}
        castShadow={scene.lighting.key.castShadow}
      />
    </>
  );
}

function ContextLifecycle({
  onContextLost,
  onContextRestored,
}: Pick<SceneCanvasPortProps, "onContextLost" | "onContextRestored">) {
  const gl = useThree((state) => state.gl) as WebGLRenderer;
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    const restored = () => {
      onContextRestored();
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, invalidate, onContextLost, onContextRestored]);

  return null;
}

function DemandRenderer({
  sceneId,
  onFirstFrame,
  onFailure,
}: Pick<SceneCanvasPortProps, "onFirstFrame" | "onFailure"> & {
  readonly sceneId: SceneDefinition["id"];
}) {
  const reported = useRef(false);
  const frameTimes = useRef<number[]>([]);

  useFrame(({ gl, scene, camera }) => {
    try {
      gl.render(scene, camera);
      const now = performance.now();
      const previous = frameTimes.current.at(-1);
      if (previous !== undefined && now - previous > 250) {
        frameTimes.current = [];
      }
      frameTimes.current.push(now);
      if (frameTimes.current.length >= 12) {
        const first = frameTimes.current[0];
        const last = frameTimes.current.at(-1) ?? first;
        const fps = Math.round(
          ((frameTimes.current.length - 1) * 1_000) / Math.max(1, last - first),
        );
        emitSceneRuntimeEvent({ status: "rotation-health", sceneId, fps });
        frameTimes.current = [];
      }
      if (!reported.current) {
        reported.current = true;
        onFirstFrame();
      }
    } catch {
      onFailure("unknown");
    }
  }, 1);

  return null;
}

function SceneContents(props: SceneCanvasPortProps) {
  return (
    <>
      <ResponsiveCamera scene={props.scene} />
      <SceneLights scene={props.scene} />
      <ContextLifecycle
        onContextLost={props.onContextLost}
        onContextRestored={props.onContextRestored}
      />
      {props.loadEnabled && props.scene.modelUrl ? (
        <Suspense fallback={null}>
          <SceneModel scene={props.scene} rotation={props.rotation} />
          <DemandRenderer
            sceneId={props.scene.id}
            onFirstFrame={props.onFirstFrame}
            onFailure={props.onFailure}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export function SceneCanvas(props: SceneCanvasPortProps) {
  const resetKey = `${props.scene.id}:${props.activationVersion}:${props.renderVersion}`;
  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={[1, 1.5]}
      shadows={false}
      camera={{
        position: [...props.scene.desktop.cameraPosition],
        fov: props.scene.desktop.fov,
      }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
    >
      <SceneErrorBoundary resetKey={resetKey} onError={props.onFailure}>
        <SceneContents key={resetKey} {...props} />
      </SceneErrorBoundary>
    </Canvas>
  );
}
```

- [ ] **Step 6: Run canvas tests to verify GREEN**

Run:

```bash
npm run test:unit -- app/three/scene-error-boundary.test.tsx app/three/scene-canvas.contract.test.ts app/three/scene-canvas.shell.test.tsx app/three/scene-canvas.component.test.tsx app/three/scene-canvas.init.integration.test.ts app/three/scene-canvas.load.integration.test.tsx
```

Expected: PASS, `6 test files passed`, `21 tests passed`.

- [ ] **Step 7: Refactor by checking canvas constraints and types**

Run:

```bash
npx tsc --noEmit
rg -n "frameloop=\"demand\"|dpr=|webglcontext|rotation-health|OrbitControls" app/three/scene-canvas.tsx
npm run test:unit -- app/three/scene-error-boundary.test.tsx app/three/scene-canvas.contract.test.ts app/three/scene-canvas.shell.test.tsx app/three/scene-canvas.component.test.tsx app/three/scene-canvas.init.integration.test.ts app/three/scene-canvas.load.integration.test.tsx app/three/normalized-scene-root.test.tsx app/three/runtime-events.test.ts
```

Expected: TypeScript exits 0; `rg` prints demand/DPR/context/health lines and no controls or shadow-pass line; Vitest reports `8 test files passed`, `30 tests passed`.

- [ ] **Step 8: Commit the persistent rendering core**

```bash
git add app/three/scene-error-boundary.tsx app/three/scene-error-boundary.test.tsx app/three/scene-canvas.tsx app/three/scene-canvas.contract.test.ts app/three/scene-canvas.shell.test.tsx app/three/scene-canvas.component.test.tsx app/three/scene-canvas.init.integration.test.ts app/three/scene-canvas.load.integration.test.tsx app/three/scene-model.tsx app/three/scene-model.component.test.tsx app/three/scene-resource-cache.ts app/three/scene-resource-cache.test.ts docs/superpowers/plans/2026-07-09-personal-site-runtime.md
git commit -m "feat: add demand-loop scene canvas"
```

## Task 11: Mount the poster-first host through one dynamic root boundary

> **Task 10 integration amendment (2026-07-11):** The host must not import or
> render `AdjacentScenePreloader`; the preloader now lives in the R3F root and
> receives `preloadReady={status === "ready"}` through
> `SceneCanvasPortProps`. `loadEnabled={status !== "error"}` therefore removes
> a suspended/failed model and clears its cache in one ordered inner-root
> commit. A renderer-construction callback with reason
> `webgl2-unavailable` follows the normal coded failure path while the poster
> stays visible.
>
> Every Canvas callback is activation-token guarded. Each callback closure
> captures the committed `scene.id:activationVersion`; before changing status,
> consuming the ready/failure once-refs, emitting an event, or incrementing
> `renderVersion`, it must prove that token is still current. Component tests
> retain the previous FakeCanvas props across an activation, invoke all stale
> first-frame/failure/context callbacks, and prove that none can mutate or
> report against the new activation. The new first frame must still report
> ready exactly once.

> **Task 11 implementation amendment (2026-07-11):** The lightweight
> poster/status host is always mounted so `disabled`, `unsupported`,
> uninitialized, and poster-only modes retain the stable runtime DOM contract.
> `SceneCanvasBoundary` uses `React.lazy` to fetch the Three/R3F module only
> when `canvasEnabled` is true; Save-Data, explicit-off, unsupported, and
> unauthorized routes therefore do not pay the heavy 3D payload. A narrow
> runtime-sibling error boundary preserves the semantic page if either dynamic
> chunk rejects.
>
> The final host uses one commit-installed current-attempt record rather than
> render-time ref mutation or an unbounded activation map. The exact activation
> descriptor and render generation guard every callback, timer, event, and
> status write. Context restoration advances the generation once, spurious or
> post-failure restoration is inert, a failure is terminal for that activation,
> and StrictMode effect replay reuses the once-only event ledger. The 25-test
> host/toggle/shell slice and 44-test provider/host/rotation/toggle slice
> supersede the illustrative counts below.
>
> Canonical WebP poster URLs are intentionally owned by the registry but are
> not published until the poster-generation task. Task 11 is therefore not a
> standalone deploy point; continue through Tasks 13 and 15 before browser
> release validation.

**Files:**
- Create: `app/three/scene-runtime-host.test.tsx`
- Create: `app/three/scene-runtime-host.tsx`
- Create: `app/three/three-preference-toggle.test.tsx`
- Create: `app/three/three-preference-toggle.tsx`
- Create: `app/three/runtime-shell.contract.test.ts`
- Create: `app/three/scene-runtime-boundary.tsx`
- Create: `app/three/scene-canvas-boundary.tsx`
- Create: `app/three/scene-runtime.css`
- Modify: `app/three/scene-provider.tsx`
- Modify: `app/layout.tsx`

- [x] **Step 1: Write the failing host state-machine tests**

Create `app/three/scene-runtime-host.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitSceneRuntimeEvent } from "./runtime-events";
import { getSceneDefinition } from "./scene-registry";
import type { SceneCanvasPortProps } from "./scene-canvas";
import { SceneRuntimeHostView } from "./scene-runtime-host";
import type { ThreeStatus } from "./types";

vi.mock("./runtime-events", () => ({
  emitSceneRuntimeEvent: vi.fn(),
}));

const FakeCanvas: ComponentType<SceneCanvasPortProps> = (props) => (
  <div data-testid="fake-canvas">
    <button data-testid="first-frame" onClick={props.onFirstFrame} />
    <button
      data-testid="fetch-failure"
      onClick={() => props.onFailure("fetch")}
    />
    <button
      data-testid="decode-failure"
      onClick={() => props.onFailure("decode")}
    />
    <button data-testid="context-lost" onClick={props.onContextLost} />
    <button data-testid="context-restored" onClick={props.onContextRestored} />
  </div>
);

function Harness({
  initial = "loading",
  canvasEnabled = initial !== "unsupported" && initial !== "disabled",
}: {
  initial?: ThreeStatus;
  canvasEnabled?: boolean;
}) {
  const [status, setStatus] = useState<ThreeStatus>(initial);
  return (
    <>
      <SceneRuntimeHostView
        scene={getSceneDefinition("home-hero")}
        status={status}
        canvasEnabled={canvasEnabled}
        rotation={{ yaw: 0, pitch: 0 }}
        activationVersion={0}
        onStatusChange={setStatus}
        onRotate={vi.fn()}
        CanvasComponent={FakeCanvas}
      />
      <a href="/experience">Experience</a>
    </>
  );
}

function PersistenceHarness() {
  const [sceneId, setSceneId] = useState<
    "home-hero" | "eog-poster" | "projects-hero"
  >("home-hero");
  const [status, setStatus] = useState<ThreeStatus>("ready");
  const [activationVersion, setActivationVersion] = useState(0);
  const activate = (
    nextSceneId: "home-hero" | "eog-poster" | "projects-hero",
    nextStatus: ThreeStatus,
  ) => {
    setSceneId(nextSceneId);
    setStatus(nextStatus);
    setActivationVersion((version) => version + 1);
  };

  return (
    <>
      <SceneRuntimeHostView
        scene={getSceneDefinition(sceneId)}
        status={status}
        canvasEnabled
        rotation={{ yaw: 0, pitch: 0 }}
        activationVersion={activationVersion}
        onStatusChange={setStatus}
        onRotate={vi.fn()}
        CanvasComponent={FakeCanvas}
      />
      <button onClick={() => activate("eog-poster", "poster")}>
        show EOG
      </button>
      <button onClick={() => activate("projects-hero", "loading")}>
        show projects
      </button>
      <button onClick={() => activate("home-hero", "loading")}>show home</button>
    </>
  );
}

describe("SceneRuntimeHostView", () => {
  beforeEach(() => {
    vi.mocked(emitSceneRuntimeEvent).mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("keeps the poster until the first successful rendered frame", () => {
    render(<Harness />);
    const host = screen.getByTestId("scene-runtime-host");
    expect(host).toHaveAttribute("data-three-status", "loading");
    expect(host).toHaveAttribute("data-active-scene-id", "home-hero");
    expect(host.querySelector("img")).toHaveAttribute(
      "src",
      "/posters/home-hero-desktop.webp",
    );

    fireEvent.click(screen.getByTestId("first-frame"));

    expect(host).toHaveAttribute("data-three-status", "ready");
    expect(screen.getByTestId("scene-rotation-area")).toBeInTheDocument();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready", sceneId: "home-hero" }),
    );
  });

  it("preserves the exact Canvas through live, poster-only, and live scenes", () => {
    render(<PersistenceHarness />);
    const canvas = screen.getByTestId("fake-canvas");

    fireEvent.click(screen.getByRole("button", { name: "show EOG" }));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "poster",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);

    fireEvent.click(screen.getByRole("button", { name: "show projects" }));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);

    fireEvent.click(screen.getByTestId("fetch-failure"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);

    fireEvent.click(screen.getByRole("button", { name: "show home" }));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
  });

  it.each([
    ["fetch", "fetch-failure"],
    ["decode", "decode-failure"],
  ] as const)("keeps the poster and stable hooks on %s failure", (reason, testId) => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId(testId));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(
      screen.getByTestId("scene-runtime-host").querySelector("img"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("fake-canvas")).toBeInTheDocument();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        sceneId: "home-hero",
        reason,
      }),
    );
    expect(screen.getByRole("link", { name: "Experience" })).toHaveAttribute(
      "href",
      "/experience",
    );
    fireEvent.click(screen.getByTestId("first-frame"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
  });

  it("times out a scene that never produces its first frame", () => {
    vi.useFakeTimers();
    render(<Harness />);

    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
    expect(
      screen.getByTestId("scene-runtime-host").querySelector("img"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("fake-canvas")).toBeInTheDocument();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        sceneId: "home-hero",
        reason: "timeout",
      }),
    );
    expect(screen.getByRole("link", { name: "Experience" })).toHaveAttribute(
      "href",
      "/experience",
    );
    fireEvent.click(screen.getByTestId("first-frame"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "error",
    );
  });

  it("keeps Canvas mounted but reveals the poster through context loss", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("first-frame"));
    fireEvent.click(screen.getByTestId("context-lost"));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "context-lost",
    );
    expect(screen.getByTestId("fake-canvas")).toBeInTheDocument();
    expect(
      screen.getByTestId("scene-runtime-host").querySelector("img"),
    ).toBeInTheDocument();
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith({
      status: "context-lost",
      sceneId: "home-hero",
      reason: "context-lost",
    });

    fireEvent.click(screen.getByTestId("context-restored"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "loading",
    );
    fireEvent.click(screen.getByTestId("first-frame"));
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "ready",
    );
  });

  it("returns a poster-only scene to poster status after context restoration", () => {
    render(<PersistenceHarness />);
    const canvas = screen.getByTestId("fake-canvas");
    fireEvent.click(screen.getByRole("button", { name: "show EOG" }));
    fireEvent.click(screen.getByTestId("context-lost"));
    fireEvent.click(screen.getByTestId("context-restored"));

    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "poster",
    );
    expect(screen.getByTestId("fake-canvas")).toBe(canvas);
  });

  it("keeps unsupported mode poster-only and reports the coded local failure", () => {
    render(<Harness initial="unsupported" />);

    expect(screen.queryByTestId("fake-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "unsupported",
    );
    expect(emitSceneRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        sceneId: "home-hero",
        reason: "webgl2-unavailable",
      }),
    );
  });

  it("does not mount WebGL when the visitor explicitly disables 3D", () => {
    render(<Harness initial="disabled" />);
    expect(screen.queryByTestId("fake-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-three-status",
      "disabled",
    );
  });
});
```

- [x] **Step 2: Write the failing preference-toggle test**

Create `app/three/three-preference-toggle.test.tsx`:

```tsx
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

  it("disables the control when WebGL 2 is unavailable", () => {
    const { runtime } = value({ threeEnabled: false, threeSupported: false });
    render(
      <SceneRuntimeContext.Provider value={runtime}>
        <ThreePreferenceToggle />
      </SceneRuntimeContext.Provider>,
    );

    expect(screen.getByRole("button", { name: "3D off" })).toBeDisabled();
  });
});
```

- [x] **Step 3: Write the failing dynamic-shell source contract**

Create `app/three/runtime-shell.contract.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("persistent runtime shell", () => {
  it("dynamically disables SSR only for the WebGL host", async () => {
    const boundary = await source("./scene-runtime-boundary.tsx");
    expect(boundary).toContain('dynamic(() => import("./scene-runtime-host")');
    expect(boundary).toContain("ssr: false");
  });

  it("mounts one provider and one runtime boundary in the root shell", async () => {
    const [layout, provider] = await Promise.all([
      source("../layout.tsx"),
      source("./scene-provider.tsx"),
    ]);
    expect(layout.match(/<SceneProvider>/g)).toHaveLength(1);
    expect(provider.match(/<SceneRuntimeBoundary\s*\/>/g)).toHaveLength(1);
    expect(provider.match(/<ThreePreferenceToggle\s*\/>/g)).toHaveLength(1);
  });

  it("uses immediate poster/canvas visibility and a 100svh fixed host", async () => {
    const css = await source("./scene-runtime.css");
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/height:\s*100svh/);
    expect(css).toMatch(/touch-action:\s*pan-y pinch-zoom/);
    expect(css).toMatch(/\.scene-runtime\s*\{[\s\S]*?z-index:\s*1/);
    expect(css).toMatch(/\.site-shell__content\s*\{[\s\S]*?z-index:\s*auto/);
    expect(css).toMatch(/\.scene-section\s*\{[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.page-hero\.scene-section\s*\{[\s\S]*?background:\s*transparent/);
    expect(css).not.toMatch(/transition\s*:/);
  });
});
```

- [x] **Step 4: Run host/shell/toggle tests to verify RED**

Run:

```bash
npm run test:unit -- app/three/scene-runtime-host.test.tsx app/three/three-preference-toggle.test.tsx app/three/runtime-shell.contract.test.ts
```

Expected: FAIL with unresolved host, toggle, boundary, and stylesheet files.

- [x] **Step 5: Implement the host view and state machine**

Create `app/three/scene-runtime-host.tsx`:

```tsx
"use client";

import type { ComponentType, CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { emitSceneRuntimeEvent } from "./runtime-events";
import {
  SceneCanvas,
  type SceneCanvasPortProps,
} from "./scene-canvas";
import { ScenePoster } from "./scene-poster";
import { SceneRotationArea } from "./scene-rotation-area";
import { useSceneRuntime } from "./scene-runtime-context";
import type {
  SceneDefinition,
  SceneFailureReason,
  SceneRotation,
  ThreeStatus,
} from "./types";

export interface SceneRuntimeHostViewProps {
  readonly scene: SceneDefinition;
  readonly status: ThreeStatus;
  readonly canvasEnabled: boolean;
  readonly rotation: SceneRotation;
  readonly activationVersion: number;
  readonly onStatusChange: (status: ThreeStatus) => void;
  readonly onRotate: (
    deltaX: number,
    deltaY: number,
    allowPitch: boolean,
  ) => void;
  readonly CanvasComponent: ComponentType<SceneCanvasPortProps>;
}

export function SceneRuntimeHostView({
  scene,
  status,
  canvasEnabled,
  rotation,
  activationVersion,
  onStatusChange,
  onRotate,
  CanvasComponent,
}: SceneRuntimeHostViewProps) {
  const [renderVersion, setRenderVersion] = useState(0);
  const activationKey = `${scene.id}:${activationVersion}`;
  const activationKeyRef = useRef(activationKey);
  const startedAt = useRef(performance.now());
  const readyReported = useRef(false);
  const failureReported = useRef(false);

  if (activationKeyRef.current !== activationKey) {
    activationKeyRef.current = activationKey;
    startedAt.current = performance.now();
    readyReported.current = false;
    failureReported.current = false;
  }

  const reportFailure = useCallback(
    (reason: SceneFailureReason) => {
      onStatusChange("error");
      if (failureReported.current) return;
      failureReported.current = true;
      emitSceneRuntimeEvent({
        status: "failure",
        sceneId: scene.id,
        reason,
        durationMs: Math.round(performance.now() - startedAt.current),
      });
    },
    [onStatusChange, scene.id],
  );

  useEffect(() => {
    if (status !== "loading" || !scene.modelUrl) return;
    const timeout = window.setTimeout(() => reportFailure("timeout"), 10_000);
    return () => window.clearTimeout(timeout);
  }, [reportFailure, scene.modelUrl, status]);

  useEffect(() => {
    if (status !== "unsupported" || failureReported.current) return;
    failureReported.current = true;
    emitSceneRuntimeEvent({
      status: "failure",
      sceneId: scene.id,
      reason: "webgl2-unavailable",
      durationMs: Math.round(performance.now() - startedAt.current),
    });
  }, [scene.id, status]);

  const firstFrame = useCallback(() => {
    if (failureReported.current) return;
    onStatusChange("ready");
    if (readyReported.current) return;
    readyReported.current = true;
    emitSceneRuntimeEvent({
      status: "ready",
      sceneId: scene.id,
      durationMs: Math.round(performance.now() - startedAt.current),
    });
  }, [onStatusChange, scene.id]);

  const contextLost = useCallback(() => {
    onStatusChange("context-lost");
    emitSceneRuntimeEvent({
      status: "context-lost",
      sceneId: scene.id,
      reason: "context-lost",
    });
  }, [onStatusChange, scene.id]);

  const contextRestored = useCallback(() => {
    onStatusChange(scene.modelUrl ? "loading" : "poster");
    setRenderVersion((version) => version + 1);
  }, [onStatusChange, scene.modelUrl]);

  const keepsCanvasMounted = canvasEnabled;

  return (
    <div
      aria-hidden="true"
      className="scene-runtime"
      data-testid="scene-runtime-host"
      data-three-status={status}
      data-active-scene-id={scene.id}
      style={{ "--scene-background": scene.background } as CSSProperties}
    >
      <ScenePoster
        scene={scene}
        className="scene-runtime__poster"
        priority
      />
      {keepsCanvasMounted ? (
        <div className="scene-runtime__canvas">
          <CanvasComponent
            scene={scene}
            rotation={rotation}
            activationVersion={activationVersion}
            renderVersion={renderVersion}
            loadEnabled={status !== "error"}
            preloadReady={status === "ready"}
            onFirstFrame={firstFrame}
            onFailure={reportFailure}
            onContextLost={contextLost}
            onContextRestored={contextRestored}
          />
        </div>
      ) : null}
      {status === "ready" ? (
        <SceneRotationArea
          desktop={scene.desktop.rotationArea}
          mobile={scene.mobile.rotationArea}
          onDelta={onRotate}
        />
      ) : null}
    </div>
  );
}

export function SceneRuntimeHost() {
  const runtime = useSceneRuntime();
  return (
    <SceneRuntimeHostView
      scene={runtime.activeScene}
      status={runtime.status}
      canvasEnabled={
        runtime.sceneActivationAllowed &&
        runtime.threeInitialized &&
        runtime.threeEnabled &&
        runtime.threeSupported
      }
      rotation={runtime.rotation}
      activationVersion={runtime.activationVersion}
      onStatusChange={runtime.setStatus}
      onRotate={runtime.rotateBy}
      CanvasComponent={SceneCanvas}
    />
  );
}
```

- [x] **Step 6: Implement the accessible preference control**

Create `app/three/three-preference-toggle.tsx`:

```tsx
"use client";

import { useSceneRuntime } from "./scene-runtime-context";

export function ThreePreferenceToggle() {
  const runtime = useSceneRuntime();
  const label = runtime.threeEnabled ? "3D on" : "3D off";

  return (
    <button
      type="button"
      className="three-preference-toggle"
      aria-label={label}
      aria-pressed={runtime.threeEnabled}
      disabled={!runtime.threeInitialized || !runtime.threeSupported}
      onClick={() => runtime.setThreeEnabled(!runtime.threeEnabled)}
    >
      {label}
    </button>
  );
}
```

- [x] **Step 7: Implement the dynamic WebGL-only boundary**

Create `app/three/scene-runtime-boundary.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

const DynamicSceneRuntimeHost = dynamic(
  () =>
    import("./scene-runtime-host").then((module) => module.SceneRuntimeHost),
  {
    ssr: false,
    loading: () => null,
  },
);

export function SceneRuntimeBoundary() {
  return <DynamicSceneRuntimeHost />;
}
```

- [x] **Step 8: Mount exactly one boundary and toggle inside `SceneProvider`**

Add imports to `app/three/scene-provider.tsx`:

```tsx
import { SceneRuntimeBoundary } from "./scene-runtime-boundary";
import { ThreePreferenceToggle } from "./three-preference-toggle";
```

Replace the provider return with:

```tsx
return (
  <SceneRuntimeContext.Provider value={value}>
    <SceneRuntimeBoundary />
    <ThreePreferenceToggle />
    {children}
  </SceneRuntimeContext.Provider>
);
```

- [x] **Step 9: Add the fixed host and immediate poster/canvas CSS**

Create `app/three/scene-runtime.css`:

```css
.scene-runtime {
  --scene-background: transparent;
  position: fixed;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100svh;
  overflow: hidden;
  pointer-events: none;
  background: var(--scene-background);
}

.scene-runtime__poster,
.scene-runtime__poster img,
.scene-runtime__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.scene-runtime__poster {
  display: block;
  visibility: visible;
}

.scene-runtime__poster img {
  display: block;
  object-fit: cover;
}

.scene-runtime__canvas {
  visibility: hidden;
}

.scene-runtime[data-three-status="ready"] .scene-runtime__poster {
  visibility: hidden;
}

.scene-runtime[data-three-status="ready"] .scene-runtime__canvas {
  visibility: visible;
}

.scene-runtime__rotation-area {
  position: absolute;
  top: var(--rotation-top);
  right: var(--rotation-right);
  bottom: var(--rotation-bottom);
  left: var(--rotation-left);
  z-index: 2;
  pointer-events: auto;
  cursor: grab;
  touch-action: pan-y pinch-zoom;
}

.scene-runtime__rotation-area:active {
  cursor: grabbing;
}

.scene-section {
  position: relative;
  z-index: 2;
  isolation: isolate;
  pointer-events: none;
}

.scene-section__poster {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.scene-section__poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scene-section__content {
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.page-hero__content {
  display: contents;
}

.scene-section__content :is(a, button, input, select, textarea),
.scene-copy-surface,
.chapter-copy,
.page-hero__copy,
.scroll-cue {
  pointer-events: auto;
}

.site-shell__content {
  z-index: auto;
}

.page-hero.scene-section {
  background: transparent;
}

.page-hero .scene-section__poster.page-hero__poster {
  z-index: -3;
}

.site-shell[data-route="experience"] .content-surface,
.site-shell[data-route="projects"] .content-surface {
  z-index: auto;
}

.model-free-surface {
  position: relative;
  z-index: 2;
  background: #eeeeee;
}

.chapter-model-space {
  min-height: clamp(20rem, 50vw, 39rem);
  pointer-events: none;
}

.scene-section[data-scene-active="true"][data-scene-status="ready"]
  .scene-section__poster {
  visibility: hidden;
}

.three-preference-toggle {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 100;
  min-width: 4.75rem;
  min-height: 2.75rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  color: #505050;
  background: #eeeeee;
  font: inherit;
  cursor: pointer;
}

.three-preference-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 767px) {
  .scene-runtime__rotation-area {
    top: var(--rotation-mobile-top);
    right: var(--rotation-mobile-right);
    bottom: var(--rotation-mobile-bottom);
    left: var(--rotation-mobile-left);
  }

  .chapter-model-space {
    min-height: min(78vw, 28rem);
  }
}
```

- [x] **Step 10: Integrate the provider at the root layout boundary**

Add these imports to `app/layout.tsx` while preserving the final metadata and font declarations supplied by the foundation plan:

```tsx
import { SiteShell } from "../components/site-shell";
import { SceneProvider } from "./three/scene-provider";
import "./three/scene-runtime.css";
```

The final body structure must be exactly:

```tsx
<body className={`${nunitoSans.variable} ${fraunces.variable}`}>
  <SceneProvider>
    <SiteShell>{children}</SiteShell>
  </SceneProvider>
</body>
```

`components/site-shell.tsx` remains the foundation navigation client component. It owns navigation, semantic route children, and footer, and it must not import `SceneProvider`, `SceneRuntimeBoundary`, or `Canvas`.

- [x] **Step 11: Run host/shell/toggle tests to verify GREEN**

Run:

```bash
npm run test:unit -- app/three/scene-runtime-host.test.tsx app/three/three-preference-toggle.test.tsx app/three/runtime-shell.contract.test.ts
```

Expected: PASS, `3 test files passed`, `14 tests passed`.

- [x] **Step 12: Refactor with the complete component slice and type check**

Run:

```bash
npx tsc --noEmit
npm run test:unit -- app/three/scene-provider.test.tsx app/three/scene-runtime-host.test.tsx app/three/scene-rotation-area.test.tsx app/three/three-preference-toggle.test.tsx
```

Expected: TypeScript exits 0; Vitest reports `4 test files passed`, `34 tests passed`.

- [x] **Step 13: Commit the persistent poster-first shell**

```bash
git add app/layout.tsx app/three/scene-provider.tsx app/three/scene-canvas-boundary.tsx app/three/scene-runtime-boundary.tsx app/three/scene-runtime-host.tsx app/three/scene-runtime-host.test.tsx app/three/three-preference-toggle.tsx app/three/three-preference-toggle.test.tsx app/three/scene-runtime.css app/three/runtime-shell.contract.test.ts docs/superpowers/plans/2026-07-09-personal-site-runtime.md
git commit -m "feat: mount persistent poster-first three runtime"
```

## Task 12: Replace foundation scene seams with registered runtime sections

> **Execution-order amendment (2026-07-11):** Keep `SceneSection` internal while
> Tasks 13 and 15 create the capture route and all canonical WebPs. Execute the
> remaining route swap in this task only after
> `node scripts/assets/validate.mjs --require-posters` passes. The practical
> order after Task 11 is Tasks 13, 15, 12, 14, then 16. This prevents public
> routes from briefly
> publishing canonical poster URLs that return 404.

**Files:**
- Create: `app/three/foundation-runtime-integration.test.ts`
- Modify: `content/site-content.ts`
- Modify: `components/page-hero.tsx`
- Modify: `app/page.tsx`
- Modify: `app/experience/page.tsx`
- Modify: `app/projects/page.tsx`
- Modify: `app/contact/page.tsx`

- [ ] **Step 1: Write the failing content-path and registration source test**

Create `app/three/foundation-runtime-integration.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { experience, projects, routes } from "../../content/site-content";

describe("foundation to runtime integration", () => {
  it("publishes only canonical desktop poster paths through content", () => {
    expect(routes.map((route) => route.heroPoster)).toEqual([
      "/posters/home-hero-desktop.webp",
      "/posters/experience-hero-desktop.webp",
      "/posters/projects-hero-desktop.webp",
      "/posters/contact-hero-desktop.webp",
    ]);
    expect(experience.map((chapter) => chapter.poster)).toEqual([
      "/posters/nasa-rocket-desktop.webp",
      "/posters/eog-poster-desktop.webp",
      "/posters/paycom-poster-desktop.webp",
    ]);
    expect(projects.map((project) => project.poster)).toEqual([
      "/posters/league-ban-desktop.webp",
      "/posters/froggie-adventures-desktop.webp",
    ]);
  });

  it("uses SceneSection for heroes and every feature scene", async () => {
    const [hero, experiencePage, projectsPage] = await Promise.all([
      readFile("components/page-hero.tsx", "utf8"),
      readFile("app/experience/page.tsx", "utf8"),
      readFile("app/projects/page.tsx", "utf8"),
    ]);

    expect(hero).toContain("<SceneSection");
    expect(hero).toContain('contentClassName="page-hero__content"');
    expect(hero).toContain('posterClassName="page-hero__poster"');
    expect(hero).toContain("posterPriority");
    expect(experiencePage.match(/<SceneSection\b/g)).toHaveLength(2);
    expect(projectsPage.match(/<SceneSection\b/g)).toHaveLength(1);
    expect(experiencePage.match(/className="chapter-model-space"/g)).toHaveLength(1);
    expect(projectsPage.match(/className="chapter-model-space"/g)).toHaveLength(1);
    expect(experiencePage).toContain('contentClassName="content-grid"');
    expect(projectsPage).toContain('className="content-grid model-free-surface"');
    expect(experiencePage).not.toContain("<ScenePoster");
    expect(projectsPage).not.toContain("<ScenePoster");
  });
});
```

- [ ] **Step 2: Run the integration test to verify RED**

Run: `npm run test:unit -- app/three/foundation-runtime-integration.test.ts`

Expected: FAIL because content still references foundation PNGs and the page components do not import `SceneSection`.

- [ ] **Step 3: Type content scene IDs and replace every content poster path**

Add this import to the top of `content/site-content.ts`:

```ts
import type { SceneId } from "../app/three/types";
```

Change `RouteDefinition.heroSceneId`, `ExperienceChapter.sceneId`, and `ProjectChapter.sceneId` from `string` to `SceneId`.

Replace the nine content poster values exactly:

```ts
// routes
heroPoster: "/posters/home-hero-desktop.webp",
heroPoster: "/posters/experience-hero-desktop.webp",
heroPoster: "/posters/projects-hero-desktop.webp",
heroPoster: "/posters/contact-hero-desktop.webp",

// experience
poster: "/posters/nasa-rocket-desktop.webp",
poster: "/posters/eog-poster-desktop.webp",
poster: "/posters/paycom-poster-desktop.webp",

// projects
poster: "/posters/league-ban-desktop.webp",
poster: "/posters/froggie-adventures-desktop.webp",
```

After the edit, run:

```bash
rg -n "reference\.png|/images/froggie-gameplay\.png" content/site-content.ts
```

Expected: no matches and exit code 1.

- [ ] **Step 4: Replace `PageHero` with a registered runtime section**

Replace `components/page-hero.tsx` completely:

```tsx
import { SceneSection } from "../app/three/scene-section";
import type { SceneId } from "../app/three/types";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  summary: string;
  sceneId: SceneId;
  titleStyle?: "rounded" | "editorial";
};

export function PageHero({
  eyebrow,
  title,
  summary,
  sceneId,
  titleStyle = "rounded",
}: PageHeroProps) {
  return (
    <SceneSection
      className={`page-hero page-hero--${titleStyle}`}
      contentClassName="page-hero__content"
      posterClassName="page-hero__poster"
      posterPriority
      sceneId={sceneId}
    >
      <div className="page-hero__wash" aria-hidden="true" />
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-hero__summary">{summary}</p>
      </div>
      <a className="scroll-cue" href="#page-content">
        Continue
      </a>
    </SceneSection>
  );
}
```

- [ ] **Step 5: Remove the obsolete `poster` prop from all four PageHero calls**

Apply this exact deletion once in each of `app/page.tsx`, `app/experience/page.tsx`, `app/projects/page.tsx`, and `app/contact/page.tsx`:

```diff
       <PageHero
         eyebrow={route.eyebrow}
-        poster={route.heroPoster}
         sceneId={route.heroSceneId}
         summary={route.heroSummary}
         title={route.title}
```

- [ ] **Step 6: Register the Experience introduction and every company chapter**

In `app/experience/page.tsx`, replace the `ScenePoster` import with:

```tsx
import { SceneSection } from "../three/scene-section";
```

Replace the existing introduction `<header ... data-scene-id="experience-intro">...</header>` with:

```tsx
<SceneSection
  contentClassName="content-grid"
  data-required-live="true"
  sceneId="experience-intro"
>
  <div className="scene-copy-surface">
    <p className="section-kicker">The through line</p>
    <h2 className="section-heading">Learning by building what matters.</h2>
  </div>
  <div className="prose scene-copy-surface">
    <p>
      I think about my experience as a set of company chapters rather than a
      list of disconnected tasks. Each one changed the scale, stakes, or
      audience of the software I was learning to build.
    </p>
    <a className="text-link" download href={contact.resumeHref}>
      Download my résumé
    </a>
  </div>
</SceneSection>
```

Replace the outer element inside `experience.map` with this complete registered chapter; preserve the existing verified role and narrative loops exactly as shown:

```tsx
<SceneSection
  className="chapter"
  data-required-live={chapter.requiredLive}
  id={chapter.id}
  key={chapter.id}
  sceneId={chapter.sceneId}
>
  <div className="chapter-layout">
    <div aria-hidden="true" className="chapter-model-space" />
    <div className="chapter-copy">
      <p className="section-kicker">Company chapter</p>
      <h2 className="chapter-heading">{chapter.company}</h2>
      <ul className="role-list" aria-label={`${chapter.company} roles`}>
        {chapter.roles.map((role) => (
          <li
            className="role-entry"
            key={`${role.title}-${role.dates}`}
          >
            <strong>{role.title}</strong>
            <span>{role.dates}</span>
          </li>
        ))}
      </ul>
      <div className="prose">
        {chapter.narrative.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  </div>
</SceneSection>
```

- [ ] **Step 7: Register both project chapters**

In `app/projects/page.tsx`, replace the `ScenePoster` import with:

```tsx
import { SceneSection } from "../three/scene-section";
```

Change the projects introduction header so it remains an opaque, model-free
semantic surface while the persistent Canvas is layered over the surrounding
chapter background:

```diff
-          <header className="content-grid">
+          <header className="content-grid model-free-surface">
```

Replace the outer element inside `projects.map` with:

```tsx
<SceneSection
  className="chapter"
  data-required-live={project.requiredLive}
  id={project.id}
  key={project.id}
  sceneId={project.sceneId}
>
  <div className="chapter-layout">
    <div aria-hidden="true" className="chapter-model-space" />
    <div className="chapter-copy">
      <p className="section-kicker">Creative project</p>
      <h2 className="chapter-heading">{project.name}</h2>
      <div className="prose">
        <p>{project.reflection}</p>
      </div>
      <p className="technical-line">{project.technicalLine}</p>
      <a
        className="text-link"
        href={project.repository}
        rel="noreferrer"
        target="_blank"
      >
        View {project.name} on GitHub
      </a>
    </div>
  </div>
</SceneSection>
```

- [ ] **Step 8: Run the integration test to verify GREEN**

Run: `npm run test:unit -- app/three/foundation-runtime-integration.test.ts`

Expected: PASS, `2 passed`.

- [ ] **Step 9: Refactor through content, route, and type suites**

Run:

```bash
npx tsc --noEmit
npm run test:unit -- app/three/foundation-runtime-integration.test.ts tests/site-content.test.ts tests/home-page.test.tsx tests/experience-page.test.tsx tests/projects-page.test.tsx tests/contact-page.test.tsx
```

Expected: TypeScript exits 0 and all named content/route tests pass.

- [ ] **Step 10: Commit registered production sections**

```bash
git add content/site-content.ts components/page-hero.tsx app/page.tsx app/experience/page.tsx app/projects/page.tsx app/contact/page.tsx app/three/foundation-runtime-integration.test.ts
git commit -m "feat: register every production scene section"
```

## Task 13: Add the environment-gated deterministic capture route

> **Task 13 implementation amendment (2026-07-11):** In addition to the
> source/policy contract, `page.test.tsx` executes the server component with a
> mocked `notFound()` boundary, and `scene-capture-viewport.test.tsx` composes
> the viewport with the real provider. Together they cover repeated and invalid
> query values, fail-closed flags, Home capture authorization, live and
> poster-only activation, and the Contact-to-Home navigation wrap.
>
> Vinext 0.0.50 requires two scoped compatibility seams. The default page keeps
> the environment gate shallow and delegates query validation to an async
> nested server component because Vinext's classifier supplies an invalid
> `searchParams` probe. A route-local loading boundary also bypasses that probe
> in normal navigation. The Cloudflare Vite environment receives only the
> explicit `SCENE_CAPTURE` and `SITE_ENV` local vars; both still default closed.
> Actual servers verify preview valid/invalid responses as 200/404, a built
> preview response as 200 with `noindex`, and a capture-off production response
> as 404. The final focused slice is 3 files / 15 tests; the full unit suite is
> 37 files / 209 tests.

**Files:**
- Create: `app/scene-capture/capture-policy.test.ts`
- Create: `app/scene-capture/capture-policy.ts`
- Create: `app/scene-capture/loading.tsx`
- Create: `app/scene-capture/page.test.tsx`
- Create: `app/scene-capture/scene-capture-viewport.tsx`
- Create: `app/scene-capture/scene-capture-viewport.test.tsx`
- Create: `app/scene-capture/page.tsx`
- Modify: `app/three/scene-runtime.css`
- Modify: `vite.config.ts`

- [x] **Step 1: Write the failing capture policy and source contract**

Create `app/scene-capture/capture-policy.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isSceneCaptureEnabled } from "./capture-policy";

describe("scene capture route", () => {
  it("is available only under an explicit local/CI environment flag", () => {
    expect(
      isSceneCaptureEnabled({ SCENE_CAPTURE: "1", SITE_ENV: "preview" }),
    ).toBe(true);
    expect(isSceneCaptureEnabled({ SCENE_CAPTURE: "1" })).toBe(false);
    expect(isSceneCaptureEnabled({ SCENE_CAPTURE: "0" })).toBe(false);
    expect(isSceneCaptureEnabled({})).toBe(false);
    expect(
      isSceneCaptureEnabled({ SCENE_CAPTURE: "1", SITE_ENV: "production" }),
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
    const source = await readFile("app/scene-capture/page.tsx", "utf8");
    expect(source).toContain("robots: { index: false, follow: false }");
    expect(source).toContain("isSceneId(sceneValue)");
    expect(source).toContain("notFound()");
  });

  it("keeps ordinary browser tests preview-safe and poster capture opt-in", async () => {
    const source = await readFile("playwright.config.ts", "utf8");
    expect(source).toContain("testIgnore: process.env.POSTER_CAPTURE_MODE");
    expect(source).toContain('process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1"');
    expect(source).toContain('NODE_ENV: "development"');
    expect(source).toContain('NEXT_PUBLIC_SITE_ENV: "preview"');
    expect(source).toContain('SITE_ENV: "preview"');
    expect(source).toContain('"--use-gl=angle"');
    expect(source).toContain('"--use-angle=swiftshader"');
    expect(source).toContain('"--enable-unsafe-swiftshader"');
  });
});
```

- [x] **Step 2: Run the capture test to verify RED**

Run: `npm run test:unit -- app/scene-capture/capture-policy.test.ts`

Expected: FAIL with `Failed to resolve import "./capture-policy"`.

- [x] **Step 3: Implement the explicit capture gate**

Create `app/scene-capture/capture-policy.ts`:

```ts
export function isSceneCaptureEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.SCENE_CAPTURE === "1" && env.SITE_ENV === "preview";
}
```

- [x] **Step 4: Implement the capture viewport and client-side next-scene navigation**

Create `app/scene-capture/scene-capture-viewport.tsx`:

```tsx
"use client";

import Link from "next/link";
import { SceneSection } from "../three/scene-section";
import { getSceneDefinition } from "../three/scene-registry";
import type { SceneId } from "../three/types";

export function SceneCaptureViewport({
  sceneId,
  scrollTest,
  showControls,
}: {
  readonly sceneId: SceneId;
  readonly scrollTest: boolean;
  readonly showControls: boolean;
}) {
  const scene = getSceneDefinition(sceneId);
  const nextSceneId = scene.nextSceneId ?? "home-hero";

  return (
    <main
      className="scene-capture-root"
      data-capture-controls={showControls ? "true" : "false"}
      data-scroll-test={scrollTest ? "true" : "false"}
    >
      <SceneSection
        className="scene-capture-viewport"
        forceActive
        sceneId={sceneId}
      >
        <h1 className="scene-capture-title">{scene.label}</h1>
      </SceneSection>
      {scrollTest ? (
        <div aria-hidden="true" className="scene-capture-scroll-space" />
      ) : null}
      <Link
        className="scene-capture-next"
        data-testid="capture-next-scene"
        href={`/scene-capture?scene=${nextSceneId}&controls=1`}
        scroll={false}
      >
        Next scene
      </Link>
    </main>
  );
}
```

- [x] **Step 5: Implement the noindex server route**

Create `app/scene-capture/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSceneId } from "../three/scene-registry";
import { isSceneCaptureEnabled } from "./capture-policy";
import { SceneCaptureViewport } from "./scene-capture-viewport";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scene capture",
  robots: { index: false, follow: false },
};

interface SceneCapturePageProps {
  readonly searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}

export default async function SceneCapturePage({
  searchParams,
}: SceneCapturePageProps) {
  if (!isSceneCaptureEnabled()) notFound();

  const parameters = await searchParams;
  const sceneValue = Array.isArray(parameters.scene)
    ? parameters.scene[0]
    : parameters.scene;
  if (!sceneValue || !isSceneId(sceneValue)) notFound();

  return (
    <SceneCaptureViewport
      sceneId={sceneValue}
      scrollTest={parameters.scroll === "1"}
      showControls={parameters.controls === "1"}
    />
  );
}
```

- [x] **Step 6: Append capture-only styling**

Append to `app/three/scene-runtime.css`:

```css
.scene-capture-root {
  position: relative;
  z-index: 1;
  min-height: 100svh;
  pointer-events: none;
}

.scene-capture-viewport {
  min-height: 100svh;
}

.scene-capture-title,
.scene-capture-next {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.scene-capture-next {
  pointer-events: auto;
}

.scene-capture-scroll-space {
  height: 160svh;
}

body:has(.scene-capture-root) header,
body:has(.scene-capture-root) footer {
  visibility: hidden;
}

body:has(.scene-capture-root:not([data-capture-controls="true"]))
  .three-preference-toggle {
  visibility: hidden;
}
```

- [x] **Step 7: Run the capture test to verify GREEN**

Run: `npm run test:unit -- app/scene-capture/capture-policy.test.ts`

Expected: PASS, `3 passed`.

- [x] **Step 8: Refactor by verifying the capture route cannot enter production output accidentally**

Run:

```bash
npx tsc --noEmit
$env:SCENE_CAPTURE = "0"
npm run build
Remove-Item Env:SCENE_CAPTURE
```

Expected: TypeScript and build exit 0; a request to `/scene-capture?scene=home-hero` returns 404 unless `SCENE_CAPTURE=1` and `SITE_ENV=preview` are both present. `SITE_ENV=production` always returns 404 even when the flag is set; `NODE_ENV=production` is allowed only for the explicitly flagged built preview used by capture and release-browser wrappers.

- [x] **Step 9: Commit the capture route**

```bash
git add app/scene-capture app/three/scene-runtime.css vite.config.ts docs/superpowers/plans/2026-07-09-personal-site-runtime.md
git commit -m "feat: add gated scene capture route"
```

## Task 14: Verify persistence, first-frame swap, failure modes, and touch behavior in Chromium

> **Trusted-input amendment (2026-07-11):** Browser acceptance must prove UA
> behavior that jsdom cannot: a vertical touch swipe scrolls and cancels without
> rotation; a horizontal touch drag leaves scroll stable and changes rendered
> canvas pixels; a captured primary-mouse drag continues outside the rotation
> bounds and stops after pointer-up; cancel/lost-capture stop later deltas; and
> computed `touch-action` remains `pan-y pinch-zoom`. The component suite owns
> the complementary roleless, unfocusable, `aria-hidden`, malformed-input, and
> invalid-inset contracts.
>
> **Loader acceptance amendment (2026-07-11):** Chromium must decode at least
> one committed `EXT_meshopt_compression` GLB rather than only the uncompressed
> triangle fixture. A delayed current response that crosses the ten-second
> timeout must be aborted/ignored, must not mark ready or issue a second hidden
> request, and must retry exactly once only after a new activation. A failed
> speculative next request must not fail the current scene and must retry when
> promoted. Rapid A-to-B-to-C activation must keep at most current plus one
> speculative owner, dispose late decoded results, and preserve a shared URL
> promotion without refetch.
>
> **Renderer acceptance amendment (2026-07-11):** Instrument the connected app
> canvas before initialization. Production acquires `webgl2` (never `webgl` or
> `experimental-webgl`), receives an alpha-enabled `WebGL2RenderingContext`,
> and keeps the same Canvas/renderer/context identity through route changes,
> poster-only bridges, model failure, and recovery. A forced renderer creation
> failure after the capability probe must leave semantic HTML and the poster
> intact with a coded error and no unhandled rejection or model request. DPR
> is 1 at device scale 1 and clamps to 1.5 at device scale 3, with drawing
> buffers bounded by CSS size times 1.5.
>
> Use `renderer.info.render.frame` plus the rendered scene root to prove the
> real demand scheduler: settled idle adds zero frames; a changed effective
> pose produces one bounded main frame whose Euler is already current; an
> identical or differently overflowing-but-equivalent clamped pose produces
> zero; and there is no hidden automatic second main render. Drive twelve
> deliberate frames to get one finite local health event, never by a perpetual
> invalidation loop.
>
> Replace synthetic context recovery with `WEBGL_lose_context`. Lose the real
> context before the delayed first model frame, settle the model while lost,
> and prove status never becomes ready. The loss event is canceled, the poster
> and exact Canvas remain, restoration resumes pixels on that same context, and
> the activation emits at most one ready performance mark. No offscreen contact
> shadow passes or native shadow maps are permitted in the v1 renderer.

**Files:**
- Create: `tests/browser/runtime-fixtures.ts`
- Create: `tests/browser/three-runtime.spec.ts`

- [ ] **Step 1: Write the complete failing browser suite**

Create `tests/browser/three-runtime.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  fulfillModels,
  fulfillPosters,
  openScene,
} from "./runtime-fixtures";

test("keeps the exact Canvas node across real App Router navigation", async ({
  page,
}) => {
  const requested: string[] = [];
  const assetOrder: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(".webp") || pathname.endsWith(".glb")) {
      assetOrder.push(pathname);
    }
  });
  await fulfillPosters(page);
  await fulfillModels(page, requested);
  await page.goto("/");
  const webgl = await page.evaluate(() => {
    const context = document.createElement("canvas").getContext("webgl2");
    if (!context) return { supported: false, renderer: "" };
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug
      ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER));
    return { supported: true, renderer };
  });
  expect(webgl.supported).toBe(true);
  expect(webgl.renderer).toMatch(/swiftshader/i);
  const host = page.getByTestId("scene-runtime-host");
  await expect(host).toHaveAttribute("data-active-scene-id", "home-hero");
  await expect(host).toHaveAttribute("data-three-status", "ready", {
    timeout: 10_000,
  });
  await expect(page.locator('[data-scene-id="home-hero"] img')).toHaveAttribute(
    "fetchpriority",
    "high",
  );
  expect(assetOrder[0]).toBe("/posters/home-hero-desktop.webp");
  await page.locator("canvas").evaluate((canvas) => {
    (window as Window & { __routeCanvas?: HTMLCanvasElement }).__routeCanvas =
      canvas;
  });

  await page.getByRole("link", { name: "Experience" }).click();
  await expect(page).toHaveURL(/\/experience$/);
  await expect(host).toHaveAttribute(
    "data-active-scene-id",
    "experience-hero",
  );
  await expect(host).toHaveAttribute("data-three-status", "ready");
  await expect(
    page.locator('[data-scene-id="experience-hero"] img'),
  ).toHaveAttribute("loading", "eager");
  await expect(page.locator('[data-scene-id="nasa-rocket"] img')).toHaveAttribute(
    "loading",
    "lazy",
  );
  expect(
    await page.evaluate(
      () =>
        document.querySelector("canvas") ===
        (window as Window & { __routeCanvas?: HTMLCanvasElement }).__routeCanvas,
    ),
  ).toBe(true);
});

test("keeps one Canvas and preloads only next after the current ready mark", async ({
  page,
}) => {
  const requested: string[] = [];
  await fulfillPosters(page);
  await fulfillModels(page, requested);

  const host = await openScene(page, "home-hero");
  await expect(host).toHaveAttribute("data-three-status", "ready", {
    timeout: 10_000,
  });
  await expect.poll(() => new Set(requested).size).toBe(2);
  expect(new Set(requested)).toEqual(
    new Set(["/models/crane.glb", "/models/crane-workout.glb"]),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.endsWith("/models/crane-workout.glb")),
      ),
    )
    .toBe(true);
  const preloadTiming = await page.evaluate(() => {
    const ready = performance.getEntriesByName("scene-ready:home-hero")[0];
    const next = performance
      .getEntriesByType("resource")
      .find((entry) => entry.name.endsWith("/models/crane-workout.glb"));
    return { ready: ready?.startTime ?? -1, next: next?.startTime ?? -1 };
  });
  expect(preloadTiming.ready).toBeGreaterThanOrEqual(0);
  expect(preloadTiming.next).toBeGreaterThanOrEqual(preloadTiming.ready);
  await page.locator("canvas").evaluate((canvas) => {
    (window as Window & { __persistentSceneCanvas?: HTMLCanvasElement })
      .__persistentSceneCanvas = canvas;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => performance.getEntriesByName("scene-ready:home-hero").length,
      ),
    )
    .toBe(1);

  await page.getByTestId("capture-next-scene").click({ force: true });
  await expect(host).toHaveAttribute(
    "data-active-scene-id",
    "experience-hero",
  );
  await expect(host).toHaveAttribute("data-three-status", "ready");
  expect(
    await page.evaluate(
      () =>
        document.querySelector("canvas") ===
        (window as Window & { __persistentSceneCanvas?: HTMLCanvasElement })
          .__persistentSceneCanvas,
    ),
  ).toBe(true);
});

test("keeps the exact Canvas through live, poster-only, and live scenes", async ({
  page,
}) => {
  const requested: string[] = [];
  await fulfillPosters(page);
  await fulfillModels(page, requested);
  const host = await openScene(page, "nasa-rocket");
  await expect(host).toHaveAttribute("data-three-status", "ready");
  await page.locator("canvas").evaluate((canvas) => {
    (window as Window & { __posterBridgeCanvas?: HTMLCanvasElement })
      .__posterBridgeCanvas = canvas;
  });

  for (const sceneId of ["eog-poster", "paycom-poster"] as const) {
    await page.getByTestId("capture-next-scene").click({ force: true });
    await expect(host).toHaveAttribute("data-active-scene-id", sceneId);
    await expect(host).toHaveAttribute("data-three-status", "poster");
    expect(
      await page.evaluate(
        () =>
          document.querySelector("canvas") ===
          (window as Window & { __posterBridgeCanvas?: HTMLCanvasElement })
            .__posterBridgeCanvas,
      ),
    ).toBe(true);
  }

  await page.getByTestId("capture-next-scene").click({ force: true });
  await expect(host).toHaveAttribute("data-active-scene-id", "projects-hero");
  await expect(host).toHaveAttribute("data-three-status", "ready");
  expect(
    await page.evaluate(
      () =>
        document.querySelector("canvas") ===
        (window as Window & { __posterBridgeCanvas?: HTMLCanvasElement })
          .__posterBridgeCanvas,
    ),
  ).toBe(true);
});

test("uses unsupported poster mode without requesting a model when WebGL 2 is absent", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.addInitScript(`
    (() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (kind === "webgl2") return null;
        return original.call(this, kind, ...args);
      };
    })();
  `);
  await fulfillPosters(page);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".glb")) {
      requested.push(request.url());
    }
  });

  const host = await openScene(page, "home-hero");
  await expect(host).toHaveAttribute("data-three-status", "unsupported");
  expect(requested).toEqual([]);
  await expect(host.locator("picture")).toBeVisible();
});

test("defaults to poster-only mode without model requests when Save-Data is enabled", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.addInitScript(`
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  `);
  await fulfillPosters(page);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".glb")) {
      requested.push(request.url());
    }
  });

  const host = await openScene(page, "home-hero");
  await expect(host).toHaveAttribute("data-three-status", "disabled");
  await expect(page.getByRole("button", { name: "3D off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(requested).toEqual([]);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("personal-site:three-enabled"),
    ),
  ).toBeNull();
});

test("persists an explicit off choice only in local storage", async ({ page }) => {
  const requested: string[] = [];
  await fulfillPosters(page);
  await fulfillModels(page, requested);
  const host = await openScene(page, "home-hero");
  await expect(host).toHaveAttribute("data-three-status", "ready");

  await page.getByRole("button", { name: "3D on" }).click();
  await expect(host).toHaveAttribute("data-three-status", "disabled");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("personal-site:three-enabled"),
    ),
  ).toBe("off");

  await page.reload();
  await expect(host).toHaveAttribute("data-three-status", "disabled");
  await expect(page.getByRole("button", { name: "3D off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("keeps poster, semantic navigation, and capture controls after a GLB failure", async ({
  page,
}) => {
  const requested: string[] = [];
  await fulfillPosters(page);
  await fulfillModels(page, requested);
  await page.route("**/models/crane-on-league.glb", (route) =>
    route.abort("failed"),
  );

  const host = await openScene(page, "league-ban");
  await expect(host).toHaveAttribute("data-three-status", "error", {
    timeout: 10_000,
  });
  await expect(host.locator("picture")).toBeVisible();
  await expect(page.getByTestId("capture-next-scene")).toHaveAttribute(
    "href",
    "/scene-capture?scene=froggie-adventures&controls=1",
  );
  await expect(page.getByRole("link", { name: "Home", includeHidden: true })).toHaveAttribute(
    "href",
    "/",
  );
  const failedCanvas = page.locator("canvas");
  await expect(failedCanvas).toHaveCount(1);
  await failedCanvas.evaluate((canvas) => {
    (window as Window & { __failedSceneCanvas?: HTMLCanvasElement })
      .__failedSceneCanvas = canvas;
  });

  await page.getByTestId("capture-next-scene").click({ force: true });
  await expect(host).toHaveAttribute("data-active-scene-id", "froggie-adventures");
  await expect(host).toHaveAttribute("data-three-status", "ready");
  expect(
    await page.evaluate(
      () =>
        document.querySelector("canvas") ===
        (window as Window & { __failedSceneCanvas?: HTMLCanvasElement })
          .__failedSceneCanvas,
    ),
  ).toBe(true);
});

test("reveals the poster on context loss and recovers through the same Canvas", async ({
  page,
}) => {
  const requested: string[] = [];
  await fulfillPosters(page);
  await fulfillModels(page, requested);
  const host = await openScene(page, "nasa-rocket");
  await expect(host).toHaveAttribute("data-three-status", "ready");
  const canvas = page.locator("canvas");
  await canvas.evaluate((element) => {
    element.dispatchEvent(
      new Event("webglcontextlost", { bubbles: false, cancelable: true }),
    );
  });

  await expect(host).toHaveAttribute("data-three-status", "context-lost");
  await expect(host.locator("picture")).toBeVisible();
  await expect(canvas).toHaveCount(1);

  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextrestored"));
  });
  await expect(host).toHaveAttribute("data-three-status", "ready", {
    timeout: 10_000,
  });
  await expect(canvas).toHaveCount(1);
});

test("allows vertical touch scrolling while horizontal drag stays bounded", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1.5,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const requested: string[] = [];
  await fulfillPosters(page);
  await fulfillModels(page, requested);
  const host = await openScene(page, "home-hero", "controls=1&scroll=1");
  await expect(host).toHaveAttribute("data-three-status", "ready");
  const area = page.getByTestId("scene-rotation-area");
  await expect(area).toHaveCSS("touch-action", "pan-y pinch-zoom");
  const box = await area.boundingBox();
  if (!box) throw new Error("Rotation area has no browser bounds");
  const session = await context.newCDPSession(page);

  const swipe = async (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };

  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await swipe(
    { x: center.x, y: center.y + 90 },
    { x: center.x, y: center.y - 90 },
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(40);

  const canvas = page.locator("canvas");
  const beforeRotation = await canvas.screenshot();
  const beforeHorizontal = await page.evaluate(() => window.scrollY);
  await swipe(
    { x: center.x - 70, y: center.y },
    { x: center.x + 70, y: center.y },
  );
  const afterHorizontal = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterHorizontal - beforeHorizontal)).toBeLessThan(10);
  await expect
    .poll(async () => !(await canvas.screenshot()).equals(beforeRotation))
    .toBe(true);

  await context.close();
});
```

- [ ] **Step 2: Install the pinned Chromium binary**

Run: `npx playwright install chromium`

Expected: Chromium matching `@playwright/test@1.61.1` installs successfully.

- [ ] **Step 3: Run the browser suite to verify RED**

Run: `npm run test:browser`

Expected: FAIL with `Cannot find module './runtime-fixtures'`.

- [ ] **Step 4: Implement deterministic browser assets and capture navigation helpers**

Create `tests/browser/runtime-fixtures.ts`:

```ts
import { expect, type Page } from "@playwright/test";

const TRIANGLE_GLTF = JSON.stringify({
  asset: { version: "2.0", generator: "runtime-browser-test" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  buffers: [
    {
      byteLength: 36,
      uri: "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA",
    },
  ],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: "VEC3",
      min: [0, 0, 0],
      max: [1, 1, 0],
    },
  ],
});

const POSTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900">
  <rect width="1440" height="900" fill="#9ECCC0"/>
  <circle cx="900" cy="350" r="180" fill="#135946"/>
</svg>`;

export async function fulfillPosters(page: Page) {
  await page.route("**/posters/*.webp", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: POSTER_SVG,
    }),
  );
}

export async function fulfillModels(page: Page, requested: string[]) {
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(".glb")) requested.push(pathname);
  });
  await page.route("**/models/*.glb", (route) =>
    route.fulfill({
      status: 200,
      contentType: "model/gltf+json",
      body: TRIANGLE_GLTF,
    }),
  );
}

export async function openScene(
  page: Page,
  sceneId: string,
  query = "controls=1",
) {
  await page.goto(`/scene-capture?scene=${sceneId}&${query}`);
  const host = page.getByTestId("scene-runtime-host");
  await expect(host).toHaveAttribute("data-active-scene-id", sceneId);
  return host;
}
```

Expected: the helper compiles without importing application code and every model response is a deterministic valid glTF document.

- [ ] **Step 5: Run the complete browser suite to verify GREEN**

Run: `npm run test:browser`

Expected: PASS, `9 passed`; the same Canvas node survives real Home-to-Experience navigation and the NASA-to-EOG-to-Paycom-to-Projects sequence, Home loads first and only then idles in the Experience model, Save-Data and unsupported modes request no GLBs, context loss keeps the poster, and vertical touch scroll remains functional.

- [ ] **Step 6: Refactor through unit, component, R3F, and browser layers**

Run:

```bash
npm run test:unit
npm run test:browser
```

Expected: all Vitest files and all nine Chromium tests pass.

- [ ] **Step 7: Commit browser resilience coverage**

```bash
git add tests/browser/runtime-fixtures.ts tests/browser/three-runtime.spec.ts
git commit -m "test: cover persistent three runtime in browser"
```

## Task 15: Generate deterministic desktop/mobile posters and their manifest

> **Physical-pixel amendment (2026-07-11):** Canonical output dimensions equal
> `viewport * deviceScaleFactor`. Desktop remains 1920x1080; the 390x844 mobile
> viewport at 1.5 DPR produces 585x1266 files. Both browser and SVG sources use
> those physical dimensions so capture output agrees with the asset validator.

**Files:**
- Create: `scripts/posters/lib.mjs`
- Create: `scripts/posters/lib.d.mts`
- Create: `scripts/posters/capture.mjs`
- Create: `tests/posters/poster-runtime.test.mjs`
- Create: `tests/browser/poster-capture.spec.ts`
- Create: `public/posters/poster-manifest.json` (generated)
- Create: twenty `public/posters/<sceneId>-<variant>.webp` files (generated)
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Confirm the asset-plan poster gate is RED**

Run: `node scripts/assets/validate.mjs --require-posters`

Expected: FAIL with `Required poster is missing: public/posters/home-hero-desktop.webp`.

- [ ] **Step 2: Write the failing deterministic-manifest and pixel-difference tests**

Create `tests/posters/poster-runtime.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPosterManifest,
  changedChannelRatio,
  sha256Buffer,
} from "../../scripts/posters/lib.mjs";

test("poster manifest is stable and sorted by scene then variant", () => {
  const manifest = buildPosterManifest({
    browserVersion: "123.0.0",
    contractSha256: "abc123",
    renderInputsSha256: "render123",
    posters: [
      {
        sceneId: "projects-hero",
        variant: "mobile",
        path: "public/posters/projects-hero-mobile.webp",
        width: 390,
        height: 844,
        bytes: 20,
        sha256: "second",
      },
      {
        sceneId: "home-hero",
        variant: "desktop",
        path: "public/posters/home-hero-desktop.webp",
        width: 1920,
        height: 1080,
        bytes: 10,
        sha256: "first",
      },
    ],
  });

  assert.deepEqual(
    manifest.posters.map(({ sceneId, variant }) => [sceneId, variant]),
    [
      ["home-hero", "desktop"],
      ["projects-hero", "mobile"],
    ],
  );
  assert.equal(JSON.stringify(manifest).includes("2026-"), false);
  assert.equal(JSON.stringify(manifest).includes("C:\\"), false);
  assert.equal(manifest.renderInputsSha256, "render123");
});

test("pixel comparison tolerates tiny channel drift and rejects visual drift", () => {
  const baseline = Uint8Array.from([0, 10, 20, 255, 40, 50, 60, 255]);
  const tiny = Uint8Array.from([1, 12, 22, 255, 42, 52, 63, 255]);
  const changed = Uint8Array.from([30, 40, 50, 255, 80, 90, 100, 255]);

  assert.equal(changedChannelRatio(baseline, tiny, 4), 0);
  assert.ok(changedChannelRatio(baseline, changed, 4) > 0.5);
});

test("buffer hashing is deterministic", () => {
  assert.equal(
    sha256Buffer(Buffer.from("poster")),
    "293b9207228b7854bc3ccb2959ebea1583e066d41983124a5b381d6fdf6575f8",
  );
});

```

- [ ] **Step 3: Run the poster unit test to verify RED**

Run: `node --test tests/posters/poster-runtime.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/posters/lib.mjs`.

- [ ] **Step 4: Implement stable poster metadata and pixel comparison helpers**

Create `scripts/posters/lib.mjs`:

```js
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const POSTER_RENDER_INPUT_PATHS = [
  "app/globals.css",
  "app/layout.tsx",
  "app/scene-capture/scene-capture-viewport.tsx",
  "app/three/normalized-scene-root.tsx",
  "app/three/scene-canvas.tsx",
  "app/three/scene-model.tsx",
  "app/three/scene-registry.ts",
  "app/three/scene-runtime.css",
  "assets/poster-sources/eog.svg",
  "assets/poster-sources/paycom.svg",
  "playwright.config.ts",
  "public/models/assets-manifest.json",
  "scripts/posters/lib.mjs",
  "tests/browser/poster-capture.spec.ts",
];

export async function posterRenderInputsSha256(root = process.cwd()) {
  const hash = createHash("sha256");
  for (const relativePath of POSTER_RENDER_INPUT_PATHS) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(path.join(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function changedChannelRatio(left, right, tolerance = 4) {
  if (left.length !== right.length || left.length === 0) return 1;
  let changed = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index] - right[index]) > tolerance) changed += 1;
  }
  return changed / left.length;
}

export function buildPosterManifest({
  browserVersion,
  contractSha256,
  renderInputsSha256,
  posters,
}) {
  return {
    schemaVersion: 1,
    contractSha256,
    renderInputsSha256,
    renderer: {
      browser: "chromium",
      browserVersion,
      swiftShader: true,
    },
    toolVersions: {
      playwright: "1.61.1",
      sharp: "0.35.3",
    },
    posters: [...posters].sort(
      (left, right) =>
        left.sceneId.localeCompare(right.sceneId) ||
        left.variant.localeCompare(right.variant),
    ),
  };
}
```

Create `scripts/posters/lib.d.mts`:

```ts
export const POSTER_RENDER_INPUT_PATHS: readonly string[];
export function posterRenderInputsSha256(root?: string): Promise<string>;
export function sha256Buffer(buffer: Uint8Array): string;
export function changedChannelRatio(
  left: Uint8Array,
  right: Uint8Array,
  tolerance?: number,
): number;
export function buildPosterManifest(input: {
  browserVersion: string;
  contractSha256: string;
  renderInputsSha256: string;
  posters: readonly Record<string, unknown>[];
}): Record<string, unknown> & { readonly posters: readonly Record<string, unknown>[] };
```

- [ ] **Step 5: Run the poster unit test to verify GREEN**

Run: `node --test tests/posters/poster-runtime.test.mjs`

Expected: PASS, `3 passed`.

- [ ] **Step 6: Implement the pinned browser/SVG capture test**

Create `tests/browser/poster-capture.spec.ts`:

```ts
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  buildPosterManifest,
  changedChannelRatio,
  posterRenderInputsSha256,
  sha256Buffer,
} from "../../scripts/posters/lib.mjs";

type VariantName = "desktop" | "mobile";

interface PosterContract {
  readonly variants: Record<
    VariantName,
    {
      readonly viewportWidth: number;
      readonly viewportHeight: number;
      readonly deviceScaleFactor: number;
    }
  >;
  readonly scenes: readonly {
    readonly id: string;
    readonly source:
      | { readonly kind: "web-scene"; readonly modelKey: string }
      | { readonly kind: "svg"; readonly path: string };
    readonly outputs: Record<VariantName, string>;
  }[];
}

interface PosterRecord {
  readonly sceneId: string;
  readonly variant: VariantName;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface PosterManifest {
  readonly posters: readonly PosterRecord[];
}

async function decodedPixels(file: string) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function replaceCanonicalFile(target: string, contents: Buffer | string) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.next`;
  await writeFile(temporary, contents);
  await rename(temporary, target);
}

test("captures every poster contract output deterministically", async ({ browser }) => {
  test.setTimeout(180_000);
  const mode = process.env.POSTER_CAPTURE_MODE;
  if (mode !== "write" && mode !== "check") {
    throw new Error("POSTER_CAPTURE_MODE must be write or check");
  }
  const root = process.cwd();
  const contractBuffer = await readFile(
    path.join(root, "assets/poster-contract.json"),
  );
  const contract = JSON.parse(contractBuffer.toString("utf8")) as PosterContract;
  const probePage = await browser.newPage();
  const renderer = await probePage.evaluate(() => {
    const context = document.createElement("canvas").getContext("webgl2");
    if (!context) return "";
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    return debug
      ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER));
  });
  await probePage.close();
  expect(renderer).toMatch(/swiftshader/i);
  const outputRoot = path.join(
    root,
    mode === "write" ? "tmp/posters-write" : "tmp/posters-check",
  );
  await rm(outputRoot, { force: true, recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const posters: PosterRecord[] = [];
  const committedManifest = mode === "check"
    ? (JSON.parse(
        await readFile(
          path.join(root, "public/posters/poster-manifest.json"),
          "utf8",
        ),
      ) as PosterManifest)
    : null;

  for (const scene of contract.scenes) {
    for (const variantName of ["desktop", "mobile"] as const) {
      const variant = contract.variants[variantName];
      const outputWidth = Math.round(
        variant.viewportWidth * variant.deviceScaleFactor,
      );
      const outputHeight = Math.round(
        variant.viewportHeight * variant.deviceScaleFactor,
      );
      let sourceBuffer: Buffer;

      if (scene.source.kind === "svg") {
        sourceBuffer = await sharp(path.join(root, scene.source.path))
          .resize(outputWidth, outputHeight, {
            fit: "cover",
            position: "centre",
          })
          .png()
          .toBuffer();
      } else {
        const context = await browser.newContext({
          baseURL: "http://127.0.0.1:3000",
          viewport: {
            width: variant.viewportWidth,
            height: variant.viewportHeight,
          },
          deviceScaleFactor: variant.deviceScaleFactor,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        await page.goto(`/scene-capture?scene=${scene.id}`);
        const host = page.getByTestId("scene-runtime-host");
        await expect(host).toHaveAttribute("data-active-scene-id", scene.id);
        await expect(host).toHaveAttribute("data-three-status", "ready", {
          timeout: 15_000,
        });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        });
        sourceBuffer = await page.screenshot({
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          omitBackground: false,
          scale: "device",
          type: "png",
        });
        await context.close();
      }

      const webp = await sharp(sourceBuffer)
        .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
        .toBuffer();
      const canonicalRelativePath = scene.outputs[variantName].replaceAll("\\", "/");
      const candidatePath = path.join(outputRoot, path.basename(canonicalRelativePath));
      await writeFile(candidatePath, webp);
      const metadata = await sharp(webp).metadata();
      const fileStats = await stat(candidatePath);
      expect(metadata.width).toBe(outputWidth);
      expect(metadata.height).toBe(outputHeight);

      const candidateRecord: PosterRecord = {
        sceneId: scene.id,
        variant: variantName,
        path: canonicalRelativePath,
        width: outputWidth,
        height: outputHeight,
        bytes: fileStats.size,
        sha256: sha256Buffer(webp),
      };

      if (mode === "check") {
        const canonicalPath = path.join(root, canonicalRelativePath);
        const [candidate, canonical, canonicalBuffer] = await Promise.all([
          decodedPixels(candidatePath),
          decodedPixels(canonicalPath),
          readFile(canonicalPath),
        ]);
        expect({
          width: candidate.info.width,
          height: candidate.info.height,
          channels: candidate.info.channels,
        }).toEqual({
          width: canonical.info.width,
          height: canonical.info.height,
          channels: canonical.info.channels,
        });
        expect(
          changedChannelRatio(candidate.data, canonical.data, 4),
          `${scene.id}/${variantName} exceeded the 0.1% changed-channel gate`,
        ).toBeLessThanOrEqual(0.001);
        const committedRecord = committedManifest?.posters.find(
          (poster) =>
            poster.sceneId === scene.id && poster.variant === variantName,
        );
        expect(committedRecord).toEqual({
          sceneId: scene.id,
          variant: variantName,
          path: canonicalRelativePath,
          width: canonical.info.width,
          height: canonical.info.height,
          bytes: canonicalBuffer.byteLength,
          sha256: sha256Buffer(canonicalBuffer),
        });
        posters.push(committedRecord!);
      } else {
        posters.push(candidateRecord);
      }
    }
  }

  const manifest = buildPosterManifest({
    browserVersion: browser.version(),
    contractSha256: createHash("sha256").update(contractBuffer).digest("hex"),
    renderInputsSha256: await posterRenderInputsSha256(root),
    posters,
  });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

  if (mode === "write") {
    for (const poster of posters) {
      await replaceCanonicalFile(
        path.join(root, poster.path),
        await readFile(path.join(outputRoot, path.basename(poster.path))),
      );
    }
    await replaceCanonicalFile(
      path.join(root, "public/posters/poster-manifest.json"),
      serialized,
    );
  } else {
    expect(
      await readFile(
        path.join(root, "public/posters/poster-manifest.json"),
        "utf8",
      ),
    ).toBe(serialized);
  }

  await rm(outputRoot, { force: true, recursive: true });
});
```

- [ ] **Step 7: Implement the cross-platform capture command**

Create `scripts/posters/capture.mjs`:

```js
import { spawnSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  console.error("Usage: node scripts/posters/capture.mjs --write|--check");
  process.exit(2);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npx,
  [
    "playwright",
    "test",
    "tests/browser/poster-capture.spec.ts",
    "--project=chromium",
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      POSTER_CAPTURE_MODE: mode.slice(2),
      SCENE_CAPTURE: "1",
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
```

- [ ] **Step 8: Add reproducible poster commands**

Add these `package.json` scripts:

```json
{
"posters:capture": "node scripts/posters/capture.mjs --write",
"posters:check": "node scripts/posters/capture.mjs --check",
"test:posters": "node --test tests/posters/poster-runtime.test.mjs"
}
```

- [ ] **Step 9: Generate all twenty canonical WebPs and the stable manifest**

Run: `npm run posters:capture`

Expected: PASS, `1 passed`; all twenty contract WebPs plus `public/posters/poster-manifest.json` are replaced individually from the temporary capture directory. Unrelated files already under `public/posters/`, including the four foundation reference PNGs, remain untouched until Task 16. Every manifest path begins `public/posters/`; contract and render-input SHA-256 values are present; the manifest contains no timestamp or absolute path.

- [ ] **Step 10: Verify deterministic regeneration and turn the asset gate GREEN**

Run:

```bash
npm run posters:check
node scripts/assets/validate.mjs --require-posters
npm run test:posters
```

Expected: poster comparison PASS with at most 0.1% changed channels at tolerance 4; asset validation PASS; Node reports `3 passed`.

- [ ] **Step 11: Visually approve the two cropped mobile poster-only compositions**

Open each canonical file at its native 585×1266 size:

```powershell
Start-Process -FilePath "public\posters\eog-poster-mobile.webp"
Start-Process -FilePath "public\posters\paycom-poster-mobile.webp"
```

Expected: both images use a centered cover crop; circles, crane geometry, and type remain proportionate with no horizontal or vertical stretching; each focal motif stays legible inside the mobile safe area. Stop and adjust the authored SVG focal composition if either check fails.

- [ ] **Step 12: Commit final posters and capture tooling**

```bash
git add package.json package-lock.json scripts/posters tests/posters tests/browser/poster-capture.spec.ts public/posters
git commit -m "build: capture deterministic scene posters"
```

## Task 16: Replace foundation public artifacts and close the asset/poster release gate

**Files:**
- Create: `tests/runtime-production-validation.test.ts`
- Replace: `tests/public-assets.test.ts`
- Replace: `tests/production-validation.test.ts`
- Modify: `lib/production-validation.ts`
- Create: `scripts/assets/validate.d.mts`
- Modify: `scripts/validate-production.ts`
- Delete: `public/posters/home-reference.png`
- Delete: `public/posters/experience-reference.png`
- Delete: `public/posters/projects-reference.png`
- Delete: `public/posters/contact-reference.png`
- Delete: `public/images/froggie-gameplay.png`

- [ ] **Step 1: Write the failing final-release wiring test**

Create `tests/runtime-production-validation.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  collectProductionConfigErrors,
  requiredPublicAssets,
} from "../lib/production-validation";

const completedOwnerFields = {
  nonWorkInterest: "I spend time on a specific activity Richard has approved.",
  technicalCuriosity:
    "I am exploring a technical curiosity Richard has approved.",
};

describe("runtime production validation wiring", () => {
  it("removes the foundation-only hard stop after owner/config checks pass", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "https://richardphong.example",
        },
        completedOwnerFields,
      ),
    ).toEqual([]);
  });

  it("requires both final manifests and every canonical poster", async () => {
    const contract = JSON.parse(
      await readFile("assets/poster-contract.json", "utf8"),
    ) as {
      scenes: readonly {
        outputs: Readonly<Record<"desktop" | "mobile", string>>;
      }[];
    };
    const outputs = contract.scenes
      .flatMap((scene) => [scene.outputs.desktop, scene.outputs.mobile])
      .sort();

    expect(requiredPublicAssets).toContain("public/models/assets-manifest.json");
    expect(requiredPublicAssets).toContain("public/posters/poster-manifest.json");
    expect(requiredPublicAssets.filter((asset) => asset.endsWith(".webp")).sort()).toEqual(
      outputs,
    );
    expect(requiredPublicAssets.some((asset) => asset.endsWith("-reference.png"))).toBe(false);
  });

  it("makes production validation await the final manifest validator", async () => {
    const source = await readFile("scripts/validate-production.ts", "utf8");
    expect(source).toContain('import { validateAll } from "./assets/validate.mjs"');
    expect(source).toContain("await validateAll({ root, requirePosters: true })");
    expect(source).not.toContain("FOUNDATION_PREVIEW_ONLY_MESSAGE");
  });
});
```

- [ ] **Step 2: Run the release wiring test to verify RED**

Run: `npm run test:unit -- tests/runtime-production-validation.test.ts`

Expected: FAIL because the foundation-only error is still returned and final poster/manifests are absent from `requiredPublicAssets`.

- [ ] **Step 3: Replace the production validation library with final runtime assets**

Replace `lib/production-validation.ts` completely:

```ts
import { access } from "node:fs/promises";
import path from "node:path";
import {
  getOwnerGatedFields,
  home,
  type OwnerHomeFields,
} from "../content/site-content";
import {
  resolveDeployment,
  type RuntimeEnvironment,
} from "./deployment";

export const requiredPublicAssets = [
  "public/Richard-Phong-Resume.pdf",
  "public/models/assets-manifest.json",
  "public/posters/poster-manifest.json",
  "public/posters/home-hero-desktop.webp",
  "public/posters/home-hero-mobile.webp",
  "public/posters/experience-hero-desktop.webp",
  "public/posters/experience-hero-mobile.webp",
  "public/posters/experience-intro-desktop.webp",
  "public/posters/experience-intro-mobile.webp",
  "public/posters/nasa-rocket-desktop.webp",
  "public/posters/nasa-rocket-mobile.webp",
  "public/posters/eog-poster-desktop.webp",
  "public/posters/eog-poster-mobile.webp",
  "public/posters/paycom-poster-desktop.webp",
  "public/posters/paycom-poster-mobile.webp",
  "public/posters/projects-hero-desktop.webp",
  "public/posters/projects-hero-mobile.webp",
  "public/posters/league-ban-desktop.webp",
  "public/posters/league-ban-mobile.webp",
  "public/posters/froggie-adventures-desktop.webp",
  "public/posters/froggie-adventures-mobile.webp",
  "public/posters/contact-hero-desktop.webp",
  "public/posters/contact-hero-mobile.webp",
] as const;

export function collectProductionConfigErrors(
  env: RuntimeEnvironment,
  ownerFields: OwnerHomeFields = home,
): string[] {
  const errors: string[] = [];

  if (env.SITE_ENV !== "production") {
    errors.push("SITE_ENV must equal production for a production release.");
  } else {
    try {
      resolveDeployment(env);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Production deployment configuration is invalid.",
      );
    }
  }

  errors.push(
    ...getOwnerGatedFields(ownerFields).map(
      (field) => `Owner copy is still gated: ${field}.`,
    ),
  );
  return errors;
}

export async function collectMissingAssetErrors(
  root = process.cwd(),
): Promise<string[]> {
  const errors: string[] = [];
  for (const relativePath of requiredPublicAssets) {
    try {
      await access(path.join(root, relativePath));
    } catch {
      errors.push(`Required public asset is missing: ${relativePath}.`);
    }
  }
  return errors;
}

export async function collectProductionValidationErrors({
  env = process.env,
  ownerFields = home,
  root = process.cwd(),
}: {
  env?: RuntimeEnvironment;
  ownerFields?: OwnerHomeFields;
  root?: string;
} = {}): Promise<string[]> {
  const [configErrors, assetErrors] = await Promise.all([
    Promise.resolve(collectProductionConfigErrors(env, ownerFields)),
    collectMissingAssetErrors(root),
  ]);
  return [...configErrors, ...assetErrors];
}
```

- [ ] **Step 4: Type the asset validator for the TypeScript production executable**

Create `scripts/assets/validate.d.mts`:

```ts
export interface ValidateAllOptions {
  readonly root?: string;
  readonly outputPath?: string;
  readonly requirePosters?: boolean;
}

export function validateAll(options?: ValidateAllOptions): Promise<unknown>;
```

- [ ] **Step 5: Make the production executable await model and poster manifests**

Replace `scripts/validate-production.ts` completely:

```ts
import { collectProductionValidationErrors } from "../lib/production-validation";
import { validateAll } from "./assets/validate.mjs";

const root = process.cwd();
const errors = await collectProductionValidationErrors({ root });

try {
  await validateAll({ root, requirePosters: true });
} catch (error) {
  errors.push(
    `3D asset validation failed: ${
      error instanceof Error ? error.message : "unknown validation error"
    }`,
  );
}

if (errors.length > 0) {
  console.error("Production validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production validation passed.");
}
```

- [ ] **Step 6: Replace the foundation production-validation test**

Replace `tests/production-validation.test.ts` completely:

```ts
import { describe, expect, it } from "vitest";
import { OWNER_INPUT_SENTINEL } from "../content/site-content";
import {
  collectProductionConfigErrors,
  requiredPublicAssets,
} from "../lib/production-validation";

const completedOwnerFields = {
  nonWorkInterest: "I spend time on a specific activity Richard has approved.",
  technicalCuriosity:
    "I am exploring a technical curiosity Richard has approved.",
};

const unresolvedOwnerFields = {
  nonWorkInterest: `${OWNER_INPUT_SENTINEL} home.nonWorkInterest`,
  technicalCuriosity:
    `${OWNER_INPUT_SENTINEL} home.technicalCuriosity`,
};

describe("production validation", () => {
  it("rejects a preview and owner-gated copy", () => {
    expect(collectProductionConfigErrors({}, unresolvedOwnerFields)).toEqual([
      "SITE_ENV must equal production for a production release.",
      "Owner copy is still gated: home.nonWorkInterest.",
      "Owner copy is still gated: home.technicalCuriosity.",
    ]);
  });

  it("passes config and copy once their explicit inputs resolve", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "https://richardphong.example",
        },
        completedOwnerFields,
      ),
    ).toEqual([]);
  });

  it("reports an invalid production origin", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "http://richardphong.example/path",
        },
        completedOwnerFields,
      ),
    ).toEqual(["Production SITE_URL must use https."]);
  });

  it("requires final manifests and all twenty canonical posters", () => {
    expect(requiredPublicAssets).toHaveLength(23);
    expect(requiredPublicAssets.filter((asset) => asset.endsWith(".webp"))).toHaveLength(20);
    expect(requiredPublicAssets).toContain("public/models/assets-manifest.json");
    expect(requiredPublicAssets).toContain("public/posters/poster-manifest.json");
  });
});
```

- [ ] **Step 7: Replace public asset tests with immutable-source and final-manifest checks**

Replace `tests/public-assets.test.ts` completely:

```ts
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { posterRenderInputsSha256 } from "../scripts/posters/lib.mjs";

const immutableAssets = [
  {
    path: "public/Richard-Phong-Resume.pdf",
    bytes: 133_744,
    sha256: "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e",
  },
] as const;

const sourceReferences = [
  ["ReferenceImages/Main Page - Mint.png", 323_621, "a986f7f511252b521e79bc623274093845a244d67e636accd62f9d84672fd8a6"],
  ["ReferenceImages/Experience - Pink.png", 804_876, "d46c5f6d72c6087cb0f4e632bcf50aa41239415aba398682443f8e777e1f47ad"],
  ["ReferenceImages/Projects - Blue.png", 1_027_131, "5da147a96636afb90d174b2c47a53289ae2530055c95bbcf8c9968daae1d3689"],
  ["ReferenceImages/Experience - Purple.png", 273_901, "759d9c87f7d5eb92dacc9c8e1d03d9ed1ee27ba0f9cdab64e5474b604381d8d2"],
  ["ReferenceImages/Froggie Gameplay.png", 2_337_398, "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613"],
] as const;

describe("final public assets", () => {
  it.each(immutableAssets)("preserves $path byte-for-byte", async (asset) => {
    const buffer = await readFile(asset.path);
    expect(buffer.byteLength).toBe(asset.bytes);
    expect(createHash("sha256").update(buffer).digest("hex")).toBe(asset.sha256);
  });

  it.each(sourceReferences)(
    "preserves non-public source reference %s",
    async (sourcePath, bytes, sha256) => {
      const buffer = await readFile(sourcePath);
      expect(buffer.byteLength).toBe(bytes);
      expect(createHash("sha256").update(buffer).digest("hex")).toBe(sha256);
    },
  );

  it("matches every poster contract output to the committed manifest", async () => {
    const [contractBuffer, manifestSource] = await Promise.all([
      readFile("assets/poster-contract.json"),
      readFile("public/posters/poster-manifest.json", "utf8"),
    ]);
    const contract = JSON.parse(contractBuffer.toString("utf8"));
    const manifest = JSON.parse(manifestSource);
    expect(manifest.contractSha256).toBe(
      createHash("sha256").update(contractBuffer).digest("hex"),
    );
    expect(manifest.renderInputsSha256).toBe(
      await posterRenderInputsSha256(),
    );
    const expected = contract.scenes
      .flatMap((scene: { outputs: Record<string, string> }) =>
        Object.values(scene.outputs),
      )
      .sort();
    const actual = manifest.posters
      .map((poster: { path: string }) => poster.path)
      .sort();
    expect(actual).toEqual(expected);

    for (const poster of manifest.posters as {
      path: string;
      bytes: number;
      sha256: string;
      width: number;
      height: number;
    }[]) {
      const [buffer, metadata, file] = await Promise.all([
        readFile(poster.path),
        sharp(poster.path).metadata(),
        stat(poster.path),
      ]);
      expect(file.size).toBe(poster.bytes);
      expect(createHash("sha256").update(buffer).digest("hex")).toBe(
        poster.sha256,
      );
      expect(metadata.width).toBe(poster.width);
      expect(metadata.height).toBe(poster.height);
    }
  });

  it("does not publish retired full-frame or raw gameplay exports", async () => {
    for (const name of ["home", "experience", "projects", "contact"]) {
      await expect(
        access(path.join("public/posters", `${name}-reference.png`)),
      ).rejects.toThrow();
    }
    await expect(
      access("public/images/froggie-gameplay.png"),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 8: Delete the four retired Figma frames and raw gameplay screenshot**

Run each command separately after the canonical WebPs pass Task 15:

```powershell
Remove-Item -LiteralPath "public\posters\home-reference.png"
Remove-Item -LiteralPath "public\posters\experience-reference.png"
Remove-Item -LiteralPath "public\posters\projects-reference.png"
Remove-Item -LiteralPath "public\posters\contact-reference.png"
Remove-Item -LiteralPath "public\images\froggie-gameplay.png"
```

Expected: all five files are absent. Their source files under `ReferenceImages/` remain untouched; the cropped gameplay texture remains packed inside the Froggie GLB and is not published as a raw screenshot.

- [ ] **Step 9: Run final asset/release wiring tests to verify GREEN**

Run:

```bash
npm run test:unit -- tests/runtime-production-validation.test.ts tests/production-validation.test.ts tests/public-assets.test.ts
node scripts/assets/validate.mjs --require-posters
```

Expected: Vitest reports `3 test files passed`; asset/poster validation passes.

- [ ] **Step 10: Verify the foundation hard stop and public reference URLs are gone**

Run:

```bash
rg -n "FOUNDATION_PREVIEW_ONLY_MESSAGE|-reference\.png|froggie-gameplay\.png" lib scripts content app
```

Expected: no matches and exit code 1.

- [ ] **Step 11: Commit the final public/release contract**

```bash
git add -A lib/production-validation.ts scripts/assets/validate.d.mts scripts/validate-production.ts tests/production-validation.test.ts tests/runtime-production-validation.test.ts tests/public-assets.test.ts public/posters public/images
git commit -m "feat: close final model and poster release gate"
```

## Task 17: Run the complete runtime regression and performance contract

> **Measured performance amendment (2026-07-11):** Source grep is only a
> structural audit, not the Web Vitals gate. Add production-build Playwright
> lab coverage at desktop and mobile sizes for 3D-enabled and Save-Data/disabled
> paths. Require LCP <= 2.5 s with poster/text (not delayed WebGL) as the LCP
> element, CLS <= 0.1 through poster-to-canvas and route swaps, and a trusted
> drag interaction-to-next-paint proxy <= 200 ms. Define and enforce a bounded
> long-task/TBT budget around WebGL initialization plus Meshopt decode, then
> prove `renderer.info.render.frame` is stable in a settled idle window.
> SwiftShader remains the deterministic correctness renderer; do not use its
> FPS as a representative physical-GPU performance budget. Record actual DPR,
> buffer dimensions, antialias policy, and context power preference so any
> later quality/performance adjustment is evidence-driven.

**Files:**
- Verify only; change an owning file only when a named check exposes a defect.

- [ ] **Step 1: Run every pure, component, and R3F test**

Run: `npm run test:unit`

Expected: every foundation and runtime Vitest file passes; no test is skipped because WebGL is unavailable in JSDOM.

- [ ] **Step 2: Verify models, final posters, and deterministic recapture**

Run:

```bash
npm run assets:validate
node scripts/assets/validate.mjs --require-posters
npm run test:posters
npm run posters:check
```

Expected: all four commands pass; seven GLBs and twenty WebPs satisfy their manifests; pixel comparison remains within the 0.1% gate.

- [ ] **Step 3: Run the runtime browser suite**

Run: `npm run test:browser`

Expected: PASS, `9 passed`; real route navigation and poster-only bridges preserve the exact Canvas element, poster/error/context-loss fallbacks remain complete, reduced-data/local preference paths issue no forbidden loads, and touch scrolling works.

- [ ] **Step 4: Run semantic HTML, lint, type, and Cloudflare-compatible build checks**

Run:

```bash
npx tsc --noEmit
npm run test:html
npm run lint
npm run build
```

Expected: all commands exit 0; rendered HTML still contains meaningful route content and deterministic poster elements without requiring WebGL.

- [ ] **Step 5: Prove the asset-phase hard stop is gone while owner copy remains gated**

Set each environment value on its own PowerShell line:

```powershell
$env:SITE_ENV = "production"
$env:SITE_URL = "https://richardphong.example"
npm run validate:production
Remove-Item Env:SITE_ENV
Remove-Item Env:SITE_URL
```

Expected: exit 1 reports only `home.nonWorkInterest` and `home.technicalCuriosity`. It does not report missing GLBs, posters, manifests, foundation reference images, or the removed asset-phase hard stop.

- [ ] **Step 6: Audit runtime performance invariants in source**

Run:

```bash
rg -n "frameloop=\"demand\"|dpr=\{\[1, 1\.5\]\}|MeshoptDecoder|data-three-status|data-active-scene-id|scene-ready:|rotation-health" app/three
rg -n "OrbitControls|MapControls|PresentationControls|frameloop=\"always\"|transition:" app/three
```

Expected: the first command finds every required invariant. The second command finds no matches and exits 1.

- [ ] **Step 7: Confirm no unrelated or generated scratch files are staged**

Run:

```bash
git status --short
git diff --check
```

Expected: only intentional runtime code, tests, generated canonical posters/manifests, and the documented reference-image deletions appear; `git diff --check` exits 0.

- [ ] **Step 8: Commit any final test-driven correction**

If Step 1–7 required an owning-file correction, commit only that correction and its regression test:

```bash
git add app components content lib scripts tests public/posters package.json package-lock.json
git commit -m "fix: satisfy three runtime regression gate"
```

Expected: commit succeeds. If no correction was needed, do not create an empty commit.

## Spec coverage ledger

- Runtime boundary, one fixed `100svh` Canvas, SSR-disabled dynamic import, capped DPR, and demand rendering: Tasks 10–11.
- Typed registry, web camera/light authority, all eight live IDs, two poster-only scenes, shared workout export, and exact route heroes: Task 2.
- Shared viewport activation line, stale registration cleanup, destination-hero reset, and default-pose reset: Tasks 5–6.
- Poster before initialization, hero/feature fetch priority, first-frame-only swap, ten-second timeout, load/decode failure, unsupported WebGL 2, context loss/recovery, and HTML independence: Tasks 4, 6, 10–14.
- Local `3D on/off`, explicit storage, `saveData` default, no runtime telemetry sender, and local operational event seam: Tasks 3–4 and 11.
- Bounded yaw/pitch, touch `pan-y pinch-zoom`, no focus/keyboard rotation, complete-root rotation, and demand invalidation: Tasks 5, 7–8.
- Meshopt decoder, current model ownership, post-first-frame idle preloading of at most one next model, cancellation/cache eviction, cloned instance resources, and no eager route waterfall: Task 9 plus Task 14 browser coverage.
- Deterministic desktop/mobile capture, SwiftShader, final poster manifest, tight pixel comparison, and removal of public Figma-frame exports: Tasks 13 and 15–16.
- Stable release hooks and observability seam: Tasks 1, 3, 6, 7, 11, and 14.
- Browser, component, pure policy, R3F, rendered-HTML, asset, type, lint, and production-build layers: Tasks 1–17.

## Type and naming ledger

- `SceneId` is defined once in `app/three/types.ts` and imported by content, registry, sections, runtime state, events, and capture code.
- `ThreeStatus` is derived from `THREE_STATUSES`; host values exactly match the `data-three-status` release contract.
- `SceneRuntimeEventDetail` is the union `ready|failure|context-lost|rotation-health`; reasons are restricted to `fetch|decode|timeout|webgl2-unavailable|context-lost|unknown`.
- `SceneCanvasPortProps` is shared by the real Canvas, host state machine, and injected component test double.
- Poster URLs are `/posters/<sceneId>-<variant>.webp`; model URLs are `/models/<modelKey>.glb`.
- The sole input hook is `data-testid="scene-rotation-area"`; the sole scene-section release hook is `data-scene-id`.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-09-personal-site-runtime.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, and use `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in batches with review checkpoints and use `superpowers:executing-plans`.
