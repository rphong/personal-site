import { readFileSync } from "node:fs";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldUseNavigationIsland } from "../components/site-nav";
import { SiteShell } from "../components/site-shell";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
}));

afterEach(cleanup);

describe("site shell", () => {
  beforeEach(() => {
    mocks.usePathname.mockReturnValue("/projects");
  });

  it("keeps all four navigation links visible and marks the route", () => {
    const { container } = render(
      <SiteShell>
        <main>Page content</main>
      </SiteShell>,
    );

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(
      within(navigation).getAllByRole("link").map((link) => link.textContent),
    ).toEqual(["Home", "Experience", "Projects", "Contact"]);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(navigation.querySelectorAll(".site-nav__indicator")).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: "Projects" })
        .querySelector(".site-nav__indicator"),
    ).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute(
      "data-route",
      "projects",
    );
    expect(container.querySelectorAll("[data-scene-stage]")).toHaveLength(1);
    expect(container.querySelector("#main-content")).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("turns the navigation into an island at the closest reachable boundary", () => {
    let scrollY = 0;
    const nativeGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      900,
    );
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
      1615,
    );

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRect(this: HTMLElement) {
        if (this.classList.contains("site-nav")) {
          return {
            bottom: 76,
            height: 76,
            left: 0,
            right: 1200,
            top: 0,
            width: 1200,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          };
        }

        if (this.classList.contains("page-hero")) {
          const heroBottom = 900 - scrollY;
          return {
            bottom: heroBottom,
            height: 824,
            left: 0,
            right: 1200,
            top: heroBottom - 824,
            width: 1200,
            x: 0,
            y: heroBottom - 824,
            toJSON: () => ({}),
          };
        }

        return nativeGetBoundingClientRect.call(this);
      },
    );

    const { container } = render(
      <SiteShell>
        <section className="page-hero">Hero</section>
      </SiteShell>,
    );
    const header = container.querySelector(".site-nav");

    expect(header).toHaveAttribute("data-island", "false");

    act(() => {
      scrollY = 715;
      window.dispatchEvent(new Event("resize"));
    });
    expect(header).toHaveAttribute("data-island", "true");

    act(() => {
      scrollY = 690;
      window.dispatchEvent(new Event("resize"));
    });
    expect(header).toHaveAttribute("data-island", "false");
  });

  it("preserves the ideal hero/header crossing on longer pages", () => {
    expect(
      shouldUseNavigationIsland({
        currentScrollY: 823,
        headerBottom: 76,
        heroBottom: 77,
        maximumScrollY: 1600,
      }),
    ).toBe(true);
    expect(
      shouldUseNavigationIsland({
        currentScrollY: 800,
        headerBottom: 76,
        heroBottom: 100,
        maximumScrollY: 1600,
      }),
    ).toBe(false);
  });

  it("renders the privacy disclosure", () => {
    render(
      <SiteShell>
        <main>Page content</main>
      </SiteShell>,
    );

    expect(
      screen.getByText("No contact-link tracking or session replay."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy details." })).toHaveAttribute(
      "href",
      "/contact#privacy",
    );
  });

  it("defines the fixed, light-only, mobile-visible shell in CSS", () => {
    const css = readFileSync("app/globals.css", "utf8");

    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).toMatch(/\.site-nav\s*\{[\s\S]*position:\s*fixed/);
    expect(css).not.toMatch(/\.site-nav\s*\{[^}]*border-bottom:/);
    expect(css).toMatch(
      /\.site-nav__inner\s*\{[^}]*justify-content:\s*center/,
    );
    expect(css).toMatch(/\.skip-link:focus-visible\s*\{[\s\S]*transform:\s*none/);
    expect(css).toMatch(/\.scene-stage\s*\{[\s\S]*height:\s*100svh/);
    expect(css).toMatch(/\.page-hero\s*\{[\s\S]*min-height:\s*calc\(100svh/);
    expect(css).toMatch(
      /\.page-hero\s+\.page-hero__poster\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\(-1 \* var\(--nav-height\)\);[^}]*height:\s*100svh;/,
    );
    expect(css).toMatch(
      /\.page-hero h1\s*\{[^}]*color:\s*var\(--route-accent\)/,
    );
    expect(css).not.toMatch(
      /\.page-hero h1\s*\{[^}]*color:\s*var\(--route-pale-heading\)/,
    );
    expect(css).toMatch(
      /\.page-hero--layered h1\s*\{[^}]*color:\s*var\(--route-pale-heading\)/,
    );
    expect(css).toMatch(
      /\.page-hero--layered h1\s*\{[^}]*white-space:\s*nowrap/,
    );
    expect(css).toMatch(/\.content-surface\s*\{[\s\S]*background:\s*#eeeeee/i);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.content-grid\s*\{[^}]*grid-template-columns:\s*1fr;/,
    );
    expect(css).toMatch(
      /\.site-shell\[data-route="experience"\]\s+\.page-hero h1\s*\{[^}]*font-size:\s*clamp\(3rem,\s*15\.5vw,\s*6\.5rem\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.site-footer\s*\{[^}]*padding-bottom:\s*calc\(5rem \+ env\(safe-area-inset-bottom\)\)/,
    );
    expect(css).not.toMatch(/@media\s*\(max-width:\s*720px\)/);
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });
});
