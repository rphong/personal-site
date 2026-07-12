import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  PERFORMANCE_BUDGETS,
  calculateCumulativeLayoutShift,
  calculateTotalBlockingTime,
  type LayoutShiftSample,
  type LongTaskSample,
} from "./performance-metrics";

const HOME_MODEL = "/models/crane.glb";

interface LcpSample {
  readonly className: string;
  readonly id: string;
  readonly startTime: number;
  readonly tagName: string;
  readonly text: string;
  readonly url: string;
}

interface ContextRequestSample {
  readonly actualAlpha: boolean | null;
  readonly actualAntialias: boolean | null;
  readonly requestedAlpha: boolean | null;
  readonly requestedAntialias: boolean | null;
  readonly requestedAt: number;
  readonly requestedPowerPreference: string | null;
}

interface InteractionSample {
  readonly durationMs: number;
  readonly frameAfter: number;
  readonly frameBefore: number;
  readonly pointerType: string;
  readonly trusted: boolean;
}

interface ProductionPerformanceProbe {
  readonly contextRequests: ContextRequestSample[];
  readonly largestContentfulPaint: LcpSample[];
  readonly layoutShifts: LayoutShiftSample[];
  readonly longTasks: LongTaskSample[];
  readonly observers: PerformanceObserver[];
  readonly supportedEntryTypes: string[];
  homeDecodeHeldAt: number | null;
  homeDecodeReleasedAt: number | null;
  interaction: InteractionSample | null;
}

declare global {
  interface Window {
    __productionPerformanceProbe?: ProductionPerformanceProbe;
    __task17HomeDecodeHeld?: boolean;
    __task17ReleaseHomeDecode?: () => void;
  }
}

interface DeviceProfile {
  readonly context: BrowserContextOptions;
  readonly name: "desktop" | "mobile";
  readonly touch: boolean;
}

const profiles: readonly DeviceProfile[] = [
  {
    name: "desktop",
    touch: false,
    context: {
      colorScheme: "light",
      deviceScaleFactor: 1,
      viewport: { width: 1_440, height: 900 },
    },
  },
  {
    name: "mobile",
    touch: true,
    context: {
      colorScheme: "light",
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    },
  },
];

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-production",
    "Run this suite through playwright.performance.config.ts",
  );
});

async function createContext(
  browser: Browser,
  testInfo: TestInfo,
  profile: DeviceProfile,
  saveData: boolean,
): Promise<BrowserContext> {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("The performance config must provide a baseURL");
  }
  return browser.newContext({
    ...profile.context,
    baseURL,
    extraHTTPHeaders: saveData ? { "Save-Data": "on" } : undefined,
  });
}

