import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 1200, height: 1200 },
});

test("short home pages reach the navigation island without moving content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("personal-site:three-enabled", "off");
  });
  await page.goto("/");
  await expect(page.locator("[data-initial-loading-screen]")).toHaveCount(0);

  const header = page.locator(".site-nav");
  await expect(header).toHaveAttribute("data-island", "false");

  const initialGeometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>("#page-content")!;
    const headerElement = document.querySelector<HTMLElement>(".site-nav")!;
    const hero = document.querySelector<HTMLElement>(".page-hero")!;
    const headerBounds = headerElement.getBoundingClientRect();
    const heroBounds = hero.getBoundingClientRect();
    const maximumScrollY =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;

    return {
      contentDocumentTop: content.getBoundingClientRect().top + window.scrollY,
      headerHeight: headerBounds.height,
      idealActivationScrollY:
        window.scrollY + heroBounds.bottom - headerBounds.bottom,
      maximumScrollY,
    };
  });

  expect(initialGeometry.maximumScrollY).toBeGreaterThan(0);
  expect(initialGeometry.idealActivationScrollY).toBeGreaterThan(
    initialGeometry.maximumScrollY,
  );

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect(header).toHaveAttribute("data-island", "true");

  const bottomGeometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>("#page-content")!;
    const headerBounds = document
      .querySelector<HTMLElement>(".site-nav")!
      .getBoundingClientRect();
    const heroBounds = document
      .querySelector<HTMLElement>(".page-hero")!
      .getBoundingClientRect();

    return {
      contentDocumentTop: content.getBoundingClientRect().top + window.scrollY,
      headerBottom: headerBounds.bottom,
      headerHeight: headerBounds.height,
      heroBottom: heroBounds.bottom,
      maximumScrollY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      scrollY: window.scrollY,
    };
  });

  expect(bottomGeometry.scrollY).toBeCloseTo(bottomGeometry.maximumScrollY, 0);
  expect(bottomGeometry.heroBottom).toBeGreaterThan(
    bottomGeometry.headerBottom,
  );
  expect(bottomGeometry.headerHeight).toBeCloseTo(
    initialGeometry.headerHeight,
    5,
  );
  expect(bottomGeometry.contentDocumentTop).toBeCloseTo(
    initialGeometry.contentDocumentTop,
    5,
  );

  await page.evaluate(() => {
    const maximumScrollY =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    window.scrollTo(0, maximumScrollY - 24);
  });
  await expect(header).toHaveAttribute("data-island", "false");
});
