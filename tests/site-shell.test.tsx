import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("renders the operational privacy disclosure", () => {
    render(
      <SiteShell>
        <main>Page content</main>
      </SiteShell>,
    );

    expect(
      screen.getByText(
        "Operational diagnostics only. No engagement or identity tracking.",
      ),
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