async function installPerformanceProbe(
  page: Page,
  {
    holdHomeDecode,
    saveData,
  }: {
    readonly holdHomeDecode: boolean;
    readonly saveData: boolean;
  },
): Promise<void> {
  await page.addInitScript(
    ({ shouldHoldHomeDecode, shouldSaveData }) => {
      if (shouldSaveData) {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: { saveData: true },
        });
      }

      window.__enableSceneRuntimeDebug = true;
      const probe: ProductionPerformanceProbe = {
        contextRequests: [],
        homeDecodeHeldAt: null,
        homeDecodeReleasedAt: null,
        interaction: null,
        largestContentfulPaint: [],
        layoutShifts: [],
        longTasks: [],
        observers: [],
        supportedEntryTypes: [
          ...PerformanceObserver.supportedEntryTypes,
        ],
      };
      window.__productionPerformanceProbe = probe;

      const observe = (
        type: string,
        accept: (entries: readonly PerformanceEntry[]) => void,
      ) => {
        if (!probe.supportedEntryTypes.includes(type)) return;
        const observer = new PerformanceObserver((list) => {
          accept(list.getEntries());
        });
        observer.observe({ buffered: true, type });
        probe.observers.push(observer);
      };

      observe("largest-contentful-paint", (entries) => {
        for (const entry of entries) {
          const candidate = entry as PerformanceEntry & {
            readonly element?: Element | null;
            readonly url?: string;
          };
          const element = candidate.element ?? null;
          const className =
            typeof element?.className === "string" ? element.className : "";
          const imageUrl =
            candidate.url ||
            (element instanceof HTMLImageElement ? element.currentSrc : "");
          probe.largestContentfulPaint.push({
            className,
            id: element?.id ?? "",
            startTime: entry.startTime,
            tagName: element?.tagName ?? "",
            text: element?.textContent?.trim().slice(0, 160) ?? "",
            url: imageUrl,
          });
        }
      });

      observe("layout-shift", (entries) => {
        for (const entry of entries) {
          const shift = entry as PerformanceEntry & {
            readonly hadRecentInput?: boolean;
            readonly value?: number;
          };
          probe.layoutShifts.push({
            hadRecentInput: shift.hadRecentInput ?? false,
            startTime: entry.startTime,
            value: shift.value ?? 0,
          });
        }
      });

      observe("longtask", (entries) => {
        for (const entry of entries) {
          probe.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });

      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...arguments_: unknown[]
      ) {
        const requestedAt = performance.now();
        const context = Reflect.apply(originalGetContext, this, [
          kind,
          ...arguments_,
        ]) as RenderingContext | null;
        if (kind === "webgl2" && this.isConnected && context) {
          const options =
            arguments_[0] && typeof arguments_[0] === "object"
              ? (arguments_[0] as Record<string, unknown>)
              : {};
          const attributes = (
            context as WebGL2RenderingContext
          ).getContextAttributes();
          probe.contextRequests.push({
            actualAlpha: attributes?.alpha ?? null,
            actualAntialias: attributes?.antialias ?? null,
            requestedAlpha:
              typeof options.alpha === "boolean" ? options.alpha : null,
            requestedAntialias:
              typeof options.antialias === "boolean"
                ? options.antialias
                : null,
            requestedAt,
            requestedPowerPreference:
              typeof options.powerPreference === "string"
                ? options.powerPreference
                : null,
          });
        }
        return context;
      } as typeof originalGetContext;

      if (shouldHoldHomeDecode) {
        window.__sceneRuntimeTestHooks = {
          afterModelDecode: (url) => {
            if (
              !url.endsWith("/models/crane.glb") ||
              window.__task17HomeDecodeHeld
            ) {
              return;
            }
            window.__task17HomeDecodeHeld = true;
            probe.homeDecodeHeldAt = performance.now();
            return new Promise<void>((resolve) => {
              window.__task17ReleaseHomeDecode = resolve;
            });
          },
        };
      }
    },
    {
      shouldHoldHomeDecode: holdHomeDecode,
      shouldSaveData: saveData,
    },
  );
}

async function waitForLcp(page: Page): Promise<LcpSample> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__productionPerformanceProbe?.largestContentfulPaint.length ??
          0,
      ),
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(100);
  const lcp = await page.evaluate(
    () =>
      window.__productionPerformanceProbe?.largestContentfulPaint.at(-1) ??
      null,
  );
  if (!lcp) throw new Error("Largest Contentful Paint was not observed");
  return lcp;
}

function expectGoodLcp(lcp: LcpSample, releasedAt?: number | null): void {
  const isPoster =
    lcp.url.includes("/posters/") && lcp.url.endsWith(".webp");
  const isMeaningfulText = lcp.text.length > 0;
  expect(lcp.startTime).toBeLessThanOrEqual(
    PERFORMANCE_BUDGETS.largestContentfulPaintMs,
  );
  expect(lcp.tagName).not.toBe("CANVAS");
  expect(isPoster || isMeaningfulText).toBe(true);
  if (releasedAt !== undefined && releasedAt !== null) {
    expect(lcp.startTime).toBeLessThanOrEqual(releasedAt);
  }
}

