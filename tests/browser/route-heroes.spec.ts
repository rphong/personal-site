import { expect, test, type Page, type TestInfo } from "@playwright/test";

const routes = [
  {
    path: "/",
    sceneId: "home-hero",
    title: "Richard Phong",
    backgroundColor: "rgb(158, 204, 192)",
    copyTopRatio: { desktop: 0.645, mobile: 0.63 },
    headingColor: "rgb(255, 255, 255)",
    headingSize: { desktop: 255.994, mobile: 89.7 },
  },
  {
    path: "/experience",
    sceneId: "experience-hero",
    title: "Experience",
    backgroundColor: "rgb(223, 169, 181)",
    copyTopRatio: { desktop: 0.365, mobile: 0.11 },
    headingColor: "rgb(251, 229, 234)",
    headingSize: { desktop: 353.28, mobile: 79.95 },
  },
  {
    path: "/projects",
    sceneId: "projects-hero",
    title: "Projects",
    backgroundColor: "rgb(175, 212, 225)",
    copyTopRatio: { desktop: 0.35, mobile: 0.11 },
    headingColor: "rgb(237, 247, 251)",
    headingSize: { desktop: 393.6, mobile: 87.75 },
  },
  {
    path: "/contact",
    sceneId: "contact-hero",
    title: "Contact",
    backgroundColor: "rgb(201, 186, 228)",
    copyTopRatio: { desktop: 0.395, mobile: 0.4 },
    headingColor: "rgb(237, 230, 250)",
    headingSize: { desktop: 320, mobile: 66.3 },
  },
] as const;

interface RouteStyleFrame {
  readonly copyTop: number;
  readonly frame: number;
  readonly headingColor: string;
  readonly headingSize: number;
  readonly heroHeight: number;
  readonly pathname: string;
  readonly sceneId: string;
  readonly shellBackground: string;
  readonly shellRoute: string;
  readonly title: string;
  readonly transitionDurations: {
    readonly copy: string;
    readonly heading: string;
    readonly shell: string;
  };
  readonly z: {
    readonly copy: string;
    readonly cue: string;
    readonly outerPoster: string;
    readonly runtime: string | null;
    readonly stage: string | null;
  };
}

type RouteStyleAuditWindow = Window & {
  __routeStyleFrames?: RouteStyleFrame[];
};

async function installRouteStyleFrameAudit(page: Page) {
  await page.addInitScript(() => {
    const auditWindow = window as RouteStyleAuditWindow;
    auditWindow.__routeStyleFrames = [];
    let frame = 0;

    const sample = () => {
      frame += 1;
      const shell = document.querySelector<HTMLElement>(".site-shell");
      const hero = document.querySelector<HTMLElement>(".page-hero");
      const heading = hero?.querySelector<HTMLElement>("h1");
      const copy =
        hero?.querySelector<HTMLElement>(".page-hero__copy") ?? null;
      const outerPoster =
        hero?.querySelector<HTMLElement>(
          ":scope > .scene-section__poster",
        ) ?? null;
      const stage =
        hero?.querySelector<HTMLElement>(
          ":scope > [data-scene-resident-stage]",
        ) ?? null;
      const runtime =
        stage?.querySelector<HTMLElement>("[data-three-status]") ?? null;
      const cue = hero?.querySelector<HTMLElement>(".scroll-cue") ?? null;

      if (shell && hero && heading && copy && outerPoster && cue) {
        const copyStyle = getComputedStyle(copy);
        const headingStyle = getComputedStyle(heading);
        const shellStyle = getComputedStyle(shell);
        auditWindow.__routeStyleFrames?.push({
          copyTop: Number.parseFloat(copyStyle.top),
          frame,
          headingColor: headingStyle.color,
          headingSize: Number.parseFloat(headingStyle.fontSize),
          heroHeight: hero.getBoundingClientRect().height,
          pathname: window.location.pathname,
          sceneId: hero.dataset.sceneId ?? "",
          shellBackground: shellStyle.backgroundColor,
          shellRoute: shell.dataset.route ?? "",
          title: heading.textContent?.trim() ?? "",
          transitionDurations: {
            copy: copyStyle.transitionDuration,
            heading: headingStyle.transitionDuration,
            shell: shellStyle.transitionDuration,
          },
          z: {
            copy: copyStyle.zIndex,
            cue: getComputedStyle(cue).zIndex,
            outerPoster: getComputedStyle(outerPoster).zIndex,
            runtime: runtime ? getComputedStyle(runtime).zIndex : null,
            stage: stage ? getComputedStyle(stage).zIndex : null,
          },
        });
      }

      requestAnimationFrame(sample);
    };

    requestAnimationFrame(sample);
  });
}

