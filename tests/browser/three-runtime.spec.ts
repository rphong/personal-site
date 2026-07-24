import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  COMMITTED_MESHOPT_MODEL,
  fulfillModels,
  fulfillPosters,
  openScene,
  type ModelFixtureController,
} from "./runtime-fixtures";

const HOME_MODEL = "/models/crane.glb";
const EXPERIENCE_MODEL = "/models/crane-workout.glb";
const INTRO_MODEL = "/models/crane-throwing-plane.glb";
const ROCKET_MODEL = "/models/rocket.glb";
const PROJECT_MODEL = "/models/crane-making-table.glb";
const LEAGUE_MODEL = "/models/crane-on-league.glb";
const FROGGIE_MODEL = "/models/froggie-display.glb";
const ALL_LIVE_MODELS = [
  HOME_MODEL,
  EXPERIENCE_MODEL,
  INTRO_MODEL,
  ROCKET_MODEL,
  PROJECT_MODEL,
  LEAGUE_MODEL,
  FROGGIE_MODEL,
] as const;
const RESIDENT_SCENES_BY_ROUTE = {
  "/": ["home-hero"],
  "/contact": ["contact-hero"],
  "/experience": ["experience-hero", "experience-intro", "nasa-rocket"],
  "/projects": ["projects-hero", "league-ban", "froggie-adventures"],
} as const;
const INITIAL_MODELS_BY_ROUTE = {
  "/": [HOME_MODEL, EXPERIENCE_MODEL],
  "/contact": [EXPERIENCE_MODEL],
  "/experience": [EXPERIENCE_MODEL, INTRO_MODEL, ROCKET_MODEL],
  "/projects": [PROJECT_MODEL, LEAGUE_MODEL, FROGGIE_MODEL],
} as const;

type ProbeMode =
  | "normal"
  | "unsupported"
  | "renderer-throws"
  | "context-ceiling";

interface RuntimeEventRecord {
  readonly at: number;
  readonly durationMs?: number;
  readonly fps?: number;
  readonly reason?: string;
  readonly sceneId: string;
  readonly status: string;
}

interface ContextCallRecord {
  readonly alpha?: boolean;
  readonly connected: boolean;
  readonly kind: string;
}

interface RuntimeAcceptanceProbe {
  readonly calls: ContextCallRecord[];
  readonly createdContextsByCanvas: Map<
    HTMLCanvasElement,
    WebGL2RenderingContext
  >;
  readonly contextsByCanvas: Map<HTMLCanvasElement, WebGL2RenderingContext>;
  readonly events: RuntimeEventRecord[];
  readonly uncaughtErrors: string[];
  readonly unhandledRejections: string[];
  connectedContext: WebGL2RenderingContext | null;
  connectedContextChanges: number;
  connectedCanvas: HTMLCanvasElement | null;
  connectedCanvasChanges: number;
  contextLossDefaultPrevented: boolean | null;
  loseContextExtension: {
    readonly loseContext: () => void;
    readonly restoreContext: () => void;
  } | null;
}

declare global {
  interface Window {
    __runtimeAcceptanceProbe?: RuntimeAcceptanceProbe;
    __task14Identity?: {
      readonly canvas: HTMLCanvasElement;
      readonly context: WebGL2RenderingContext;
      readonly renderer: object;
    };
    __lateDecodeWaiting?: boolean;
    __releaseLateDecode?: () => void;
    __task14PointerId?: number;
    __task14GotCapture?: boolean;
    __task14LostCapture?: boolean;
    __task14TouchCancels?: boolean[];
    __residentIdentitySets?: Record<
      string,
      Record<
        string,
        {
          readonly canvas: HTMLCanvasElement;
          readonly context: WebGL2RenderingContext;
          readonly stage: HTMLElement;
        }
      >
    >;
  }
}

async function installRuntimeProbe(
  page: Page,
  mode: ProbeMode = "normal",
): Promise<void> {
  await page.addInitScript((probeMode: ProbeMode) => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const probe: RuntimeAcceptanceProbe = {
      calls: [],
      createdContextsByCanvas: new Map(),
      contextsByCanvas: new Map(),
      events: [],
      uncaughtErrors: [],
      unhandledRejections: [],
      connectedContext: null,
      connectedContextChanges: 0,
      connectedCanvas: null,
      connectedCanvasChanges: 0,
      contextLossDefaultPrevented: null,
      loseContextExtension: null,
    };
    window.__enableSceneRuntimeDebug = true;
    window.__runtimeAcceptanceProbe = probe;

    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...arguments_: unknown[]
    ) {
      const options = arguments_[0];
      const alpha =
        options && typeof options === "object" && "alpha" in options
          ? Boolean((options as { readonly alpha?: unknown }).alpha)
          : undefined;
      const connected = this.isConnected;
      probe.calls.push({ kind, connected, alpha });

      if (kind === "webgl2" && probeMode === "unsupported") return null;
      if (
        kind === "webgl2" &&
        connected &&
        probeMode === "context-ceiling" &&
        probe.calls.filter(
          (call) => call.kind === "webgl2" && call.connected,
        ).length > 7
      ) {
        return null;
      }
      if (
        kind === "webgl2" &&
        connected &&
        probeMode === "renderer-throws"
      ) {
        throw new Error("Intentional connected renderer construction failure");
      }

      const context = Reflect.apply(originalGetContext, this, [
        kind,
        ...arguments_,
      ]) as RenderingContext | null;
      if (kind === "webgl2" && context) {
        const webgl2 = context as WebGL2RenderingContext;
        probe.createdContextsByCanvas.set(this, webgl2);
        if (connected) {
          if (probe.connectedCanvas && probe.connectedCanvas !== this) {
            probe.connectedCanvasChanges += 1;
          }
          if (probe.connectedContext && probe.connectedContext !== webgl2) {
            probe.connectedContextChanges += 1;
          }
          probe.connectedCanvas = this;
          probe.connectedContext = webgl2;
          probe.contextsByCanvas.set(this, webgl2);
        }
      }
      return context;
    } as typeof originalGetContext;

    window.addEventListener("site:scene-runtime", (event) => {
      const detail = (event as CustomEvent<Omit<RuntimeEventRecord, "at">>)
        .detail;
      probe.events.push({ ...detail, at: performance.now() });
    });
    window.addEventListener("error", (event) => {
      probe.uncaughtErrors.push(event.message || String(event.error));
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      probe.unhandledRejections.push(
        reason instanceof Error ? reason.message : String(reason),
      );
    });
  }, mode);
}

function probeEvents(
  page: Page,
  status?: RuntimeEventRecord["status"],
): Promise<RuntimeEventRecord[]> {
  return page.evaluate((wantedStatus) => {
    const events = window.__runtimeAcceptanceProbe?.events ?? [];
    return wantedStatus
      ? events.filter((event) => event.status === wantedStatus)
      : events;
  }, status);
}

async function expectNoUnhandledRuntimeErrors(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => window.__runtimeAcceptanceProbe?.unhandledRejections ?? [],
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => window.__runtimeAcceptanceProbe?.uncaughtErrors ?? [],
    ),
  ).toEqual([]);
}

async function rememberRuntimeIdentity(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__sceneRuntimeDebug;
    if (!debug) throw new Error("Scene runtime debug port is unavailable");
    window.__task14Identity = {
      canvas: debug.canvas,
      context: debug.context,
      renderer: debug.renderer,
    };
  });
}

async function expectRuntimeIdentity(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => {
      const identity = window.__task14Identity;
      const debug = window.__sceneRuntimeDebug;
      return Boolean(
        identity &&
          debug &&
          identity.canvas === debug.canvas &&
          identity.context === debug.context &&
          identity.renderer === debug.renderer &&
          document.querySelector("canvas") === identity.canvas,
      );
    }),
  ).toBe(true);
}

function residentHost(page: Page, sceneId: string) {
  return page.locator(
    `.scene-stage--resident[data-scene-owner-id="${sceneId}"] [data-scene-runtime-host]`,
  );
}

async function expectReadyResidentSet(
  page: Page,
  sceneIds: readonly string[],
): Promise<void> {
  const assignedStages = page.locator(
    '.scene-stage--resident[data-scene-pool-state="assigned"]',
  );
  await expect(assignedStages).toHaveCount(sceneIds.length);
  await expect(page.locator("[data-scene-resident-pool]")).toHaveAttribute(
    "data-scene-context-cap",
    "4",
  );
  expect(sceneIds.length).toBeLessThanOrEqual(4);
  for (const sceneId of sceneIds) {
    const stage = page.locator(
      `[data-scene-id="${sceneId}"] > .scene-stage--resident[data-scene-owner-id="${sceneId}"][data-scene-pool-state="assigned"]`,
    );
    const host = residentHost(page, sceneId);
    await expect(stage).toHaveCount(1);
    await expect(host).toHaveAttribute("data-scene-for", sceneId);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expect(host.locator("picture.scene-runtime__poster")).toHaveCount(1);
    await expect(host.locator("picture.scene-runtime__poster")).toBeHidden();
    await expect(host.locator("canvas")).toHaveCount(1);
    await expect(host.locator("canvas")).toBeVisible();
  }
  await expect(assignedStages.locator("canvas")).toHaveCount(sceneIds.length);
  expect(await page.locator(".scene-stage--resident").count()).toBeLessThanOrEqual(
    4,
  );
  expect(
    await page.locator(".scene-stage--resident canvas").count(),
  ).toBeLessThanOrEqual(4);
}