async function releaseHomeDecode(page: Page): Promise<number> {
  const releasedAt = await page.evaluate(() => {
    const release = window.__task17ReleaseHomeDecode;
    const probe = window.__productionPerformanceProbe;
    if (!release || !probe) return null;
    const at = performance.now();
    probe.homeDecodeReleasedAt = at;
    delete window.__task17ReleaseHomeDecode;
    release();
    return at;
  });
  if (releasedAt === null) {
    throw new Error("The decoded home model was not held");
  }
  return releasedAt;
}

async function navigateTo(
  page: Page,
  label: "Experience" | "Projects",
  path: "/experience" | "/projects",
  sceneId: "experience-hero" | "projects-hero",
  status: "disabled" | "ready",
): Promise<void> {
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { exact: true, name: label })
    .click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  const host = page.getByTestId("scene-runtime-host");
  await expect(host).toHaveAttribute("data-active-scene-id", sceneId);
  await expect(host).toHaveAttribute("data-three-status", status);
}

async function snapshotProbe(page: Page) {
  return page.evaluate(() => {
    const probe = window.__productionPerformanceProbe;
    if (!probe) throw new Error("Production performance probe is unavailable");
    return {
      contextRequests: [...probe.contextRequests],
      homeDecodeHeldAt: probe.homeDecodeHeldAt,
      homeDecodeReleasedAt: probe.homeDecodeReleasedAt,
      interaction: probe.interaction,
      largestContentfulPaint: [...probe.largestContentfulPaint],
      layoutShifts: [...probe.layoutShifts],
      longTasks: [...probe.longTasks],
      supportedEntryTypes: [...probe.supportedEntryTypes],
    };
  });
}

async function snapshotRenderer(page: Page) {
  return page.evaluate(() => {
    const debug = window.__sceneRuntimeDebug;
    if (!debug) throw new Error("Scene runtime debug port is unavailable");
    const attributes = debug.context.getContextAttributes();
    return {
      actualAlpha: attributes?.alpha ?? null,
      actualAntialias: attributes?.antialias ?? null,
      bufferHeight: debug.canvas.height,
      bufferWidth: debug.canvas.width,
      cssHeight: debug.canvas.clientHeight,
      cssWidth: debug.canvas.clientWidth,
      devicePixelRatio: window.devicePixelRatio,
      frame: debug.renderer.info.render.frame,
      pixelRatio: debug.renderer.getPixelRatio(),
      sceneId: debug.sceneId,
    };
  });
}

async function waitForSettledIdle(page: Page) {
  let stableFrame: number | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const before = await page.evaluate(() => {
      const debug = window.__sceneRuntimeDebug;
      if (!debug) throw new Error("Scene runtime debug port is unavailable");
      return debug.renderer.info.render.frame;
    });
    await page.waitForTimeout(200);
    const after = await page.evaluate(
      () => window.__sceneRuntimeDebug?.renderer.info.render.frame ?? -1,
    );
    if (before === after) {
      stableFrame = after;
      break;
    }
  }
  if (stableFrame === null) {
    throw new Error("Renderer did not reach a settled demand-loop state");
  }

  const before = stableFrame;
  await page.waitForTimeout(PERFORMANCE_BUDGETS.settledIdleWindowMs);
  const after = await page.evaluate(
    () => window.__sceneRuntimeDebug?.renderer.info.render.frame ?? -1,
  );
  return { after, before, durationMs: PERFORMANCE_BUDGETS.settledIdleWindowMs };
}