interface AlphaComparison {
  readonly center: {
    readonly x: number;
    readonly y: number;
  };
  readonly edge: {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  };
  readonly maxAbsCenter: number;
  readonly maxAbsEdge: number;
}

interface AlphaCaptureTrace {
  readonly adoptionValidation: {
    readonly fields: Record<string, boolean>;
    readonly valid: boolean;
  };
  readonly adoptionVersion: number;
  readonly captureIndex: number;
  readonly copy: {
    readonly allocated: boolean;
    readonly bindingsRestored: boolean;
    readonly blitDurationMs: number;
    readonly bufferBytes: number;
    readonly durationMs: number;
    readonly geometrySnapshotMs: number;
    readonly setupMs: number;
    readonly synchronousCaptureMs: number;
  };
  readonly deferred: {
    readonly animationFrameAt: number;
    readonly readDelayMs: number;
    readonly taskAt: number;
  };
  readonly liveSilhouette: {
    readonly alphaPixels: number;
    readonly viewportBounds: {
      readonly bottom: number;
      readonly centerX: number;
      readonly centerY: number;
      readonly left: number;
      readonly right: number;
      readonly top: number;
    } | null;
  };
  readonly posterComparisons: {
    readonly outer: AlphaComparison | null;
    readonly runtime: AlphaComparison | null;
  };
  readonly read: {
    readonly bindingsRestored: boolean;
  };
  readonly resourcesAfterRead: {
    readonly idleTargets: number;
    readonly targetRetained: boolean;
    readonly targets: number;
  };
  readonly renderReason: string;
  readonly residentKey: string | null;
  readonly sceneId: string;
}

async function alphaCapturesFor(
  page: Page,
  sceneId: string,
  adoptionVersion: number,
  residentKey: string,
) {
  return page.evaluate(
    ({
      expectedAdoptionVersion,
      expectedResidentKey,
      expectedSceneId,
    }) =>
      (window.__sceneRuntimeTrace ?? [])
        .filter(
          (entry) =>
            entry.phase === "canvas:alpha-silhouette" &&
            entry.details.sceneId === expectedSceneId &&
            entry.details.adoptionVersion === expectedAdoptionVersion &&
            entry.details.residentKey === expectedResidentKey,
        )
        .map((entry) => entry.details as unknown as AlphaCaptureTrace)
        .sort((left, right) => left.captureIndex - right.captureIndex),
    {
      expectedAdoptionVersion: adoptionVersion,
      expectedResidentKey: residentKey,
      expectedSceneId: sceneId,
    },
  );
}

