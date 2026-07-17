import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ProjectsPage from "../app/projects/page";

afterEach(cleanup);

describe("projects page", () => {
  it("renders the approved project chapters in order without dates", () => {
    const { container } = render(<ProjectsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Projects" }),
    ).toBeInTheDocument();
    expect(
      Array.from(
        container.querySelectorAll(".chapter .chapter-heading"),
        (heading) => heading.textContent,
      ),
    ).toEqual(["League Ban Site", "Froggie Adventures"]);
    expect(container.textContent).not.toMatch(/\b20(1\d|2[0-4])\b/);
  });

  it("keeps the personality-first reflections and technical context", () => {
    render(<ProjectsPage />);

    expect(
      screen.getByText(/I was already playing League of Legends/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/helped lead a three-person team/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Node\.js · Express · EJS/)).toBeInTheDocument();
    expect(
      screen.getByText(/Unity · C# · three-person team/),
    ).toBeInTheDocument();
  });

  it("links to the repositories and marks both chapters as required live scenes", () => {
    const { container } = render(<ProjectsPage />);
    const chapters = Array.from(
      container.querySelectorAll<HTMLElement>("section.chapter"),
    );

    expect(chapters).toHaveLength(2);
    expect(container.querySelector(".projects-intro")).toBeNull();
    expect(
      chapters.every(
        (chapter) =>
          chapter.classList.contains("project-chapter") &&
          chapter.querySelector(".chapter-layout--project") !== null &&
          chapter.querySelector(".chapter-model-space") !== null &&
          chapter.querySelector(".chapter-copy") !== null,
      ),
    ).toBe(true);
    expect(chapters.map((chapter) => chapter.id)).toEqual([
      "league-ban-site",
      "froggie-adventures",
    ]);
    expect(
      chapters.map((chapter) => chapter.dataset.requiredLive),
    ).toEqual(["true", "true"]);
    expect(chapters.map((chapter) => chapter.dataset.sceneId)).toEqual([
      "league-ban",
      "froggie-adventures",
    ]);

    expect(
      chapters.map((chapter) => [
        chapter.querySelector("source")?.getAttribute("srcset"),
        chapter.querySelector("img")?.getAttribute("src"),
        chapter.querySelector("img")?.getAttribute("alt"),
      ]),
    ).toEqual([
      [
        "/posters/league-ban-mobile.webp",
        "/posters/league-ban-desktop.webp",
        "",
      ],
      [
        "/posters/froggie-adventures-mobile.webp",
        "/posters/froggie-adventures-desktop.webp",
        "",
      ],
    ]);

    const repositoryLinks = chapters.map((chapter) =>
      within(chapter).getByRole("link"),
    );
    expect(
      repositoryLinks.map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      [
        "View League Ban Site on GitHub",
        "https://github.com/rphong/LeagueBanSite",
      ],
      [
        "View Froggie Adventures on GitHub",
        "https://github.com/rphong/Froggie",
      ],
    ]);
    for (const link of repositoryLinks) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }

    expect(container.querySelector("iframe")).toBeNull();
  });
});