async function expectNoBlockingLoadingScreen(page: Page): Promise<void> {
  await expect(page.locator("[data-initial-loading-screen]")).toHaveCount(0);
  await expect(page.locator(".site-shell")).not.toHaveAttribute("aria-busy");
  expect(
    await page
      .locator(".site-shell")
      .evaluate((element) => (element as HTMLElement).inert),
  ).toBe(false);
}

async function expectBoundedSceneResources(
  page: Page,
  maximum: number,
): Promise<void> {
  const sizes = await page.evaluate(() => ({
    current: window.__sceneResourceDebug?.size ?? 0,
    events: window.__sceneResourceDebug?.events.slice(-80) ?? [],
    peak: Math.max(
      0,
      ...(window.__sceneResourceDebug?.events.map(({ size }) => size) ?? []),
    ),
  }));
  const diagnostic = JSON.stringify(sizes.events);
  expect(sizes.current, diagnostic).toBeLessThanOrEqual(maximum);
  expect(sizes.peak, diagnostic).toBeLessThanOrEqual(maximum);
}

async function rememberResidentIdentitySet(
  page: Page,
  key: string,
): Promise<void> {
  await page.evaluate((identityKey) => {
    const probe = window.__runtimeAcceptanceProbe;
    if (!probe) throw new Error("Runtime acceptance probe is unavailable");
    const identities: Record<
      string,
      {
        readonly canvas: HTMLCanvasElement;
        readonly context: WebGL2RenderingContext;
        readonly stage: HTMLElement;
      }
    > = {};
    for (const stage of document.querySelectorAll<HTMLElement>(
      '.scene-stage--resident[data-scene-owner-id][data-scene-pool-state="assigned"]',
    )) {
      const sceneId = stage.dataset.sceneOwnerId;
      const canvas = stage.querySelector("canvas");
      const context = canvas ? probe.contextsByCanvas.get(canvas) : undefined;
      if (!sceneId || !canvas || !context) {
        throw new Error("A resident identity is incomplete");
      }
      identities[sceneId] = { canvas, context, stage };
    }
    window.__residentIdentitySets ??= {};
    window.__residentIdentitySets[identityKey] = identities;
  }, key);
}

async function expectResidentIdentitySetStable(
  page: Page,
  key: string,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((identityKey) => {
        const identities = window.__residentIdentitySets?.[identityKey];
        const probe = window.__runtimeAcceptanceProbe;
        if (!identities || !probe) return false;
        return Object.values(identities).every((identity) => {
          const canvas = identity.stage.querySelector("canvas");
          return (
            canvas === identity.canvas &&
            probe.contextsByCanvas.get(identity.canvas) === identity.context &&
            identity.stage.isConnected &&
            identity.canvas.isConnected &&
            !identity.context.isContextLost()
          );
        });
      }, key),
    )
    .toBe(true);
}

async function expectResidentIdentitySetState(
  page: Page,
  key: string,
  state: "assigned" | "pooled",
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        ({ identityKey, wantedState }) => {
          const identities = window.__residentIdentitySets?.[identityKey];
          if (!identities) return false;
          return Object.entries(identities).every(([sceneId, identity]) => {
            const parent = identity.stage.parentElement;
            return (
              identity.stage.dataset.scenePoolState === wantedState &&
              (wantedState === "pooled"
                ? parent?.hasAttribute("data-scene-resident-pool") === true
                : parent?.getAttribute("data-scene-id") === sceneId)
            );
          });
        },
        { identityKey: key, wantedState: state },
      ),
    )
    .toBe(true);
  await expectResidentIdentitySetStable(page, key);
}

async function expectResidentIdentitySetEvicted(
  page: Page,
  key: string,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((identityKey) => {
        const identities = window.__residentIdentitySets?.[identityKey];
        if (!identities) return false;
        return Object.values(identities).every(
          ({ canvas, context, stage }) =>
            !stage.isConnected && !canvas.isConnected && context.isContextLost(),
        );
      }, key),
    )
    .toBe(true);
}

function connectedContextCallCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      window.__runtimeAcceptanceProbe?.calls.filter(
        ({ connected, kind }) => connected && kind === "webgl2",
      ).length ?? -1,
  );
}

async function expectSingleReadyMark(page: Page, sceneId: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (id) => performance.getEntriesByName(`scene-ready:${id}`).length,
        sceneId,
      ),
    )
    .toBe(1);
}

async function activateNextCaptureScene(page: Page): Promise<void> {
  await page
    .getByTestId("capture-next-scene")
    .evaluate((element: HTMLAnchorElement) => element.click());
}

async function createRuntimeContext(
  browser: Browser,
  testInfo: TestInfo,
  options: Parameters<Browser["newContext"]>[0],
): Promise<BrowserContext> {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Playwright baseURL is required for runtime acceptance");
  }
  return browser.newContext({ ...options, baseURL });
}

async function disposeFixture(
  fixture: ModelFixtureController | undefined,
): Promise<void> {
  try {
    await fixture?.dispose();
  } catch (error) {
    if (error instanceof Error && /page.*closed|target.*closed/i.test(error.message)) {
      return;
    }
    throw error;
  }
}

test("anchors resident scene visuals to their sections while desktop and mobile vertical scrolling stays untrapped", async ({
  browser,
}, testInfo) => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 800, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ] as const) {
    const context = await createRuntimeContext(browser, testInfo, {
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    const page = await context.newPage();
    await installRuntimeProbe(page);
    await fulfillPosters(page);
    const models = await fulfillModels(page);

    try {
      await page.goto("/experience");
      await expectReadyResidentSet(
        page,
        RESIDENT_SCENES_BY_ROUTE["/experience"],
      );
      await expectNoBlockingLoadingScreen(page);
      const host = page.getByTestId("scene-runtime-host");
      await expect(host).toHaveAttribute(
        "data-active-scene-id",
        "experience-hero",
      );
      await rememberResidentIdentitySet(page, `experience-${viewport.name}`);

      const activateLiveScene = async (sceneId: string) => {
        const owner = page.locator(`[data-scene-id="${sceneId}"]`);
        await owner.evaluate((element) => {
          const top = element.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, top - window.innerHeight * 0.08);
        });
        await expect(host).toHaveAttribute("data-active-scene-id", sceneId);
        await expect(host).toHaveAttribute("data-three-status", "ready");
        expect(
          await host.evaluate(
            (element, activeSceneId) =>
              element.parentElement?.getAttribute("data-scene-owner-id") ===
                activeSceneId &&
              element.parentElement?.parentElement?.getAttribute(
                "data-scene-id",
              ) === activeSceneId,
            sceneId,
          ),
          `${viewport.name} ${sceneId} runtime stage should remain with its section owner`,
        ).toBe(true);
      };

      await activateLiveScene("experience-intro");
      await expectResidentIdentitySetStable(
        page,
        `experience-${viewport.name}`,
      );
      const before = await page.evaluate(() => {
        const sectionElement = document.querySelector(
          '[data-scene-id="experience-intro"]',
        );
        const hostElement = document.querySelector(
          '[data-testid="scene-runtime-host"]',
        );
        if (!sectionElement || !hostElement) return null;
        return {
          scrollY: window.scrollY,
          sectionTop: sectionElement.getBoundingClientRect().top,
          hostTop: hostElement.getBoundingClientRect().top,
        };
      });
      expect(before).not.toBeNull();

      const rotationArea = page.getByTestId("scene-rotation-area");
      const box = await rotationArea.boundingBox();
      if (!box) throw new Error(`${viewport.name} rotation area has no bounds`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 240);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(before?.scrollY ?? 0);

      const after = await page.evaluate(() => {
        const sectionElement = document.querySelector(
          '[data-scene-id="experience-intro"]',
        );
        const hostElement = document.querySelector(
          '[data-testid="scene-runtime-host"]',
        );
        if (!sectionElement || !hostElement) return null;
        return {
          sectionTop: sectionElement.getBoundingClientRect().top,
          hostTop: hostElement.getBoundingClientRect().top,
        };
      });
      expect(after).not.toBeNull();
      const sectionDelta =
        (after?.sectionTop ?? 0) - (before?.sectionTop ?? 0);
      const hostDelta = (after?.hostTop ?? 0) - (before?.hostTop ?? 0);
      expect(Math.abs(sectionDelta)).toBeGreaterThan(1);
      expect(hostDelta).toBeCloseTo(sectionDelta, 1);
      await expectResidentIdentitySetStable(
        page,
        `experience-${viewport.name}`,
      );

      await page.getByRole("button", { name: "3D on" }).click();
      await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(0);
      for (const sceneId of RESIDENT_SCENES_BY_ROUTE["/experience"]) {
        const resident = residentHost(page, sceneId);
        await expect(resident).toHaveAttribute("data-three-status", "disabled");
        await expect(resident.locator("picture.scene-runtime__poster")).toHaveCount(
          1,
        );
        await expect(resident.locator("picture.scene-runtime__poster")).toBeVisible();
      }
      await page.getByRole("button", { name: "3D off" }).click();
      await expectReadyResidentSet(
        page,
        RESIDENT_SCENES_BY_ROUTE["/experience"],
      );

      await activateLiveScene("nasa-rocket");
      for (const sceneId of ["eog-poster", "paycom-poster"] as const) {
        const section = page.locator(`[data-scene-id="${sceneId}"]`);
        await section.evaluate((element) => {
          const top = element.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, top - window.innerHeight * 0.08);
        });
        await expect(section).toHaveAttribute("data-scene-active", "true");
        await expect(
          section.locator(":scope > .scene-stage--resident"),
        ).toHaveCount(0);
        await expect(
          section.locator(":scope > .scene-section__poster"),
        ).toBeVisible();
        await expect(page.getByTestId("scene-runtime-host")).toHaveCount(0);
        await expect(page.getByTestId("scene-rotation-area")).toHaveCount(0);
        await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(3);
      }

      await page
        .getByRole("link", { name: "Projects", exact: true })
        .click();
      await expect(page).toHaveURL(/\/projects$/);
      await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/projects"]);
      await expectNoBlockingLoadingScreen(page);
      await expectBoundedSceneResources(page, ALL_LIVE_MODELS.length);
      for (const sceneId of RESIDENT_SCENES_BY_ROUTE["/projects"]) {
        await activateLiveScene(sceneId);
      }
      await page
        .getByRole("link", { name: "Contact", exact: true })
        .click();
      await expect(page).toHaveURL(/\/contact$/);
      await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/contact"]);
      await expectNoBlockingLoadingScreen(page);
      await expectBoundedSceneResources(page, ALL_LIVE_MODELS.length);
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/"]);
      await expectNoBlockingLoadingScreen(page);
      await expectBoundedSceneResources(page, ALL_LIVE_MODELS.length);
      await expectNoUnhandledRuntimeErrors(page);
    } finally {
      await disposeFixture(models);
      await context.close();
    }
  }
});