async function expectAlphaSilhouettesAligned(
  page: Page,
  hero: ReturnType<Page["locator"]>,
  sceneId: string,
) {
  const stage = hero.locator(":scope > [data-scene-resident-stage]");
  await expect(stage).toHaveAttribute(
    "data-scene-adoption-version",
    /^\d+$/,
  );
  const adoptionVersion = Number(
    await stage.getAttribute("data-scene-adoption-version"),
  );
  const residentKey = await stage.getAttribute("data-scene-pool-key");
  expect(residentKey).toMatch(/^resident-stage-\d+$/);
  if (!residentKey) return;

  await expect
    .poll(
      async () => {
        const captures = await alphaCapturesFor(
          page,
          sceneId,
          adoptionVersion,
          residentKey,
        );
        return captures.filter(
          (capture) =>
            capture.posterComparisons.outer !== null &&
            capture.posterComparisons.runtime !== null,
        ).length;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(2);

  const captures = await alphaCapturesFor(
    page,
    sceneId,
    adoptionVersion,
    residentKey,
  );
  expect(captures[0]?.captureIndex).toBe(1);
  expect(captures[0]?.renderReason).toBe("adoption-layout");

  const firstBounds = captures[0]?.liveSilhouette.viewportBounds;
  expect(firstBounds).not.toBeNull();
  if (!firstBounds) return;

  for (const capture of captures.slice(0, 3)) {
    expect(capture.adoptionValidation.valid).toBe(true);
    expect(
      Object.values(capture.adoptionValidation.fields).every(Boolean),
    ).toBe(true);
    expect(capture.liveSilhouette.alphaPixels).toBeGreaterThan(0);
    expect(capture.copy.bindingsRestored).toBe(true);
    expect(capture.copy.blitDurationMs).toBeGreaterThanOrEqual(0);
    expect(capture.copy.bufferBytes).toBeGreaterThan(0);
    expect(capture.copy.durationMs).toBeGreaterThanOrEqual(
      capture.copy.blitDurationMs,
    );
    expect(capture.copy.geometrySnapshotMs).toBeGreaterThanOrEqual(0);
    expect(capture.copy.setupMs).toBeGreaterThanOrEqual(0);
    expect(capture.copy.synchronousCaptureMs).toBeGreaterThanOrEqual(
      capture.copy.durationMs,
    );
    expect(capture.copy.synchronousCaptureMs).toBeGreaterThanOrEqual(
      capture.copy.setupMs,
    );
    expect(capture.read.bindingsRestored).toBe(true);
    expect(capture.deferred.readDelayMs).toBeGreaterThan(0);
    expect(capture.deferred.taskAt).toBeGreaterThanOrEqual(
      capture.deferred.animationFrameAt,
    );

    const liveBounds = capture.liveSilhouette.viewportBounds;
    expect(liveBounds).not.toBeNull();
    if (!liveBounds) continue;

    for (const comparison of [
      capture.posterComparisons.outer,
      capture.posterComparisons.runtime,
    ]) {
      expect(comparison).not.toBeNull();
      if (!comparison) continue;
      expect(comparison.maxAbsCenter).toBeLessThanOrEqual(2);
      expect(comparison.maxAbsEdge).toBeLessThanOrEqual(2);
      for (const delta of Object.values(comparison.center)) {
        expect(Math.abs(delta)).toBeLessThanOrEqual(2);
      }
      for (const delta of Object.values(comparison.edge)) {
        expect(Math.abs(delta)).toBeLessThanOrEqual(2);
      }
    }

    for (const edge of [
      "bottom",
      "left",
      "right",
      "top",
    ] as const) {
      expect(
        Math.abs(liveBounds[edge] - firstBounds[edge]),
      ).toBeLessThanOrEqual(2);
    }
    expect(
      Math.abs(liveBounds.centerX - firstBounds.centerX),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(liveBounds.centerY - firstBounds.centerY),
    ).toBeLessThanOrEqual(2);
  }
  expect(captures.slice(0, 3).some(({ copy }) => copy.allocated)).toBe(true);
  const completedCapture = captures.find(
    ({ captureIndex }) => captureIndex === 3,
  );
  if (completedCapture) {
    expect(completedCapture.resourcesAfterRead.targetRetained).toBe(false);
    expect(completedCapture.resourcesAfterRead.idleTargets).toBe(0);
    expect(completedCapture.resourcesAfterRead.targets).toBe(0);
  }
}

async function verifyRouteHero(
  page: Page,
  route: (typeof routes)[number],
  variant: "desktop" | "mobile",
  testInfo: TestInfo,
  navigation: "document" | "client",
  visitIndex: number,
) {
  if (navigation === "document") {
    await page.goto(route.path);
  } else {
    const label = route.path === "/" ? "Home" : route.title;
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { exact: true, name: label })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.location.pathname))
      .toBe(route.path);
  }

  const hero = page.locator(`[data-scene-id="${route.sceneId}"]`);
  const title = hero.getByRole("heading", { level: 1, name: route.title });
  const cue = hero.getByRole("link", { name: "Scroll to page content" });
  const runtime = hero.locator("[data-scene-runtime-host]");

  await expect(hero).toHaveClass(/page-hero--layered/);
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS("color", route.headingColor);
  await expect
    .poll(() =>
      title.evaluate(
        (element) => getComputedStyle(element).webkitTextStrokeWidth,
      ),
    )
    .toBe("0px");
  await expect(cue).toBeVisible();
  await expect(cue).toHaveAttribute("href", "#page-content");
  await expect(hero.locator(".eyebrow, .page-hero__summary")).toHaveCount(0);
  await expect(runtime).toHaveAttribute("data-three-status", "ready", {
    timeout: 20_000,
  });
  await expect(runtime.locator(".scene-runtime__canvas")).toBeVisible();
  await expectAlphaSilhouettesAligned(page, hero, route.sceneId);

  const stacking = await hero.evaluate((element) => {
    const children = Array.from(element.children);
    const outerPoster = element.querySelector(
      ":scope > .scene-section__poster",
    )!;
    const stage = element.querySelector(
      ":scope > .scene-stage--resident",
    )!;
    return {
      cue: getComputedStyle(element.querySelector(".scroll-cue")!).zIndex,
      outerPoster: getComputedStyle(outerPoster).zIndex,
      outerPosterBeforeStage:
        children.indexOf(outerPoster) < children.indexOf(stage),
      runtime: getComputedStyle(
        element.querySelector("[data-scene-runtime-host]")!,
      ).zIndex,
      stage: getComputedStyle(stage).zIndex,
      title: getComputedStyle(
        element.querySelector(".page-hero__copy")!,
      ).zIndex,
    };
  });
  expect(stacking).toEqual({
    cue: "2",
    outerPoster: "1",
    outerPosterBeforeStage: true,
    runtime: "1",
    stage: "1",
    title: "0",
  });

  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(
      `${route.sceneId}-${variant}-${visitIndex}-live.png`,
    ),
  });

  await page.getByRole("button", { name: "3D on" }).click();
  await expect(page.getByRole("button", { name: "3D off" })).toBeVisible();
  await expect(runtime).toHaveAttribute("data-three-status", "disabled");
  await expect(runtime.locator(".scene-runtime__poster")).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(
      `${route.sceneId}-${variant}-${visitIndex}-poster.png`,
    ),
  });

  await page.getByRole("button", { name: "3D off" }).click();
}