async function armTrustedDrag(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__sceneRuntimeDebug;
    const probe = window.__productionPerformanceProbe;
    if (!debug || !probe) {
      throw new Error("Runtime performance ports are unavailable");
    }
    const frameBefore = debug.renderer.info.render.frame;
    probe.interaction = null;

    const onPointerMove = (event: PointerEvent) => {
      if (
        !event.isTrusted ||
        !event.isPrimary ||
        (event.pointerType !== "touch" && event.buttons !== 1)
      ) {
        return;
      }
      document.removeEventListener("pointermove", onPointerMove, true);
      const startedAt = event.timeStamp;
      const waitForRenderedFrame = () => {
        const frameAfter = debug.renderer.info.render.frame;
        if (frameAfter <= frameBefore) {
          window.requestAnimationFrame(waitForRenderedFrame);
          return;
        }
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            probe.interaction = {
              durationMs: performance.now() - startedAt,
              frameAfter: debug.renderer.info.render.frame,
              frameBefore,
              pointerType: event.pointerType,
              trusted: event.isTrusted,
            };
          });
        });
      };
      window.requestAnimationFrame(waitForRenderedFrame);
    };
    document.addEventListener("pointermove", onPointerMove, true);
  });
}

async function performTrustedDrag(
  context: BrowserContext,
  page: Page,
  touch: boolean,
): Promise<InteractionSample> {
  const area = page.getByTestId("scene-rotation-area");
  const box = await area.boundingBox();
  if (!box) throw new Error("Rotation area has no browser bounds");
  const center = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  await armTrustedDrag(page);

  if (touch) {
    const session = await context.newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: 1, x: center.x - 50, y: center.y }],
        type: "touchStart",
      });
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: 1, x: center.x + 50, y: center.y }],
        type: "touchMove",
      });
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type: "touchEnd",
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(center.x - 50, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 50, center.y);
    await page.mouse.up();
  }

  await expect
    .poll(() =>
      page.evaluate(
        () => window.__productionPerformanceProbe?.interaction ?? null,
      ),
    )
    .not.toBeNull();
  const interaction = await page.evaluate(
    () => window.__productionPerformanceProbe?.interaction ?? null,
  );
  if (!interaction) throw new Error("Trusted drag was not measured");
  return interaction;
}

async function attachMetrics(
  testInfo: TestInfo,
  name: string,
  metrics: object,
): Promise<void> {
  const serialized = JSON.stringify(metrics, null, 2);
  console.info(`[performance] ${name} ${JSON.stringify(metrics)}`);
  await testInfo.attach(`${name}.json`, {
    body: Buffer.from(serialized),
    contentType: "application/json",
  });
}

