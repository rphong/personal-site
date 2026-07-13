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
const LEAGUE_MODEL = "/models/crane-on-league.glb";

type ProbeMode = "normal" | "unsupported" | "renderer-throws";

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
    __issue4Canvas?: HTMLCanvasElement | null;
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
        probeMode === "renderer-throws"
      ) {
        throw new Error("Intentional connected renderer construction failure");
      }

      const context = Reflect.apply(originalGetContext, this, [
        kind,
        ...arguments_,
      ]) as RenderingContext | null;
      if (kind === "webgl2" && connected && context) {
        const webgl2 = context as WebGL2RenderingContext;
        if (probe.connectedCanvas && probe.connectedCanvas !== this) {
          probe.connectedCanvasChanges += 1;
        }
        if (probe.connectedContext && probe.connectedContext !== webgl2) {
          probe.connectedContextChanges += 1;
        }
        probe.connectedCanvas = this;
        probe.connectedContext = webgl2;
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

test("anchors active scene visuals to their sections while desktop and mobile vertical scrolling stays untrapped", async ({
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
    await fulfillPosters(page);
    const models = await fulfillModels(page);

    try {
      await page.goto("/experience");
      const host = page.getByTestId("scene-runtime-host");
      await expect(host).toHaveAttribute(
        "data-active-scene-id",
        "experience-hero",
      );
      await expect(host).toHaveAttribute("data-three-status", "ready");
      await page.evaluate(() => {
        window.__issue4Canvas = document.querySelector("canvas");
      });
      const section = page.locator('[data-scene-id="experience-intro"]');
      await section.evaluate((element) => {
        document.documentElement.style.scrollBehavior = "auto";
        const top = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - window.innerHeight * 0.08);
      });
      await expect(host).toHaveAttribute(
        "data-active-scene-id",
        "experience-intro",
      );
      await expect(host).toHaveAttribute("data-three-status", "ready");
      expect(
        await page.evaluate(
          () => document.querySelector("canvas") === window.__issue4Canvas,
        ),
        `${viewport.name} section activation should retain the Canvas node`,
      ).toBe(true);
      expect(
        await host.evaluate(
          (element, sceneId) =>
            element.parentElement?.getAttribute("data-scene-owner-id") ===
              sceneId &&
            element.parentElement?.parentElement?.getAttribute(
              "data-scene-id",
            ) === sceneId,
          "experience-intro",
        ),
        `${viewport.name} runtime stage should track the active section owner`,
      ).toBe(true);

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
    } finally {
      await disposeFixture(models);
      await context.close();
    }
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

test("hands the decoded host poster to the Canvas without a blank ownership state", async ({
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
    await expect(host.locator("picture")).toBeVisible();
    await expect(host.locator(".scene-runtime__canvas")).toBeHidden();
    await expect(
      page.locator(
        '[data-scene-id="home-hero"] > .scene-section__poster',
      ),
    ).toBeHidden();

    expect(models.release(HOME_MODEL)).toBe(1);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expect(host.locator("picture")).toBeHidden();
    await expect(host.locator(".scene-runtime__canvas")).toBeVisible();
    await expectSingleReadyMark(page, "home-hero");
  } finally {
    await disposeFixture(models);
  }
});

test("keeps the exact Canvas, renderer, and WebGL2 context across real App Router navigation", async ({
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
  const models = await fulfillModels(page);

  try {
    await page.goto("/");
    const host = page.getByTestId("scene-runtime-host");
    await expect(host).toHaveAttribute("data-active-scene-id", "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expect(
      page.locator(
        '[data-scene-id="home-hero"] > .scene-section__poster img',
      ),
    ).toHaveAttribute("fetchpriority", "high");
    expect(assets[0]).toBe("/posters/home-hero-desktop.webp");
    await rememberRuntimeIdentity(page);
    const connectedCallsBefore = await page.evaluate(
      () =>
        window.__runtimeAcceptanceProbe?.calls.filter((call) => call.connected)
          .length ?? -1,
    );

    await page.getByRole("link", { name: "Experience", exact: true }).click();
    await expect(page).toHaveURL(/\/experience$/);
    await expect(host).toHaveAttribute(
      "data-active-scene-id",
      "experience-hero",
    );
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expectRuntimeIdentity(page);
    expect(
      await page.evaluate(
        () =>
          window.__runtimeAcceptanceProbe?.calls.filter(
            (call) => call.connected,
          ).length ?? -1,
      ),
    ).toBe(connectedCallsBefore);
    await expect(page.locator("canvas")).toHaveCount(1);
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
  } finally {
    await disposeFixture(models);
  }
});

test("keeps one renderer through live, poster-only, and live capture scenes", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page);

  try {
    const host = await openScene(page, "nasa-rocket");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await rememberRuntimeIdentity(page);

    for (const sceneId of ["eog-poster", "paycom-poster"] as const) {
      await activateNextCaptureScene(page);
      await expect(host).toHaveAttribute("data-active-scene-id", sceneId);
      await expect(host).toHaveAttribute("data-three-status", "poster");
      await expect(host.locator("picture")).toBeVisible();
      await expect(host.locator(".scene-runtime__canvas")).toBeHidden();
      await expect(page.getByTestId("scene-rotation-area")).toHaveCount(0);
      expect(
        await page.evaluate(() => {
          const identity = window.__task14Identity;
          return Boolean(
            identity && document.querySelector("canvas") === identity.canvas,
          );
        }),
      ).toBe(true);
      await expectRuntimeIdentity(page);
    }

    await activateNextCaptureScene(page);
    await expect(host).toHaveAttribute(
      "data-active-scene-id",
      "projects-hero",
    );
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expectRuntimeIdentity(page);
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
    expect(models.requested).toEqual([]);
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
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "disabled");
    await expect(host.locator("picture")).toBeVisible();
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
    const host = await openScene(page, "home-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await page.getByRole("button", { name: "3D on" }).click();
    await expect(host).toHaveAttribute("data-three-status", "disabled");
    expect(
      await page.evaluate(() =>
        localStorage.getItem("personal-site:three-enabled"),
      ),
    ).toBe("off");

    const requestCount = models.requested.length;
    await page.reload();
    await expect(host).toHaveAttribute("data-three-status", "disabled");
    await expect(host.locator("picture")).toBeVisible();
    expect(models.requested).toHaveLength(requestCount);
  } finally {
    await disposeFixture(models);
  }
});

test("keeps semantic HTML, poster, Canvas, and context through a current GLB failure and recovery", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await fulfillPosters(page);
  const models = await fulfillModels(page, [], {
    plans: { [LEAGUE_MODEL]: { kind: "http-error", status: 503 } },
  });

  try {
    const host = await openScene(page, "projects-hero");
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await rememberRuntimeIdentity(page);
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
    await expect(host).toHaveAttribute("data-active-scene-id", "league-ban");
    await expect(host).toHaveAttribute("data-three-status", "error");
    await expect(host.locator("picture")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    // Projects first attempts League speculatively; promotion retries that
    // failed preload as the current owner.
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

    const failedIdentity = await page.evaluate(() => {
      const probe = window.__runtimeAcceptanceProbe;
      return {
        calls: probe?.calls.filter((call) => call.connected).length ?? -1,
        hasCanvas: probe?.connectedCanvas === document.querySelector("canvas"),
      };
    });
    expect(failedIdentity.hasCanvas).toBe(true);
    await expectRuntimeIdentity(page);

    await activateNextCaptureScene(page);
    await expect(host).toHaveAttribute(
      "data-active-scene-id",
      "froggie-adventures",
    );
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expectRuntimeIdentity(page);
    expect(
      await page.evaluate(() => {
        const probe = window.__runtimeAcceptanceProbe;
        const debug = window.__sceneRuntimeDebug;
        return {
          calls: probe?.calls.filter((call) => call.connected).length ?? -1,
          sameCanvas:
            probe?.connectedCanvas === debug?.canvas &&
            debug?.canvas === document.querySelector("canvas"),
          sameContext: probe?.connectedContext === debug?.context,
        };
      }),
    ).toEqual({
      calls: failedIdentity.calls,
      sameCanvas: true,
      sameContext: true,
    });
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
    expect(models.requestCount(HOME_MODEL)).toBe(1);
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

test("requests only the current model until its ready frame, then one adjacent model", async ({
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
    expect(models.requested).toEqual([HOME_MODEL]);
    expect(models.pendingCount()).toBe(1);

    expect(models.release(HOME_MODEL)).toBe(1);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    await expectSingleReadyMark(page, "home-hero");
    await models.waitForRequest(EXPERIENCE_MODEL);
    expect(models.requested).toEqual([HOME_MODEL, EXPERIENCE_MODEL]);
    await expect
      .poll(() => models.pendingCount(EXPERIENCE_MODEL))
      .toBe(1);
    expect(models.requestCount(INTRO_MODEL)).toBe(0);
    const preloadOrder = await page.evaluate((nextUrl) => {
      const ready = window.__runtimeAcceptanceProbe?.events.find(
        ({ sceneId, status }) =>
          status === "ready" && sceneId === "home-hero",
      );
      const next = window.__sceneResourceDebug?.events.find(
        ({ action, url }) => action === "load-start" && url === nextUrl,
      );
      return { nextAt: next?.at ?? -1, readyAt: ready?.at ?? -1 };
    }, EXPERIENCE_MODEL);
    expect(preloadOrder.readyAt).toBeGreaterThanOrEqual(0);
    expect(preloadOrder.nextAt).toBeGreaterThanOrEqual(preloadOrder.readyAt);
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
    await rememberRuntimeIdentity(page);
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
    await expectRuntimeIdentity(page);
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
    expect(models.requestCount(EXPERIENCE_MODEL)).toBe(0);
    expect(models.release(HOME_MODEL)).toBe(0);
    await page.waitForTimeout(250);
    await expect(host).toHaveAttribute("data-three-status", "error");
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
    await expectSingleReadyMark(page, "home-hero");
  } finally {
    await disposeFixture(models);
  }
});

test("bounds rapid A-to-B-to-C ownership, promotes shared work, and disposes a late decode", async ({
  page,
}) => {
  await installRuntimeProbe(page);
  await page.addInitScript((delayedUrl: string) => {
    window.__sceneRuntimeTestHooks = {
      afterModelDecode: (url) => {
        if (url !== delayedUrl) return;
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
    expect(models.pendingCount()).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() => window.__sceneResourceDebug?.size ?? -1),
    ).toBeLessThanOrEqual(2);

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
    ).toBeLessThanOrEqual(2);
    expect(
      (await probeEvents(page, "ready")).some(
        ({ sceneId }) => sceneId === "experience-hero",
      ),
    ).toBe(false);

    expect(models.release(INTRO_MODEL)).toBe(1);
    await expect(host).toHaveAttribute("data-three-status", "ready");
    expect(models.requestCount(EXPERIENCE_MODEL)).toBe(1);
    expect(models.requestCount(INTRO_MODEL)).toBe(1);
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
    const lost = await page.evaluate(() => {
      const probe = window.__runtimeAcceptanceProbe;
      const context = probe?.connectedContext;
      const canvas = probe?.connectedCanvas;
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
          window.__runtimeAcceptanceProbe?.connectedContext?.isContextLost() ??
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
