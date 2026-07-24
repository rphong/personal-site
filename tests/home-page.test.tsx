import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "../app/page";

afterEach(cleanup);

describe("home page", () => {
  it("keeps the hero intact and renders the simplified introduction", () => {
    const { container } = render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Richard Phong" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Hi, I'm Richard." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I studied computer science at the University of Houston/),
    ).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(container.querySelector('[data-scene-id="home-hero"]')).not.toBeNull();
    expect(container.querySelector(".page-hero--layered")).not.toBeNull();
    const scrollCue = screen.getByRole("link", {
      name: "Scroll to page content",
    });
    expect(scrollCue).toHaveAttribute("href", "#page-content");
    expect(scrollCue).not.toHaveTextContent(/scroll down/i);
    expect(scrollCue.querySelector(".scroll-cue__chevron")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector(".owner-gate")).toBeNull();
    expect(container).not.toHaveTextContent(
      /Currently building software at EOG Resources|Welcome to my corner/i,
    );
  });

  it("links the intro and three rabbit holes to their destinations", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("link", { name: "What I've been up to →" }),
    ).toHaveAttribute("href", "/experience");

    const rabbitHoles = screen.getByRole("list", { name: "Rabbit holes" });
    const items = within(rabbitHoles).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(
      items.map((item) => within(item).getByRole("heading").textContent),
    ).toEqual(["Frontend", "Games", "Contests"]);

    const links = items.map((item) => within(item).getByRole("link"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/projects",
      "/projects",
      "https://codeforces.com/profile/richardp",
    ]);
    expect(links[2]).toHaveAttribute("target", "_blank");
    expect(links[2]).toHaveAttribute("rel", "noreferrer");
    expect(links[0]).not.toHaveAttribute("target");
    expect(links[1]).not.toHaveAttribute("target");
  });

  it("keeps the rabbit-hole cards responsive and keyboard visible", () => {
    const css = readFileSync("app/home.module.css", "utf8");

    expect(css).toMatch(
      /\.domainGrid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(13rem,\s*1fr\)\)/,
    );
    expect(css).toMatch(/\.domain:focus-visible\s*\{[^}]*outline:/);
  });
});