for (const profile of profiles) {
  test(`${profile.name} production path meets the 3D performance contract`, async ({
    browser,
  }, testInfo) => {
    const context = await createContext(browser, testInfo, profile, false);
    const page = await context.newPage();
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith(".glb")) modelRequests.push(pathname);
    });

    try {
      await installPerformanceProbe(page, {
        holdHomeDecode: true,
        saveData: false,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const host = page.getByTestId("scene-runtime-host");
      await expect(host).toHaveAttribute("data-active-scene-id", "home-hero");
      await expect
        .poll(() => page.evaluate(() => window.__task17HomeDecodeHeld ?? false))
        .toBe(true);
      await expect(host).toHaveAttribute("data-three-status", "loading");
      await expect(host.locator("picture")).toBeVisible();

      // Ensure the poster has become an LCP candidate while the decoded model
      // is still held. The first trusted route click below finalizes LCP; only
      // that final latest entry is used for the budget.
      await waitForLcp(page);
      const releasedAt = await releaseHomeDecode(page);
      await expect(host).toHaveAttribute("data-three-status", "ready");
      await expect(host.locator("picture")).toBeHidden();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.__sceneResourceDebug?.events.filter(
                ({ action, url }) =>
                  action === "load-resolved" &&
                  url?.endsWith("/models/crane.glb"),
              ).length ?? 0,
          ),
        )
        .toBe(1);

      await page.waitForTimeout(100);
      const initialProbe = await snapshotProbe(page);
      const renderer = await snapshotRenderer(page);
      const routeShiftStart = initialProbe.layoutShifts.length;

      await navigateTo(
        page,
        "Experience",
        "/experience",
        "experience-hero",
        "ready",
      );
      const lcp = await waitForLcp(page);
      expectGoodLcp(lcp, releasedAt);
      await navigateTo(
        page,
        "Projects",
        "/projects",
        "projects-hero",
        "ready",
      );
      await page.waitForTimeout(250);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(100);
      const afterRoutes = await snapshotProbe(page);
      const routeShifts = afterRoutes.layoutShifts.slice(routeShiftStart);
      const rawRouteShift = routeShifts.reduce(
        (total, shift) => total + shift.value,
        0,
      );
      const idle = await waitForSettledIdle(page);
      const interaction = await performTrustedDrag(
        context,
        page,
        profile.touch,
      );
      await page.waitForTimeout(100);
      const finalProbe = await snapshotProbe(page);
      expect(finalProbe.largestContentfulPaint.at(-1)).toEqual(lcp);

      const readyMark = await page.evaluate(() => {
        const mark = performance.getEntriesByName("scene-ready:home-hero")[0];
        return mark?.startTime ?? null;
      });
      if (readyMark === null) throw new Error("Home ready mark is unavailable");
      const contextRequest = initialProbe.contextRequests[0];
      if (!contextRequest) {
        throw new Error("Connected WebGL2 context request was not observed");
      }
      const resourceEvents = await page.evaluate(
        () => window.__sceneResourceDebug?.events ?? [],
      );
      const homeLoadResolved = resourceEvents.find(
        ({ action, url }) =>
          action === "load-resolved" && url?.endsWith("/models/crane.glb"),
      );
      if (!homeLoadResolved) {
        throw new Error("The real home GLB did not finish Meshopt decoding");
      }
      const windowLongTasks = finalProbe.longTasks.filter(
        ({ duration, startTime }) =>
          startTime + duration > contextRequest.requestedAt &&
          startTime < readyMark,
      );
      const totalBlockingTime = calculateTotalBlockingTime(
        windowLongTasks,
        { endTime: readyMark, startTime: contextRequest.requestedAt },
      );
      const longestTask = Math.max(
        0,
        ...windowLongTasks.map(({ duration }) => duration),
      );
      const cumulativeLayoutShift = calculateCumulativeLayoutShift(
        finalProbe.layoutShifts,
      );
      const metrics = {
        cumulativeLayoutShift,
        idle,
        interaction,
        largestContentfulPaint: lcp,
        longTasks: {
          entries: windowLongTasks,
          longestTask,
          totalBlockingTime,
          window: {
            end: readyMark,
            modelDecodedAt: homeLoadResolved.at,
            start: contextRequest.requestedAt,
          },
        },
        mode: "3d-enabled",
        modelRequests,
        posterHandoff: {
          decodedAndHeldAt: finalProbe.homeDecodeHeldAt,
          lcpAt: lcp.startTime,
          releasedAt: finalProbe.homeDecodeReleasedAt,
        },
        profile: profile.name,
        rawRouteShift,
        renderer: {
          ...renderer,
          requestedContext: contextRequest,
        },
        supportedEntryTypes: finalProbe.supportedEntryTypes,
      };
      await attachMetrics(testInfo, `${profile.name}-3d-enabled`, metrics);

      expect(finalProbe.supportedEntryTypes).toEqual(
        expect.arrayContaining([
          "largest-contentful-paint",
          "layout-shift",
          "longtask",
        ]),
      );
      expect(modelRequests).toContain(HOME_MODEL);
      expect(contextRequest.requestedAntialias).toBe(true);
      expect(contextRequest.requestedPowerPreference).toBe("high-performance");
      expect(contextRequest.actualAntialias).toBe(renderer.actualAntialias);
      expect(contextRequest.actualAlpha).toBe(renderer.actualAlpha);
      expect(homeLoadResolved.at).toBeGreaterThanOrEqual(
        contextRequest.requestedAt,
      );
      expect(homeLoadResolved.at).toBeLessThanOrEqual(readyMark);
      expect(totalBlockingTime).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.totalBlockingTimeMs,
      );
      expect(longestTask).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.longestTaskMs,
      );
      expect(cumulativeLayoutShift).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.cumulativeLayoutShift,
      );
      expect(rawRouteShift).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.cumulativeLayoutShift,
      );
      expect(idle.after).toBe(idle.before);
      expect(interaction.trusted).toBe(true);
      expect(interaction.frameAfter).toBeGreaterThan(interaction.frameBefore);
      expect(interaction.durationMs).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.interactionToNextPaintMs,
      );
      expect(renderer.pixelRatio).toBe(
        Math.min(renderer.devicePixelRatio, 1.5),
      );
      expect(
        Math.abs(
          renderer.bufferWidth - renderer.cssWidth * renderer.pixelRatio,
        ),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          renderer.bufferHeight - renderer.cssHeight * renderer.pixelRatio,
        ),
      ).toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  });

  test(`${profile.name} Save-Data path preserves Web Vitals without WebGL work`, async ({
    browser,
  }, testInfo) => {
    const context = await createContext(browser, testInfo, profile, true);
    const page = await context.newPage();
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith(".glb")) modelRequests.push(pathname);
    });

    try {
      await installPerformanceProbe(page, {
        holdHomeDecode: false,
        saveData: true,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const host = page.getByTestId("scene-runtime-host");
      await expect(host).toHaveAttribute("data-active-scene-id", "home-hero");
      await expect(host).toHaveAttribute("data-three-status", "disabled");
      await expect(host.locator("picture")).toBeVisible();
      // Wait for an initial candidate before trusted navigation finalizes LCP.
      await waitForLcp(page);
      const initialProbe = await snapshotProbe(page);
      const routeShiftStart = initialProbe.layoutShifts.length;

      await navigateTo(
        page,
        "Experience",
        "/experience",
        "experience-hero",
        "disabled",
      );
      const lcp = await waitForLcp(page);
      expectGoodLcp(lcp);
      await navigateTo(
        page,
        "Projects",
        "/projects",
        "projects-hero",
        "disabled",
      );
      await page.waitForTimeout(100);
      const finalProbe = await snapshotProbe(page);
      expect(finalProbe.largestContentfulPaint.at(-1)).toEqual(lcp);
      const rawRouteShift = finalProbe.layoutShifts
        .slice(routeShiftStart)
        .reduce((total, shift) => total + shift.value, 0);
      const cumulativeLayoutShift = calculateCumulativeLayoutShift(
        finalProbe.layoutShifts,
      );
      const browserState = await page.evaluate(() => ({
        canvasCount: document.querySelectorAll("canvas").length,
        devicePixelRatio: window.devicePixelRatio,
        storedPreference: localStorage.getItem(
          "personal-site:three-enabled",
        ),
      }));
      const metrics = {
        browser: browserState,
        connectedContextRequests: finalProbe.contextRequests,
        cumulativeLayoutShift,
        largestContentfulPaint: lcp,
        mode: "save-data",
        modelRequests,
        profile: profile.name,
        rawRouteShift,
        supportedEntryTypes: finalProbe.supportedEntryTypes,
      };
      await attachMetrics(testInfo, `${profile.name}-save-data`, metrics);

      expect(finalProbe.supportedEntryTypes).toEqual(
        expect.arrayContaining([
          "largest-contentful-paint",
          "layout-shift",
          "longtask",
        ]),
      );
      expect(modelRequests).toEqual([]);
      expect(finalProbe.contextRequests).toEqual([]);
      expect(browserState.canvasCount).toBe(0);
      expect(browserState.storedPreference).toBeNull();
      expect(cumulativeLayoutShift).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.cumulativeLayoutShift,
      );
      expect(rawRouteShift).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.cumulativeLayoutShift,
      );
    } finally {
      await context.close();
    }
  });
}