test("shows scene-capture development controls only when explicitly requested", async ({
  page,
}) => {
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    await page.goto("/scene-capture?scene=home-hero");
    await expect(page.locator(".three-preference-toggle")).toBeHidden();
    await expect(page.locator(".scene-debug-launcher")).toBeHidden();

    await page.goto("/scene-capture?scene=home-hero&controls=1");
    await expect(page.locator(".three-preference-toggle")).toBeVisible();
    await expect(page.locator(".scene-debug-launcher")).toBeVisible();

    await page.goto("/scene-capture?scene=home-hero&debug3d=1");
    await expect(page.locator(".scene-debug")).toBeHidden();

    await page.goto(
      "/scene-capture?scene=home-hero&controls=1&debug3d=1",
    );
    await expect(page.locator(".scene-debug")).toBeVisible();
  } finally {
    await disposeFixture(models);
  }
});

test("decodes a committed meshopt GLB on alpha WebGL2 and swaps on the first real frame", async ({
  page,
}) => {
  expect(COMMITTED_MESHOPT_MODEL).toBe(HOME_MODEL);
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { kind: "committed" } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready", {
      timeout: 10_000,
    });
    expect(models.requestCount(HOME_MODEL)).toBe(1);

    const renderer = await page.evaluate(() => {
      const probe = window.__runtimeAcceptanceProbe;
      const debug = window.__sceneRuntimeDebug;
      if (!probe?.connectedContext || !debug) return null;
      const attributes = probe.connectedContext.getContextAttributes();
      let castShadowObjects = 0;
      debug.scene?.traverse((object) => {
        if (object.castShadow) castShadowObjects += 1;
      });
      return {
        alpha: attributes?.alpha ?? false,
        canvasMatches: probe.connectedCanvas === debug.canvas,
        connectedCalls: probe.calls.filter((call) => call.connected),
        contextChanges: probe.connectedContextChanges,
        contextMatches: probe.connectedContext === debug.context,
        contextType: probe.connectedContext.constructor.name,
        castShadowObjects,
        frames: debug.frames,
        rendererMatches: debug.renderer.domElement === debug.canvas,
      };
    });
    expect(renderer).not.toBeNull();
    expect(renderer?.alpha).toBe(true);
    expect(renderer?.contextType).toBe("WebGL2RenderingContext");
    expect(renderer?.connectedCalls.map(({ kind }) => kind)).toEqual([
      "webgl2",
    ]);
    expect(renderer?.connectedCalls[0]).toMatchObject({ alpha: true });
    expect(renderer?.contextChanges).toBe(0);
    expect(renderer?.canvasMatches).toBe(true);
    expect(renderer?.contextMatches).toBe(true);
    expect(renderer?.rendererMatches).toBe(true);
    expect(renderer?.castShadowObjects).toBe(0);
    expect(renderer?.frames.length).toBeGreaterThanOrEqual(1);
    expect(renderer?.frames.at(-1)).toMatchObject({
      renderTarget: "screen",
      rootName: "scene-root:home-hero",
      sceneId: "home-hero",
      shadowMapEnabled: false,
    });
    expect(renderer?.frames.at(-1)?.calls).toBeGreaterThan(0);
    expect(renderer?.frames.every(({ renderTarget }) => renderTarget === "screen"))
      .toBe(true);
    expect(renderer?.frames.every(({ shadowMapEnabled }) => !shadowMapEnabled))
      .toBe(true);

    await expect(host.locator("picture")).toBeHidden();
    await expect(host.locator(".scene-runtime__canvas")).toBeVisible();
    await expectSingleReadyMark(page, "home-hero");
    expect(
      (await probeEvents(page, "ready")).filter(
        ({ sceneId }) => sceneId === "home-hero",
      ),
    ).toHaveLength(1);
    await expectNoUnhandledRuntimeErrors(page);
  } finally {
    await disposeFixture(models);
  }
});

test("keeps a decoded poster visible until the first real Canvas frame", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { hold: true } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await models.waitForRequest(HOME_MODEL);
    await expect(host).toHaveAttribute("data-three-status", "loading");
    await expect(host).toHaveAttribute("data-poster-ready", "true");
    await expect(host).toHaveAttribute("data-transition-frame", "none");
    await expect(host.locator("picture")).toBeVisible();
    await expect(host.locator(".scene-runtime__canvas")).toBeHidden();
    await expect(
      page.locator(
        '[data-scene-id="home-hero"] > .scene-section__poster',
      ),
    ).toBeHidden();
    await expect(page.locator(".scene-runtime__transition-frame")).toHaveCount(0);
    expect(
      await host.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)");

    expect(models.release(HOME_MODEL)).toBe(1);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expect(host.locator("picture")).toBeHidden();
    await expect(host.locator(".scene-runtime__canvas")).toBeVisible();
    await expectSingleReadyMark(page, "home-hero");
  } finally {
    await disposeFixture(models);
  }
});

test("pools previous-route residents and re-adopts their exact live canvases across App Router navigation", async ({
  page,
}) => {
  const assets: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(".webp") || pathname.endsWith(".glb")) {
      assets.push(pathname);
    }
  });
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { hold: true } },
  });

  try {
    await page.goto("/");
    await models.waitForRequest(HOME_MODEL);
    await expectNoBlockingLoadingScreen(page);
    expect(
      await page
        .locator(".site-shell")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);
    expect(
      await page
        .locator(".three-preference-toggle")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);
    expect(
      await page
        .locator(".scene-debug-launcher")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);
    await expect(
      page.getByRole("link", { name: "Experience", exact: true }),
    ).toBeEnabled();

    expect(models.release(HOME_MODEL)).toBe(1);
    await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/"]);
    await expectNoBlockingLoadingScreen(page);
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(1);
    await expect(
      page.locator(
        '[data-scene-id="home-hero"] > .scene-section__poster img',
      ),
    ).toHaveAttribute("fetchpriority", "high");
    expect(assets[0]).toBe("/posters/home-hero-desktop.webp");
    await rememberResidentIdentitySet(page, "navigation-home");
    const connectedCallsBefore = await connectedContextCallCount(page);

    await page.getByRole("link", { name: "Experience", exact: true }).click();
    await expect(page).toHaveURL(/\/experience$/);
    await expectReadyResidentSet(
      page,
      RESIDENT_SCENES_BY_ROUTE["/experience"],
    );
    await expectResidentIdentitySetState(page, "navigation-home", "pooled");
    expect(await connectedContextCallCount(page)).toBe(
      connectedCallsBefore + RESIDENT_SCENES_BY_ROUTE["/experience"].length,
    );
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(4);
    await expect(page.locator(".scene-runtime__transition-frame")).toHaveCount(0);
    await expect(
      page.locator(
        '[data-scene-id="experience-hero"] > .scene-section__poster img',
      ),
    ).toHaveAttribute("loading", "eager");
    await expect(
      page.locator(
        '[data-scene-id="nasa-rocket"] > .scene-section__poster img',
      ),
    ).toHaveAttribute("loading", "lazy");

    await rememberResidentIdentitySet(page, "navigation-experience");
    const destinationCalls = await connectedContextCallCount(page);
    await page
      .locator('[data-scene-id="experience-intro"]')
      .evaluate((element) => {
        const top = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - window.innerHeight * 0.08);
      });
    await expect(page.getByTestId("scene-runtime-host")).toHaveAttribute(
      "data-active-scene-id",
      "experience-intro",
    );
    await expectResidentIdentitySetState(
      page,
      "navigation-experience",
      "assigned",
    );
    expect(await connectedContextCallCount(page)).toBe(destinationCalls);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/"]);
    await expectResidentIdentitySetState(page, "navigation-home", "assigned");
    await expectResidentIdentitySetState(
      page,
      "navigation-experience",
      "pooled",
    );
    expect(await connectedContextCallCount(page)).toBe(destinationCalls);
    expect(models.requestCount(HOME_MODEL)).toBe(1);
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(4);
    await expect(page.locator(".scene-runtime__transition-frame")).toHaveCount(0);
  } finally {
    await disposeFixture(models);
  }
});