for (const variant of ["desktop", "mobile"] as const) {
  test(`all route heroes preserve layering in ${variant} live and poster modes`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      deviceScaleFactor: variant === "mobile" ? 1.5 : 1,
      reducedMotion: "reduce",
      viewport:
        variant === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__enableSceneRuntimeTrace = true;
    });

    const routeSequence = [...routes, routes[0]];
    for (const [index, route] of routeSequence.entries()) {
      await verifyRouteHero(
        page,
        route,
        variant,
        testInfo,
        index === 0 ? "document" : "client",
        index + 1,
      );
    }

    await context.close();
  });

  test(`applies every client-route hero style by the first coherent ${variant} frame`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport:
        variant === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await installRouteStyleFrameAudit(page);
    await page.goto("/");
    await expect(page.locator('[data-scene-id="home-hero"]')).toBeVisible();

    for (const route of [...routes.slice(1), routes[0]]) {
      const frameStart = await page.evaluate(
        () =>
          (window as RouteStyleAuditWindow).__routeStyleFrames?.length ??
          0,
      );
      const label = route.path === "/" ? "Home" : route.title;
      await page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { exact: true, name: label })
        .click();
      await expect(page.locator(".site-shell")).toHaveAttribute(
        "data-route",
        route.path === "/" ? "home" : route.path.slice(1),
      );
      await expect(
        page.locator(`[data-scene-id="${route.sceneId}"]`),
      ).toBeVisible();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          }),
      );

      const frames = await page.evaluate(
        (start) =>
          (
            (window as RouteStyleAuditWindow).__routeStyleFrames ?? []
          ).slice(start),
        frameStart,
      );
      const shellRoute =
        route.path === "/" ? "home" : route.path.slice(1);
      const coherentFrames = frames.filter(
        (frame) =>
          frame.pathname === route.path &&
          frame.sceneId === route.sceneId &&
          frame.shellRoute === shellRoute &&
          frame.title === route.title,
      );
      expect(coherentFrames.length).toBeGreaterThan(0);

      const violations = coherentFrames.flatMap((frame) => {
        const reasons: string[] = [];
        const expectedCopyTop =
          frame.heroHeight * route.copyTopRatio[variant];
        if (frame.shellBackground !== route.backgroundColor) {
          reasons.push("shell background retained the previous route");
        }
        if (frame.headingColor !== route.headingColor) {
          reasons.push("heading color retained the previous route");
        }
        if (
          Math.abs(
            frame.headingSize - route.headingSize[variant],
          ) > 0.05
        ) {
          reasons.push("heading size retained the previous route");
        }
        if (Math.abs(frame.copyTop - expectedCopyTop) > 0.5) {
          reasons.push("hero copy top retained the previous route");
        }
        if (
          Object.values(frame.transitionDurations).some(
            (duration) => duration !== "0s",
          )
        ) {
          reasons.push("route styling started a CSS transition");
        }
        if (
          frame.z.copy !== "0" ||
          frame.z.cue !== "2" ||
          frame.z.outerPoster !== "1" ||
          (frame.z.runtime !== null && frame.z.runtime !== "1") ||
          (frame.z.stage !== null && frame.z.stage !== "1")
        ) {
          reasons.push("hero stacking planes changed");
        }
        return reasons.length > 0 ? [{ frame, reasons }] : [];
      });

      expect(violations).toEqual([]);
    }

    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              __sceneRuntimeTrace?: unknown[];
            }
          ).__sceneRuntimeTrace?.length ?? 0,
      ),
    ).toBe(0);
    await context.close();
  });
}
