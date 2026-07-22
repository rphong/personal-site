import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ExperiencePage from "../app/experience/page";

afterEach(cleanup);

describe("experience page", () => {
  it("renders the approved company chapters and roles in order", () => {
    const { container } = render(<ExperiencePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Experience" }),
    ).toBeInTheDocument();

    expect(
      Array.from(
        container.querySelectorAll(".chapter .chapter-heading"),
        (heading) => heading.textContent,
      ),
    ).toEqual(["NASA", "EOG Resources", "Paycom"]);

    expect(
      screen.getAllByText("Software Developer Intern", { exact: true }),
    ).toHaveLength(4);
    expect(screen.getByText("2025–Present", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("2024", { exact: true })).toBeInTheDocument();
  });

  it("integrates the approved narrative and personality heading with every scene", () => {
    const { container } = render(<ExperiencePage />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Who let the intern out.",
      }),
    ).toHaveClass("experience-intro__heading");
    expect(screen.getByText(/Artemis III preparation/)).toBeInTheDocument();
    expect(screen.getByText(/40–50 seconds to 1–2 seconds/)).toBeInTheDocument();
    expect(
      screen.getByText(/more than 15,000 packages each week/),
    ).toBeInTheDocument();

    const chapters = Array.from(
      container.querySelectorAll<HTMLElement>("section.experience-chapter"),
    );
    expect(chapters.map((chapter) => chapter.dataset.sceneId)).toEqual([
      "experience-intro",
      "nasa-rocket",
      "eog-poster",
      "paycom-poster",
    ]);
    expect(
      chapters.every(
        (chapter) =>
          chapter.querySelector(".chapter-copy") !== null &&
          chapter.querySelector(".chapter-model-space") !== null,
      ),
    ).toBe(true);
    expect(
      chapters.slice(2).map((chapter) =>
        chapter.classList.contains("experience-chapter--poster"),
      ),
    ).toEqual([true, true]);
  });

  it("offers the résumé as a native download", () => {
    render(<ExperiencePage />);

    const resumeLink = screen.getByRole("link", {
      name: "Download my résumé",
    });
    expect(resumeLink).toHaveAttribute("href", "/Richard-Phong-Resume.pdf");
    expect(resumeLink).toHaveAttribute("download");
  });
});
