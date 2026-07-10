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

    expect(container.textContent).toMatch(
      /NASA[\s\S]*EOG Resources[\s\S]*Paycom/,
    );

    expect(
      screen.getAllByText("Software Developer Intern", { exact: true }),
    ).toHaveLength(4);
    expect(screen.getByText("2025–Present", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("2024", { exact: true })).toBeInTheDocument();
  });

  it("renders the approved narrative and live intro scene without joke copy", () => {
    const { container } = render(<ExperiencePage />);

    expect(screen.getByText(/Artemis III preparation/)).toBeInTheDocument();
    expect(screen.getByText(/40–50 seconds to 1–2 seconds/)).toBeInTheDocument();
    expect(
      screen.getByText(/more than 15,000 packages each week/),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-scene-id="experience-intro"]'),
    ).not.toBeNull();
    expect(container).not.toHaveTextContent(/Who let the intern out/i);
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