test("synchronizes a pooled canvas before its first visible adoption frame", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Runtime viewport is unavailable");
    await page.goto("/experience");
    await page.addStyleTag({
      content: `
        [data-scene-id="experience-hero"] > .scene-stage {
          width: 600px !important;
          height: 500px !important;
        }
      `,
    });
    await expectReadyResidentSet(
      page,
      RESIDENT_SCENES_BY_ROUTE["/experience"],
    );
    const experienceHost = residentHost(page, "experience-hero");
    await expect(experienceHost.locator("canvas")).toHaveCSS("width", "600px");
    await expect(experienceHost.locator("canvas")).toHaveCSS("height", "500px");

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/"]);
    const pooledExperience = page.locator(
      '[data-scene-resident-pool] [data-scene-owner-id="experience-hero"]',
    );
    await expect(pooledExperience.locator("canvas")).toHaveCSS(
      "width",
      `${viewport.width}px`,
    );
    await expect(pooledExperience.locator("canvas")).toHaveCSS(
      "height",
      `${viewport.height}px`,
    );

    // The Home activation replaces the global debug port, so the frames below
    // begin with this retained Experience renderer's re-adoption.
    await page.getByRole("link", { name: "Experience", exact: true }).click();
    await expect(page).toHaveURL(/\/experience$/);
    await expectReadyResidentSet(
      page,
      RESIDENT_SCENES_BY_ROUTE["/experience"],
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__sceneRuntimeDebug?.sceneId === "experience-hero" &&
            window.__sceneRuntimeDebug.frames.some(
              ({ stageState }) => stageState === "assigned",
            ),
        ),
      )
      .toBe(true);

    const assignedFrames = await page.evaluate(
      () =>
        window.__sceneRuntimeDebug?.frames
          .filter(({ stageState }) => stageState === "assigned")
          .map(
            ({
              bufferHeight,
              bufferWidth,
              cameraAspect,
              cameraFov,
              cameraPosition,
              cssHeight,
              cssWidth,
            }) => ({
              bufferHeight,
              bufferWidth,
              cameraAspect,
              cameraFov,
              cameraPosition,
              cssHeight,
              cssWidth,
            }),
          ) ?? [],
    );
    expect(assignedFrames.length).toBeGreaterThan(0);
    for (const frame of assignedFrames) {
      expect(frame).toEqual({
        bufferHeight: 500,
        bufferWidth: 600,
        cameraAspect: 1.2,
        cameraFov: 40,
        cameraPosition: [5.2, 4.1, 9.6],
        cssHeight: 500,
        cssWidth: 600,
      });
    }
  } finally {
    await disposeFixture(models);
  }
});

test("keeps a pooled canvas hidden until its destination adoption render commits", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    await page.goto("/experience?sceneTrace=1");
    await page.addStyleTag({
      content: `
        [data-scene-id="experience-hero"] > .scene-stage {
          width: 600px !important;
          height: 500px !important;
        }
      `,
    });
    await expectReadyResidentSet(
      page,
      RESIDENT_SCENES_BY_ROUTE["/experience"],
    );

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/"]);
    await page.evaluate(() => {
      if (window.__sceneRuntimeTrace) window.__sceneRuntimeTrace.length = 0;
    });

    await page.getByRole("link", { name: "Experience", exact: true }).click();
    await expect(page).toHaveURL(/\/experience$/);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__sceneRuntimeTrace?.some(
            ({ details, phase }) =>
              phase === "canvas:adoption-presented" &&
              details.sceneId === "experience-hero",
          ),
        ),
      )
      .toBe(true);
    await expectReadyResidentSet(
      page,
      RESIDENT_SCENES_BY_ROUTE["/experience"],
    );

    const trace = await page.evaluate(
      () =>
        window.__sceneRuntimeTrace?.filter(
          ({ details }) =>
            details.ownerSceneId === "experience-hero" ||
            details.sceneId === "experience-hero",
        ) ?? [],
    );
    const presentedIndex = trace.findIndex(
      ({ phase }) => phase === "canvas:adoption-presented",
    );
    expect(presentedIndex).toBeGreaterThan(-1);

    const prePresentation = trace
      .slice(0, presentedIndex)
      .filter(({ phase }) => phase.startsWith("pool:adopt-after-insert"));
    expect(prePresentation.length).toBeGreaterThan(0);
    for (const { details } of prePresentation) {
      expect(details.poolState).toBe("adopting");
      expect(
        (
          details.canvas as
            | { readonly style?: { readonly visibility?: string } }
            | null
        )?.style?.visibility,
      ).toBe("hidden");
    }

    const presented = trace[presentedIndex];
    expect(presented?.details.poolState).toBe("assigned");
    expect(presented?.details.currentAdoptionVersion).toBe(
      presented?.details.renderedAdoptionVersion,
    );

    const chapterAdoptionSamples = await page.evaluate(() => {
      const trace = window.__sceneRuntimeTrace ?? [];
      return ["experience-intro", "nasa-rocket"].flatMap((sceneId) => {
        const presentedIndex = trace.findIndex(
          ({ details, phase }) =>
            phase === "canvas:adoption-presented" &&
            details.sceneId === sceneId,
        );
        if (presentedIndex < 0) return [];
        return trace
          .slice(0, presentedIndex)
          .filter(
            ({ details, phase }) =>
              phase.startsWith("pool:adopt-after-insert") &&
              details.ownerSceneId === sceneId,
          )
          .map(({ details, phase }) => ({
            canvasVisibility: (
              details.canvas as
                | { readonly style?: { readonly visibility?: string } }
                | null
            )?.style?.visibility,
            phase,
            runtimePosterVisibility: (
              details.runtimePoster as {
                readonly style?: { readonly visibility?: string };
              }
            )?.style?.visibility,
            sceneId,
            sectionPosterVisibility: (
              details.sectionPoster as {
                readonly style?: { readonly visibility?: string };
              }
            )?.style?.visibility,
          }));
      });
    });
    expect(chapterAdoptionSamples.length).toBeGreaterThan(0);
    for (const sample of chapterAdoptionSamples) {
      expect(sample.canvasVisibility, sample.phase).toBe("hidden");
      expect(sample.runtimePosterVisibility, sample.phase).toBe("hidden");
      expect(sample.sectionPosterVisibility, sample.phase).toBe("hidden");
    }
  } finally {
    await disposeFixture(models);
  }
});

test("uses fixed vertical scaling for mobile hero posters", async ({
  browser,
}, testInfo) => {
  const context = await createRuntimeContext(browser, testInfo, {
    deviceScaleFactor: 1.5,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 720, width: 390 },
  });
  const page = await context.newPage();
  await installRuntimeProbe(page);
  const models = await fulfillModels(page, [], {
    plans: { [EXPERIENCE_MODEL]: { hold: true } },
  });

  try {
    await page.goto("/experience?sceneTrace=1");
    await models.waitForRequest(EXPERIENCE_MODEL);
    const host = residentHost(page, "experience-hero");
    await expect(host).toHaveAttribute("data-three-status", "loading");

    const poster = host.locator("picture.scene-runtime__poster img");
    await expect(poster).toBeVisible();
    await expect
      .poll(() =>
        poster.evaluate(
          (image: HTMLImageElement) =>
            image.complete && image.naturalHeight > 0,
        ),
      )
      .toBe(true);

    const geometry = await poster.evaluate((image: HTMLImageElement) => {
      const stage = image.closest<HTMLElement>(".scene-stage--resident");
      if (!stage) throw new Error("Resident stage is unavailable");
      const imageRect = image.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        centerDelta:
          imageRect.left +
          imageRect.width / 2 -
          (stageRect.left + stageRect.width / 2),
        heightRatio: imageRect.height / stageRect.height,
        objectFit: getComputedStyle(image).objectFit,
        scaleRatio:
          imageRect.width /
          image.naturalWidth /
          (imageRect.height / image.naturalHeight),
      };
    });

    expect(geometry.objectFit).toBe("fill");
    expect(geometry.heightRatio).toBeCloseTo(1, 5);
    expect(geometry.scaleRatio).toBeCloseTo(1, 3);
    expect(geometry.centerDelta).toBeCloseTo(0, 3);

    const tracedScale = await page.evaluate(() => {
      for (const entry of window.__sceneRuntimeTrace ?? []) {
        const details = entry.details as {
          readonly ownerSceneId?: unknown;
          readonly runtimePoster?: {
            readonly image?: {
              readonly coverToVerticalScale?: unknown;
            } | null;
          };
        };
        if (
          entry.phase === "poster:decoded" &&
          details.ownerSceneId === "experience-hero" &&
          typeof details.runtimePoster?.image?.coverToVerticalScale === "number"
        ) {
          return details.runtimePoster.image.coverToVerticalScale;
        }
      }
      return null;
    });
    expect(tracedScale).toBeCloseTo(1, 5);
  } finally {
    await disposeFixture(models);
    await context.close();
  }
});

