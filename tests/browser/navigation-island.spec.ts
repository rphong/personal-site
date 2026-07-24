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

test.describe("mobile navigation island", () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test("keeps the active underline on its label and smooth-scrolls when allowed", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("personal-site:three-enabled", "off");
    });
    await page.goto("/");
    await expect(page.locator("[data-initial-loading-screen]")).toHaveCount(0);

    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
    ).toBe("smooth");

    await page.evaluate(() => {
      const testWindow = window as Window & {
        __navigationScrollSamples?: number[];
      };
      testWindow.__navigationScrollSamples = [window.scrollY];
      window.addEventListener(
        "scroll",
        () => testWindow.__navigationScrollSamples?.push(window.scrollY),
        { passive: true },
      );
    });

    await page
      .getByRole("link", { name: "Scroll to page content" })
      .click();
    await expect(page).toHaveURL(/#page-content$/);

    const expectedOffset = await page.evaluate(
      () =>
        document
          .querySelector<HTMLElement>(".site-nav")!
          .getBoundingClientRect().height,
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .querySelector<HTMLElement>("#page-content")!
              .getBoundingClientRect().top,
        ),
      )
      .toBeCloseTo(expectedOffset, 0);

    expect(
      await page.evaluate(() => {
        const testWindow = window as Window & {
          __navigationScrollSamples?: number[];
        };
        const finalY = window.scrollY;
        return testWindow.__navigationScrollSamples?.some(
          (sample) => sample > 0 && sample < finalY - 1,
        );
      }),
    ).toBe(true);

    const header = page.locator(".site-nav");
    await expect(header).toHaveAttribute("data-island", "true");

    const geometry = await page.evaluate(() => {
      const activeLink = document.querySelector<HTMLElement>(
        '.site-nav__link[aria-current="page"]',
      )!;
      const label = activeLink.querySelector<HTMLElement>(".site-nav__label")!;
      const indicator = activeLink.querySelector<HTMLElement>(
        ".site-nav__indicator",
      )!;
      const surface = document.querySelector<HTMLElement>(".site-nav__surface")!;

      return {
        indicator: indicator.getBoundingClientRect().toJSON(),
        label: label.getBoundingClientRect().toJSON(),
        surface: surface.getBoundingClientRect().toJSON(),
      };
    });

    expect(geometry.indicator.left).toBeCloseTo(geometry.label.left, 0);
    expect(geometry.indicator.right).toBeCloseTo(geometry.label.right, 0);
    expect(geometry.indicator.top).toBeGreaterThanOrEqual(geometry.surface.top);
    expect(geometry.indicator.bottom).toBeLessThanOrEqual(
      geometry.surface.bottom,
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
    ).toBe("auto");
  });
});
