import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "../app/page";
import { getOwnerGatedFields, home } from "../content/site-content";

afterEach(cleanup);

describe("home page", () => {
  it("renders Richard's approved introduction and owner-gated context", () => {
    const { container } = render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Richard Phong" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "I'm Richard, a software developer who likes turning ideas into things people can see, use, and remember. This is my corner of the web for the work, experiments, and details that feel most like me.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Currently building software at EOG Resources."),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-scene-id="home-hero"]')).not.toBeNull();
    expect(screen.getByText(home.nonWorkInterest)).toBeInTheDocument();
    expect(screen.getByText(home.technicalCuriosity)).toBeInTheDocument();

    const ownerGate = container.querySelector("[data-owner-gated-fields]");
    expect(ownerGate).toHaveAttribute(
      "data-owner-gated-fields",
      "home.nonWorkInterest home.technicalCuriosity",
    );

    if (getOwnerGatedFields(home).length > 0) {
      expect(within(ownerGate as HTMLElement).getByText(home.ownerDraftMessage)).toBeInTheDocument();
    } else {
      expect(
        within(ownerGate as HTMLElement).queryByText(home.ownerDraftMessage),
      ).not.toBeInTheDocument();
    }

    expect(container).not.toHaveTextContent(/skills|resume bullets/i);
  });

  it("links to Richard's experience, projects, GitHub, and contact routes", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Read my experience" })).toHaveAttribute(
      "href",
      "/experience",
    );
    expect(screen.getByRole("link", { name: "See my projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "Browse my GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/rphong",
    );
    expect(screen.getByRole("link", { name: "Contact me" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});