for (const route of [
  "/",
  "/experience",
  "/projects",
  "/contact",
] as const) {
  const sceneIds = RESIDENT_SCENES_BY_ROUTE[route];
  const expectedModels = INITIAL_MODELS_BY_ROUTE[route];
  const expectedModelSet = new Set<string>(expectedModels);

  test(`keeps mobile ${route} direct-entry startup within route-scoped budgets`, async ({
    browser,
  }, testInfo) => {
    const context = await createRuntimeContext(browser, testInfo, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await installRuntimeProbe(page, "context-ceiling");
    await fulfillPosters(page);
    const models = await fulfillModels(page);

    try {
      await page.goto(route);
      await expectNoBlockingLoadingScreen(page);
      await expectReadyResidentSet(page, sceneIds);
      await expect(page.locator(".scene-stage--resident")).toHaveCount(
        sceneIds.length,
      );
      await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(
        sceneIds.length,
      );

      await expect
        .poll(() => [...new Set(models.requested)].sort())
        .toEqual([...expectedModels].sort());
      expect(models.requested).toHaveLength(expectedModels.length);
      for (const modelUrl of expectedModels) {
        expect(models.requestCount(modelUrl)).toBe(1);
      }
      for (const modelUrl of ALL_LIVE_MODELS) {
        if (expectedModelSet.has(modelUrl)) continue;
        expect(models.requestCount(modelUrl)).toBe(0);
      }

      expect(sceneIds.length).toBeLessThanOrEqual(3);
      expect(expectedModels.length).toBeLessThanOrEqual(3);
      expect(await connectedContextCallCount(page)).toBe(sceneIds.length);
      await expectBoundedSceneResources(page, 3);
      await expectNoUnhandledRuntimeErrors(page);
    } finally {
      await disposeFixture(models);
      await context.close();
    }
  });
}

test("keeps live capture residents pooled around poster-only scenes and evicts the least-recently-seen context at the cap", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    await openScene(page, "nasa-rocket");
    await expectReadyResidentSet(page, ["nasa-rocket"]);
    await rememberResidentIdentitySet(page, "capture-nasa");
    const callsBeforePosterScenes = await connectedContextCallCount(page);

    for (const sceneId of ["eog-poster", "paycom-poster"] as const) {
      await activateNextCaptureScene(page);
      const section = page.locator(`[data-scene-id="${sceneId}"]`);
      await expect(section).toHaveAttribute("data-scene-active", "true");
      await expect(page.getByTestId("scene-runtime-host")).toHaveCount(0);
      await expect(
        page.locator(
          '.scene-stage--resident[data-scene-pool-state="assigned"]',
        ),
      ).toHaveCount(0);
      await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(1);
      await expect(
        section.locator(":scope > .scene-section__poster"),
      ).toBeVisible();
      await expect(page.getByTestId("scene-rotation-area")).toHaveCount(0);
      await expectResidentIdentitySetState(page, "capture-nasa", "pooled");
    }
    expect(await connectedContextCallCount(page)).toBe(callsBeforePosterScenes);

    await activateNextCaptureScene(page);
    await expectReadyResidentSet(page, ["projects-hero"]);
    await expectResidentIdentitySetState(page, "capture-nasa", "pooled");
    expect(await connectedContextCallCount(page)).toBe(
      callsBeforePosterScenes + 1,
    );
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(2);

    await page.evaluate(() => {
      for (let index = 0; index < 3; index += 1) {
        const section = document.createElement("section");
        section.className = "scene-section runtime-lru-probe";
        section.dataset.requiredLive = "true";
        section.dataset.sceneId = "home-hero";
        const content = document.createElement("div");
        content.className = "scene-section__content";
        section.append(content);
        document.body.append(section);
      }
    });
    await expect(
      page.locator(
        '.scene-stage--resident[data-scene-pool-state="assigned"]',
      ),
    ).toHaveCount(4);
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(4);
    await expectResidentIdentitySetEvicted(page, "capture-nasa");
    expect(await connectedContextCallCount(page)).toBe(
      callsBeforePosterScenes + 4,
    );
  } finally {
    await disposeFixture(models);
  }
});

test("uses unsupported poster mode without constructing a renderer or requesting a model", async ({
  page,
}) => {
  await installRuntimeProbe(page, "unsupported");
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "unsupported");
    await expect(host.locator("picture")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "3D unavailable" }),
    ).toBeDisabled();
    expect(models.requested).toEqual([]);
    expect(await probeEvents(page, "failure")).toMatchObject([
      {
        reason: "webgl2-unavailable",
        sceneId: "home-hero",
        status: "failure",
      },
    ]);
    await expect(
      page.getByRole("link", { name: "Home", includeHidden: true }),
    ).toHaveAttribute("href", "/");
  } finally {
    await disposeFixture(models);
  }
});

test("turns a post-probe renderer construction failure into one coded poster fallback", async ({
  page,
}) => {
  await installRuntimeProbe(page, "renderer-throws");
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "error");
    await expect(host.locator("picture")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(models.requested.length).toBeLessThanOrEqual(1);
    expect(models.requested.every((url) => url === HOME_MODEL)).toBe(true);
    await expect(
      page.getByRole("heading", {
        name: "Origami crane home scene",
        level: 1,
        includeHidden: true,
      }),
    ).toHaveCount(1);
    expect(
      (await probeEvents(page, "failure")).filter(
        ({ sceneId }) => sceneId === "home-hero",
      ),
    ).toMatchObject([
      {
        reason: "webgl2-unavailable",
        sceneId: "home-hero",
        status: "failure",
      },
    ]);
    await expect(
      page.getByRole("link", { name: "Home", includeHidden: true }),
    ).toHaveAttribute("href", "/");
    await expectNoUnhandledRuntimeErrors(page);
  } finally {
    await disposeFixture(models);
  }
});

test("defaults Save-Data to poster-only without persisting or requesting a model", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    await page.goto("/");
    await expectNoBlockingLoadingScreen(page);
    await expect(
      page.locator(
        '.scene-stage--resident[data-scene-pool-state="assigned"]',
      ),
    ).toHaveCount(1);
    await expect(residentHost(page, "home-hero")).toHaveAttribute(
      "data-three-status",
      "disabled",
    );

    await page.getByRole("link", { name: "Experience", exact: true }).click();
    await expect(page).toHaveURL(/\/experience$/);
    await expectNoBlockingLoadingScreen(page);
    await expect(
      page.locator(
        '.scene-stage--resident[data-scene-pool-state="assigned"]',
      ),
    ).toHaveCount(3);
    await expect(
      page.locator('.scene-stage--resident[data-scene-pool-state="pooled"]'),
    ).toHaveCount(1);
    for (const sceneId of RESIDENT_SCENES_BY_ROUTE["/experience"]) {
      const host = residentHost(page, sceneId);
      await expect(host).toHaveAttribute("data-three-status", "disabled");
      await expect(host.locator("picture.scene-runtime__poster")).toHaveCount(1);
      await expect(host.locator("picture.scene-runtime__poster")).toBeVisible();
    }
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "3D off" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(models.requested).toEqual([]);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("personal-site:three-enabled"),
      ),
    ).toBeNull();
  } finally {
    await disposeFixture(models);
  }
});

test("persists an explicit off choice in local storage and keeps the poster after reload", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    await page.goto("/projects");
    await expectReadyResidentSet(page, RESIDENT_SCENES_BY_ROUTE["/projects"]);
    await expectNoBlockingLoadingScreen(page);
    await page.getByRole("button", { name: "3D on" }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
    for (const sceneId of RESIDENT_SCENES_BY_ROUTE["/projects"]) {
      const host = residentHost(page, sceneId);
      await expect(host).toHaveAttribute("data-three-status", "disabled");
      await expect(host.locator("picture.scene-runtime__poster")).toBeVisible();
    }
    expect(
      await page.evaluate(() =>
        localStorage.getItem("personal-site:three-enabled"),
      ),
    ).toBe("off");

    const requestCount = models.requested.length;
    await page.reload();
    await expect(page.locator(".scene-stage--resident")).toHaveCount(3);
    await expect(page.locator("canvas")).toHaveCount(0);
    for (const sceneId of RESIDENT_SCENES_BY_ROUTE["/projects"]) {
      const host = residentHost(page, sceneId);
      await expect(host).toHaveAttribute("data-three-status", "disabled");
      await expect(host.locator("picture.scene-runtime__poster")).toBeVisible();
    }
    expect(models.requested).toHaveLength(requestCount);
  } finally {
    await disposeFixture(models);
  }
});

