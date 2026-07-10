import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ContactPage from "../app/contact/page";

afterEach(cleanup);

describe("contact page", () => {
  it("renders the four direct contact actions in order", () => {
    render(<ContactPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Contact" }),
    ).toBeInTheDocument();

    const contactList = screen.getByRole("list", { name: "Contact Richard" });
    const items = within(contactList).getAllByRole("listitem");

    expect(items).toHaveLength(4);

    const links = items.map((item) => within(item).getByRole("link"));
    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Emailrichard.phong424@gmail.com", "mailto:richard.phong424@gmail.com"],
      [
        "LinkedInlinkedin.com/in/richard-phong",
        "https://linkedin.com/in/richard-phong/",
      ],
      ["GitHubgithub.com/rphong", "https://github.com/rphong"],
      ["Phone281-777-6437", "tel:+12817776437"],
    ]);

    for (const link of links.slice(1, 3)) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }

    expect(links[0]).not.toHaveAttribute("target");
    expect(links[0]).not.toHaveAttribute("rel");
    expect(links[3]).not.toHaveAttribute("target");
    expect(links[3]).not.toHaveAttribute("rel");
  });

  it("offers the resume download and explains privacy plainly", () => {
    const { container } = render(<ContactPage />);

    const resumeLink = screen.getByRole("link", { name: "Download résumé" });
    expect(resumeLink).toHaveAttribute("href", "/Richard-Phong-Resume.pdf");
    expect(resumeLink).toHaveAttribute("download");

    expect(
      screen.getByRole("heading", { level: 2, name: "Privacy, plainly." }),
    ).toBeInTheDocument();

    const privacy = container.querySelector("#privacy");
    expect(privacy).not.toBeNull();
    expect(privacy).toHaveTextContent(
      /Cloudflare and Sentry only for sampled performance and error diagnostics/i,
    );
    expect(privacy).toHaveTextContent(/does not attach contact details/i);
    expect(privacy).toHaveTextContent(
      /future 3D preference stays on this device/i,
    );
  });

  it("uses the contact hero scene without a contact form or client controls", () => {
    const { container } = render(<ContactPage />);

    expect(container.querySelector("main")).not.toBeNull();
    expect(
      container.querySelector('[data-scene-id="contact-hero"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        "form, input, textarea, select, button, canvas, [onclick], [onsubmit]",
      ),
    ).toBeNull();
  });
});
