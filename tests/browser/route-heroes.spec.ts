import { expect, test, type Page, type TestInfo } from "@playwright/test";

const routes = [
  { path: "/", sceneId: "home-hero", title: "Richard Phong" },
  { path: "/experience", sceneId: "experience-hero", title: "Experience" },
  { path: "/projects", sceneId: "projects-hero", title: "Projects" },
  { path: "/contact", sceneId: "contact-hero", title: "Contact" },
] as const;

async function verifyRouteHero(
  page: Page,
  route: (typeof routes)[number],
  variant: "desktop" | "mobile",
  testInfo: TestInfo,
) {
  await page.goto(route.path);

  const hero = page.locator(`[data-scene-id="${route.sceneId}"]`);
  const title = hero.getByRole("heading", { level: 1, name: route.title });
  const cue = hero.getByRole("link", { name: "Scroll to page content" });
  const runtime = hero.locator("[data-scene-runtime-host]");

  await expect(hero).toHaveClass(/page-hero--layered/);
  await expect(title).toBeVisible();
  await expect
    .poll(() =>
      title.evaluate(
        (element) => getComputedStyle(element).webkitTextStrokeWidth,
      ),
    )
    .toBe("1px");
  await expect(cue).toBeVisible();
  await expect(cue).toHaveAttribute("href", "#page-content");
  await expect(hero.locator(".eyebrow, .page-hero__summary")).toHaveCount(0);
  await expect(runtime).toHaveAttribute("data-three-status", "ready", {
    timeout: 20_000,
  });
  await expect(runtime.locator(".scene-runtime__canvas")).toBeVisible();

  const stacking = await hero.evaluate((element) => ({
    cue: getComputedStyle(element.querySelector(".scroll-cue")!).zIndex,
    runtime: getComputedStyle(
      element.querySelector("[data-scene-runtime-host]")!,
    ).zIndex,
    title: getComputedStyle(element.querySelector(".page-hero__copy")!).zIndex,
  }));
  expect(stacking).toEqual({ cue: "2", runtime: "1", title: "0" });

  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`${route.sceneId}-${variant}-live.png`),
  });

  await page.getByRole("button", { name: "3D on" }).click();
  await expect(page.getByRole("button", { name: "3D off" })).toBeVisible();
  await expect(runtime).toHaveAttribute("data-three-status", "disabled");
  await expect(runtime.locator(".scene-runtime__poster")).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`${route.sceneId}-${variant}-poster.png`),
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

    for (const route of routes) {
      await verifyRouteHero(page, route, variant, testInfo);
    }

    await context.close();
  });
}