test("keeps semantic fallback through a GLB failure while replaced capture residents stay pooled", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [LEAGUE_MODEL]: { kind: "http-error", status: 503 } },
  });

  try {
    await openScene(page, "projects-hero");
    await expectReadyResidentSet(page, ["projects-hero"]);
    await rememberResidentIdentitySet(page, "capture-projects");
    await models.waitForRequest(LEAGUE_MODEL);
    await expect
      .poll(() =>
        models.records.find(
          ({ ordinal, pathname }) =>
            ordinal === 1 && pathname === LEAGUE_MODEL,
        )?.phase,
      )
      .toBe("request-finished");

    await activateNextCaptureScene(page);
    const host = page.getByTestId("scene-runtime-host");
    await expect(host).toHaveAttribute("data-active-scene-id", "league-ban");
    await expect(host).toHaveAttribute("data-three-status", "error");
    await expect(host.locator("picture.scene-runtime__poster")).toHaveCount(1);
    await expect(host.locator("picture.scene-runtime__poster")).toBeVisible();
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(2);
    await expectResidentIdentitySetState(page, "capture-projects", "pooled");
    expect(models.requestCount(LEAGUE_MODEL)).toBe(2);
    expect(
      (await probeEvents(page, "failure")).filter(
        ({ sceneId }) => sceneId === "league-ban",
      ),
    ).toMatchObject([
      { reason: "fetch", sceneId: "league-ban", status: "failure" },
    ]);
    await expect(
      page.getByRole("link", { name: "Home", includeHidden: true }),
    ).toHaveAttribute("href", "/");
    await expect(page.getByTestId("capture-next-scene")).toHaveAttribute(
      "href",
      "/scene-capture?scene=froggie-adventures&controls=1",
    );

    await rememberResidentIdentitySet(page, "capture-league-error");
    const failedCalls = await connectedContextCallCount(page);
    await activateNextCaptureScene(page);
    await expectReadyResidentSet(page, ["froggie-adventures"]);
    await expectResidentIdentitySetState(
      page,
      "capture-league-error",
      "pooled",
    );
    await expectResidentIdentitySetState(page, "capture-projects", "pooled");
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(3);
    expect(await connectedContextCallCount(page)).toBe(failedCalls + 1);
  } finally {
    await disposeFixture(models);
  }
});

test("reports corrupt model bytes as one decode failure without a ready mark", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { kind: "decode-error" } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "error");
    await expect(host.locator("picture")).toBeVisible();
    expect(models.requestCount(HOME_MODEL)).toBeGreaterThanOrEqual(1);
    expect(models.requestCount(HOME_MODEL)).toBeLessThanOrEqual(2);
    expect(
      (await probeEvents(page, "failure")).filter(
        ({ sceneId }) => sceneId === "home-hero",
      ),
    ).toMatchObject([
      { reason: "decode", sceneId: "home-hero", status: "failure" },
    ]);
    expect(
      await page.evaluate(
        () => performance.getEntriesByName("scene-ready:home-hero").length,
      ),
    ).toBe(0);
  } finally {
    await disposeFixture(models);
  }
});

test("loads current normally and idles at most one adjacent model after readiness", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: {
      [HOME_MODEL]: { hold: true },
      [EXPERIENCE_MODEL]: { hold: true },
    },
  });

  try {
    const host = await openScene(page, "home-hero");
    await models.waitForRequest(HOME_MODEL);
    await expect(host).toHaveAttribute("data-three-status", "loading");
    await page.waitForTimeout(750);
    expect(models.requested).toEqual([HOME_MODEL]);
    expect(models.pendingCount(HOME_MODEL)).toBe(1);
    expect(models.pendingCount(EXPERIENCE_MODEL)).toBe(0);
    expect(
      await page.evaluate(() => window.__sceneResourceDebug?.size ?? -1),
    ).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() =>
        Math.max(
          0,
          ...(window.__sceneResourceDebug?.events.map(({ size }) => size) ?? []),
        ),
      ),
    ).toBeLessThanOrEqual(1);

    expect(models.release(HOME_MODEL)).toBe(1);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expectSingleReadyMark(page, "home-hero");
    await models.waitForRequest(EXPERIENCE_MODEL);
    expect(models.requested).toEqual([HOME_MODEL, EXPERIENCE_MODEL]);
    expect(models.pendingCount(EXPERIENCE_MODEL)).toBe(1);
    for (const modelUrl of ALL_LIVE_MODELS) {
      expect(models.requestCount(modelUrl)).toBe(
        modelUrl === HOME_MODEL || modelUrl === EXPERIENCE_MODEL ? 1 : 0,
      );
    }
    expect(
      await page.evaluate(() => window.__sceneResourceDebug?.size ?? -1),
    ).toBeLessThanOrEqual(2);
    expect(
      await page.evaluate(() =>
        Math.max(
          0,
          ...(window.__sceneResourceDebug?.events.map(({ size }) => size) ?? []),
        ),
      ),
    ).toBeLessThanOrEqual(2);
  } finally {
    await disposeFixture(models);
  }
});

test("ignores a failed speculative model and retries it once when promoted", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: {
      [EXPERIENCE_MODEL]: [
        { kind: "abort" },
        { kind: "triangle" },
      ],
    },
  });

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await rememberResidentIdentitySet(page, "speculative-home");
    const homeContextCalls = await connectedContextCallCount(page);
    await models.waitForRequest(EXPERIENCE_MODEL);
    await expect
      .poll(() =>
        models.records.find(
          ({ pathname, ordinal }) =>
            pathname === EXPERIENCE_MODEL && ordinal === 1,
        )?.phase,
      )
      .toBe("request-failed");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    expect(
      (await probeEvents(page, "failure")).filter(
        ({ sceneId }) => sceneId === "home-hero",
      ),
    ).toEqual([]);

    await activateNextCaptureScene(page);
    await expect(host).toHaveAttribute(
      "data-active-scene-id",
      "experience-hero",
    );
    await models.waitForRequest(EXPERIENCE_MODEL, 2);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    expect(models.requestCount(EXPERIENCE_MODEL)).toBe(2);
    await expectResidentIdentitySetState(page, "speculative-home", "pooled");
    await expect(page.locator(".scene-stage--resident canvas")).toHaveCount(2);
    expect(await connectedContextCallCount(page)).toBe(homeContextCalls + 1);
  } finally {
    await disposeFixture(models);
  }
});

test("times out one current request, ignores its late completion, and retries only after reactivation", async ({
  page,
}) => {
  test.setTimeout(25_000);
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: {
      [HOME_MODEL]: [{ hold: true }, { kind: "triangle" }],
    },
  });

  try {
    const host = await openScene(page, "home-hero");
    await models.waitForRequest(HOME_MODEL);
    await expect(host).toHaveAttribute("data-three-status", "loading");
    await expect(host).toHaveAttribute("data-three-status", "error", {
      timeout: 12_500,
    });
    await expect
      .poll(() =>
        models.records.find(
          ({ ordinal, pathname }) => ordinal === 1 && pathname === HOME_MODEL,
        )?.phase,
      )
      .toBe("request-failed");
    expect(models.requestCount(HOME_MODEL)).toBe(1);
    for (const modelUrl of ALL_LIVE_MODELS) {
      expect(models.requestCount(modelUrl)).toBeLessThanOrEqual(1);
    }
    await expect.poll(() => models.pendingCount(HOME_MODEL)).toBe(0);
    expect(models.release(HOME_MODEL)).toBe(0);
    await page.waitForTimeout(250);
    await expect(host).toHaveAttribute("data-three-status", "error");
    await expect(host.locator("picture.scene-runtime__poster")).toBeVisible();
    expect(
      await page.evaluate(
        () => performance.getEntriesByName("scene-ready:home-hero").length,
      ),
    ).toBe(0);
    const timeoutFailures = (await probeEvents(page, "failure")).filter(
      ({ sceneId }) => sceneId === "home-hero",
    );
    expect(timeoutFailures).toMatchObject([
      { reason: "timeout", sceneId: "home-hero", status: "failure" },
    ]);
    expect(timeoutFailures[0].durationMs).toBeGreaterThanOrEqual(9_900);

    await page.getByRole("button", { name: "3D on" }).click();
    await expect(host).toHaveAttribute("data-three-status", "disabled");
    await page.getByRole("button", { name: "3D off" }).click();
    await models.waitForRequest(HOME_MODEL, 2);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    expect(models.requestCount(HOME_MODEL)).toBe(2);
    for (const modelUrl of ALL_LIVE_MODELS) {
      expect(models.requestCount(modelUrl)).toBeLessThanOrEqual(2);
    }
    await expectSingleReadyMark(page, "home-hero");
  } finally {
    await disposeFixture(models);
  }
});

test("bounds rapid resident ownership and disposes a late decode at cache teardown", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await page.addInitScript((delayedUrl: string) => {
    window.__sceneRuntimeTestHooks = {
      afterModelDecode: (url) => {
        if (url !== delayedUrl || window.__lateDecodeWaiting) return;
        window.__lateDecodeWaiting = true;
        return new Promise<void>((resolve) => {
          window.__releaseLateDecode = resolve;
        });
      },
    };
  }, EXPERIENCE_MODEL);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [INTRO_MODEL]: { hold: true } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await models.waitForRequest(EXPERIENCE_MODEL);
    await expect
      .poll(() => page.evaluate(() => window.__lateDecodeWaiting === true))
      .toBe(true);

    await activateNextCaptureScene(page);
    await expect(host).toHaveAttribute(
      "data-active-scene-id",
      "experience-hero",
    );
    await expect(host).toHaveAttribute("data-three-status", "loading");
    expect(models.requestCount(EXPERIENCE_MODEL)).toBe(1);

    await activateNextCaptureScene(page);
    await expect(host).toHaveAttribute(
      "data-active-scene-id",
      "experience-intro",
    );
    await models.waitForRequest(INTRO_MODEL);
    await expect
      .poll(() => [...new Set(models.requested)].sort())
      .toEqual([HOME_MODEL, EXPERIENCE_MODEL, INTRO_MODEL].sort());
    await page.waitForTimeout(250);
    expect(models.requested).toHaveLength(3);
    expect(models.pendingCount()).toBeLessThanOrEqual(1);
    for (const modelUrl of ALL_LIVE_MODELS) {
      if (
        modelUrl === HOME_MODEL ||
        modelUrl === EXPERIENCE_MODEL ||
        modelUrl === INTRO_MODEL
      ) {
        expect(models.requestCount(modelUrl)).toBe(1);
      } else {
        expect(models.requestCount(modelUrl)).toBe(0);
      }
    }
    const countsBeforeDisable = new Map(
      ALL_LIVE_MODELS.map((modelUrl) => [
        modelUrl,
        models.requestCount(modelUrl),
      ]),
    );
    expect(
      await page.evaluate(() => window.__sceneResourceDebug?.size ?? -1),
    ).toBeLessThanOrEqual(ALL_LIVE_MODELS.length);
    expect(
      (await probeEvents(page, "ready")).some(
        ({ sceneId }) => sceneId === "experience-hero",
      ),
    ).toBe(false);

    await page.getByRole("button", { name: "3D on" }).click();
    await expect(host).toHaveAttribute("data-three-status", "disabled");
    await expect(host.locator("picture.scene-runtime__poster")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__sceneResourceDebug?.size ?? -1))
      .toBe(0);

    await page.evaluate(() => window.__releaseLateDecode?.());
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            window.__sceneResourceDebug?.events.some(
              ({ action, url }) =>
                action === "dispose-late-decoded" &&
                url === "/models/crane-workout.glb",
            ),
          ),
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() =>
        Math.max(
          0,
          ...(window.__sceneResourceDebug?.events.map(({ size }) => size) ??
            []),
        ),
      ),
    ).toBeLessThanOrEqual(ALL_LIVE_MODELS.length);
    expect(models.release(INTRO_MODEL)).toBe(0);

    models.setPlan(INTRO_MODEL, { kind: "triangle" });
    await page.getByRole("button", { name: "3D off" }).click();
    await expect(host).toHaveAttribute("data-three-status", "ready");
    for (const modelUrl of ALL_LIVE_MODELS) {
      expect(models.requestCount(modelUrl)).toBeLessThanOrEqual(
        (countsBeforeDisable.get(modelUrl) ?? 0) + 1,
      );
    }
    expect(
      await page.evaluate(() => window.__sceneResourceDebug?.size ?? -1),
    ).toBeLessThanOrEqual(ALL_LIVE_MODELS.length);
  } finally {
    await disposeFixture(models);
  }
});

test("uses DPR 1 at device scale 1 and clamps device scale 3 to bounded DPR 1.5", async ({
  browser,
}, testInfo) => {
  for (const [deviceScaleFactor, expectedDpr] of [
    [1, 1],
    [3, 1.5],
  ] as const) {
    const context = await createRuntimeContext(browser, testInfo, {
      deviceScaleFactor,
      viewport: { width: 800, height: 600 },
    });
    const page = await context.newPage();
    let models: ModelFixtureController | undefined;
    try {
      await installRuntimeProbe(page);
      await fulfillPosters(page);
      models = await fulfillModels(page);
      const host = await openScene(page, "home-hero");
      await expect(host).toHaveAttribute("data-three-status", "ready");

      const frame = await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.at(-1) ?? null,
      );
      expect(frame).not.toBeNull();
      expect(frame?.pixelRatio).toBe(expectedDpr);
      expect(frame?.cssWidth).toBe(800);
      expect(frame?.cssHeight).toBe(600);
      expect(frame?.bufferWidth).toBeLessThanOrEqual(
        Math.ceil((frame?.cssWidth ?? 0) * 1.5),
      );
      expect(frame?.bufferHeight).toBeLessThanOrEqual(
        Math.ceil((frame?.cssHeight ?? 0) * 1.5),
      );
      expect(frame?.bufferWidth).toBe(
        Math.round((frame?.cssWidth ?? 0) * expectedDpr),
      );
      expect(frame?.bufferHeight).toBe(
        Math.round((frame?.cssHeight ?? 0) * expectedDpr),
      );
    } finally {
      await disposeFixture(models);
      await context.close();
    }
  }
});

test("renders exactly on changed effective poses and emits one finite health event for twelve deliberate frames", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { kind: "committed" } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    const area = page.getByTestId("scene-rotation-area");
    const box = await area.boundingBox();
    if (!box) throw new Error("Rotation area has no browser bounds");
    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    await area.evaluate((element) => {
      element.addEventListener(
        "pointerdown",
        (event) => {
          window.__task14PointerId = (event as PointerEvent).pointerId;
        },
        { once: true },
      );
    });
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.evaluate(() => window.__sceneRuntimeDebug?.clearFrames());

    await page.mouse.move(center.x + 20, center.y);
    await expect
      .poll(() =>
        page.evaluate(() => window.__sceneRuntimeDebug?.frames.length ?? 0),
      )
      .toBe(1);
    await page.waitForTimeout(150);
    const changedFrames = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames ?? [],
    );
    expect(changedFrames).toHaveLength(1);
    expect(changedFrames[0]).toMatchObject({
      renderTarget: "screen",
      rootName: "scene-root:home-hero",
      shadowMapEnabled: false,
    });
    expect(changedFrames[0].yaw).toBeCloseTo((2.8 * Math.PI) / 180, 5);
    expect(changedFrames[0].pitch).toBeCloseTo(0, 5);

    await page.mouse.move(center.x + 20, center.y);
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(1);

    await page.mouse.move(box.x + box.width - 1, center.y);
    await expect
      .poll(() =>
        page.evaluate(() => window.__sceneRuntimeDebug?.frames.length ?? 0),
      )
      .toBe(2);
    const clampedFrame = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames.at(-1) ?? null,
    );
    expect(clampedFrame?.yaw).toBeCloseTo((25 * Math.PI) / 180, 5);

    await area.evaluate((element, y) => {
      const pointerId = window.__task14PointerId;
      if (pointerId === undefined) throw new Error("Pointer id was not captured");
      element.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          buttons: 1,
          clientX: 10_000,
          clientY: y,
          isPrimary: true,
          pointerId,
          pointerType: "mouse",
        }),
      );
    }, center.y);
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(2);
    await page.mouse.up();

    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__sceneRuntimeDebug?.clearFrames();
      const events = window.__runtimeAcceptanceProbe?.events;
      if (!events) return;
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index].status === "rotation-health") {
          events.splice(index, 1);
        }
      }
    });
    await page.evaluate(async () => {
      const debug = window.__sceneRuntimeDebug;
      if (!debug?.invalidate) {
        throw new Error("Scene runtime invalidation port is unavailable");
      }
      for (let index = 0; index < 12; index += 1) {
        const before = debug.renderer.info.render.frame;
        debug.invalidate();
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error(`Deliberate frame ${index + 1} timed out`)),
            1_000,
          );
          const check = () => {
            if (debug.renderer.info.render.frame > before) {
              window.clearTimeout(timeout);
              resolve();
              return;
            }
            window.requestAnimationFrame(check);
          };
          window.requestAnimationFrame(check);
        });
      }
    });
    await page.waitForTimeout(150);

    const health = await probeEvents(page, "rotation-health");
    expect(health).toHaveLength(1);
    expect(health[0]).toMatchObject({
      sceneId: "home-hero",
      status: "rotation-health",
    });
    expect(health[0].fps).toBeGreaterThan(0);
    expect(Number.isFinite(health[0].fps)).toBe(true);
    const deliberateFrames = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames ?? [],
    );
    expect(deliberateFrames).toHaveLength(12);
    for (let index = 1; index < deliberateFrames.length; index += 1) {
      expect(deliberateFrames[index].frame).toBe(
        deliberateFrames[index - 1].frame + 1,
      );
    }
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(12);
  } finally {
    await disposeFixture(models);
  }
});

test("captures a primary mouse outside the rotation bounds and stops after up, cancel, or lost capture", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { kind: "committed" } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    const area = page.getByTestId("scene-rotation-area");
    const box = await area.boundingBox();
    if (!box) throw new Error("Rotation area has no browser bounds");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Viewport size is unavailable");
    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    const outside = {
      x: Math.min(viewport.width - 2, box.x + box.width + 24),
      y: center.y,
    };
    expect(outside.x).toBeGreaterThan(box.x + box.width);

    await area.evaluate((element) => {
      element.addEventListener("pointerdown", (event) => {
        window.__task14PointerId = (event as PointerEvent).pointerId;
      });
      element.addEventListener("lostpointercapture", (event) => {
        window.__task14LostCapture = event.isTrusted;
      });
      element.addEventListener("gotpointercapture", (event) => {
        window.__task14GotCapture = event.isTrusted;
      });
    });
    await page.evaluate(() => window.__sceneRuntimeDebug?.clearFrames());
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(outside.x, outside.y);
    await expect
      .poll(() =>
        page.evaluate(() => window.__sceneRuntimeDebug?.frames.length ?? 0),
      )
      .toBe(1);
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.getAttribute("data-testid"),
        outside,
      ),
    ).not.toBe("scene-rotation-area");

    await page.mouse.up();
    const afterUp = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames.length ?? 0,
    );
    await page.mouse.move(center.x, center.y);
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(afterUp);

    await page.evaluate(() => window.__sceneRuntimeDebug?.clearFrames());
    await page.evaluate(() => {
      window.__task14GotCapture = false;
      window.__task14LostCapture = false;
    });
    await page.mouse.down();
    // A first in-bounds move processes the pending pointer capture into the
    // browser's active capture override before we release it.
    await page.mouse.move(center.x - 5, center.y);
    await expect
      .poll(() => page.evaluate(() => window.__task14GotCapture === true))
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => window.__sceneRuntimeDebug?.frames.length ?? 0),
      )
      .toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__sceneRuntimeDebug?.clearFrames();
      window.__task14LostCapture = false;
    });
    expect(
      await area.evaluate((element) => {
        const pointerId = window.__task14PointerId;
        return pointerId !== undefined && element.hasPointerCapture(pointerId);
      }),
    ).toBe(true);
    await area.evaluate((element) => {
      const pointerId = window.__task14PointerId;
      if (pointerId === undefined) throw new Error("Pointer id was not captured");
      element.releasePointerCapture(pointerId);
    });
    expect(
      await area.evaluate((element) => {
        const pointerId = window.__task14PointerId;
        return pointerId !== undefined && element.hasPointerCapture(pointerId);
      }),
    ).toBe(false);
    await page.mouse.move(center.x + 30, center.y);
    await expect
      .poll(() => page.evaluate(() => window.__task14LostCapture === true))
      .toBe(true);
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(0);
    await page.mouse.up();

    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await area.evaluate((element, point) => {
      const pointerId = window.__task14PointerId;
      if (pointerId === undefined) throw new Error("Pointer id was not captured");
      element.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          clientX: point.x,
          clientY: point.y,
          isPrimary: true,
          pointerId,
          pointerType: "mouse",
        }),
      );
    }, center);
    await page.mouse.move(outside.x, outside.y);
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(0);
    await page.mouse.up();
  } finally {
    await disposeFixture(models);
  }
});

test("lets a vertical touch swipe scroll without rotation and makes a horizontal drag rotate without scrolling", async ({
  browser,
}, testInfo) => {
  const context = await createRuntimeContext(browser, testInfo, {
    deviceScaleFactor: 1.5,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  let models: ModelFixtureController | undefined;
  try {
    await installRuntimeProbe(page);
    await fulfillPosters(page);
    models = await fulfillModels(page, [], {
      plans: { [HOME_MODEL]: { kind: "committed" } },
    });
    const host = await openScene(page, "home-hero", "controls=1&scroll=1");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    const area = page.getByTestId("scene-rotation-area");
    await expect(area).toHaveCSS("touch-action", "pan-y pinch-zoom");
    const box = await area.boundingBox();
    if (!box) throw new Error("Rotation area has no browser bounds");
    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    const session = await context.newCDPSession(page);
    await area.evaluate((element) => {
      window.__task14TouchCancels = [];
      element.addEventListener("pointercancel", (event) => {
        window.__task14TouchCancels?.push(event.isTrusted);
      });
    });

    const swipe = async (
      start: { readonly x: number; readonly y: number },
      end: { readonly x: number; readonly y: number },
    ) => {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...start, id: 1 }],
      });
      for (let step = 1; step <= 5; step += 1) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              id: 1,
              x: start.x + ((end.x - start.x) * step) / 5,
              y: start.y + ((end.y - start.y) * step) / 5,
            },
          ],
        });
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };

    const initialPose = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames.at(-1) ?? null,
    );
    await page.evaluate(() => window.__sceneRuntimeDebug?.clearFrames());
    await swipe(
      { x: center.x, y: center.y + 100 },
      { x: center.x, y: center.y - 100 },
    );
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(40);
    expect(
      await page.evaluate(
        () => window.__sceneRuntimeDebug?.frames.length ?? 0,
      ),
    ).toBe(0);
    const touchCancels = await page.evaluate(
      () => window.__task14TouchCancels ?? [],
    );
    expect(touchCancels.length).toBeGreaterThanOrEqual(1);
    expect(touchCancels.every(Boolean)).toBe(true);
    const poseAfterVertical = await page.evaluate(() => {
      const debug = window.__sceneRuntimeDebug;
      const root = debug?.scene?.getObjectByName("scene-root:home-hero");
      return root
        ? { pitch: root.rotation.x, yaw: root.rotation.y }
        : null;
    });
    expect(poseAfterVertical?.pitch).toBeCloseTo(initialPose?.pitch ?? 0, 6);
    expect(poseAfterVertical?.yaw).toBeCloseTo(initialPose?.yaw ?? 0, 6);

    const canvas = page.locator("canvas");
    const beforePixels = await canvas.screenshot();
    const beforeHorizontalScroll = await page.evaluate(() => window.scrollY);
    await swipe(
      { x: center.x - 70, y: center.y },
      { x: center.x + 70, y: center.y },
    );
    await expect
      .poll(() =>
        page.evaluate(() => window.__sceneRuntimeDebug?.frames.length ?? 0),
      )
      .toBeGreaterThan(0);
    const afterHorizontalScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterHorizontalScroll - beforeHorizontalScroll)).toBeLessThan(
      10,
    );
    const poseAfterHorizontal = await page.evaluate(() => {
      const debug = window.__sceneRuntimeDebug;
      const root = debug?.scene?.getObjectByName("scene-root:home-hero");
      return root
        ? { pitch: root.rotation.x, yaw: root.rotation.y }
        : null;
    });
    expect(poseAfterHorizontal?.yaw).not.toBeCloseTo(
      poseAfterVertical?.yaw ?? 0,
      6,
    );
    expect(poseAfterHorizontal?.pitch).toBeCloseTo(
      poseAfterVertical?.pitch ?? 0,
      6,
    );
    await expect
      .poll(async () => !(await canvas.screenshot()).equals(beforePixels))
      .toBe(true);
  } finally {
    await disposeFixture(models);
    await context.close();
  }
});

test("loses the real context before the first model frame and restores pixels on the same runtime", async ({
  page,
}) => {
  test.setTimeout(20_000);
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [HOME_MODEL]: { kind: "committed", hold: true } },
  });

  try {
    const host = await openScene(page, "home-hero");
    await models.waitForRequest(HOME_MODEL);
    await expect(host).toHaveAttribute("data-three-status", "loading");
    const runtimeCanvas = host.locator("canvas");
    await expect
      .poll(() =>
        runtimeCanvas.evaluate(
          (element) =>
            window.__runtimeAcceptanceProbe?.createdContextsByCanvas.has(
              element as HTMLCanvasElement,
            ) ?? false,
        ),
      )
      .toBe(true);
    const lost = await host.locator("canvas").evaluate((element) => {
      const probe = window.__runtimeAcceptanceProbe;
      const canvas = element as HTMLCanvasElement;
      const context = probe?.createdContextsByCanvas.get(canvas);
      if (!probe || !context || !canvas) return false;
      canvas.addEventListener("webglcontextlost", (event) => {
        probe.contextLossDefaultPrevented = event.defaultPrevented;
      });
      const extension = context.getExtension("WEBGL_lose_context");
      if (!extension) return false;
      probe.loseContextExtension = extension;
      extension.loseContext();
      return true;
    });
    expect(lost).toBe(true);
    await expect(host).toHaveAttribute("data-three-status", "context-lost");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__runtimeAcceptanceProbe?.contextLossDefaultPrevented,
        ),
      )
      .toBe(true);
    await expect(host.locator("picture")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);

    expect(models.release(HOME_MODEL)).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(window.__sceneRuntimeDebug?.renderer)),
      )
      .toBe(true);
    await page.waitForTimeout(500);
    await expect(host).toHaveAttribute("data-three-status", "context-lost");
    expect(
      await page.evaluate(
        () => performance.getEntriesByName("scene-ready:home-hero").length,
      ),
    ).toBe(0);
    await rememberRuntimeIdentity(page);

    const restoring = await page.evaluate(() => {
      const extension =
        window.__runtimeAcceptanceProbe?.loseContextExtension;
      if (!extension) return false;
      extension.restoreContext();
      return true;
    });
    expect(restoring).toBe(true);
    await expect(host).toHaveAttribute("data-three-status", "ready", {
      timeout: 10_000,
    });
    await expectRuntimeIdentity(page);
    expect(
      await page.evaluate(
        () =>
          window.__sceneRuntimeDebug?.context?.isContextLost() ??
          true,
      ),
    ).toBe(false);
    await expect(host.locator("picture")).toBeHidden();
    const restoredFrame = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames.at(-1) ?? null,
    );
    expect(restoredFrame).toMatchObject({
      renderTarget: "screen",
      rootName: "scene-root:home-hero",
      sceneId: "home-hero",
      shadowMapEnabled: false,
    });
    expect(restoredFrame?.calls).toBeGreaterThan(0);

    const canvas = page.locator("canvas");
    const restoredPixels = await canvas.screenshot();
    const frameCountBeforeRotation = await page.evaluate(
      () => window.__sceneRuntimeDebug?.frames.length ?? 0,
    );
    const area = page.getByTestId("scene-rotation-area");
    const box = await area.boundingBox();
    if (!box) throw new Error("Restored rotation area has no browser bounds");
    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 40, center.y);
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(() => window.__sceneRuntimeDebug?.frames.length ?? 0),
      )
      .toBeGreaterThan(frameCountBeforeRotation);
    await expect
      .poll(
        async () => !(await canvas.screenshot()).equals(restoredPixels),
      )
      .toBe(true);
    await expectSingleReadyMark(page, "home-hero");
    expect(
      (await probeEvents(page, "ready")).filter(
        ({ sceneId }) => sceneId === "home-hero",
      ),
    ).toHaveLength(1);
    expect(
      (await probeEvents(page, "context-lost")).filter(
        ({ sceneId }) => sceneId === "home-hero",
      ),
    ).toHaveLength(1);
  } finally {
    await disposeFixture(models);
  }
});
