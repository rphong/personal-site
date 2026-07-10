import { describe, expect, it } from "vitest";

import {
  contact,
  experience,
  getOwnerGatedFields,
  home,
  OWNER_INPUT_SENTINEL,
  projects,
  routeDirection,
  routeKeyFromPathname,
  routes,
} from "../content/site-content";

describe("site content", () => {
  it("defines the approved routes and palettes", () => {
    expect(routes.map(({ key, href }) => [key, href])).toEqual([
      ["home", "/"],
      ["experience", "/experience"],
      ["projects", "/projects"],
      ["contact", "/contact"],
    ]);
    expect(routes.map(({ order }) => order)).toEqual([0, 1, 2, 3]);
    expect(routes.map(({ key, palette }) => [key, palette])).toEqual([
      [
        "home",
        {
          background: "#9ECCC0",
          accent: "#135946",
          paleHeading: "#FFFFFF",
        },
      ],
      [
        "experience",
        {
          background: "#DFA9B5",
          accent: "#722939",
          paleHeading: "#FBE5EA",
        },
      ],
      [
        "projects",
        {
          background: "#AFD4E1",
          accent: "#285D71",
          paleHeading: "#EDF7FB",
        },
      ],
      [
        "contact",
        {
          background: "#C9BAE4",
          accent: "#4B2E7E",
          paleHeading: "#EDE6FA",
        },
      ],
    ]);
  });

  it("derives route keys and navigation direction", () => {
    expect(routeKeyFromPathname("/")).toBe("home");
    expect(routeKeyFromPathname("/experience/nasa")).toBe("experience");
    expect(routeKeyFromPathname("/projects/")).toBe("projects");
    expect(routeKeyFromPathname("/unknown")).toBe("home");

    expect(routeDirection("home", "projects")).toBe(1);
    expect(routeDirection("contact", "experience")).toBe(-1);
    expect(routeDirection("projects", "projects")).toBe(0);
  });

  it("keeps companies and roles in the approved order", () => {
    expect(experience.map(({ company }) => company)).toEqual([
      "NASA",
      "EOG Resources",
      "Paycom",
    ]);
    expect(experience.map(({ roles }) => roles)).toEqual([
      [
        { title: "Software Developer Intern", dates: "2023–2024" },
        { title: "Software Developer Intern", dates: "2022–2023" },
      ],
      [
        { title: "Software Developer", dates: "2025–Present" },
        { title: "Software Developer Intern", dates: "2024" },
      ],
      [{ title: "Software Developer Intern", dates: "2023" }],
    ]);
  });

  it("keeps projects ordered and undated", () => {
    expect(projects.map(({ name }) => name)).toEqual([
      "League Ban Site",
      "Froggie Adventures",
    ]);
    expect(projects.map(({ repository }) => repository)).toEqual([
      "https://github.com/rphong/LeagueBanSite",
      "https://github.com/rphong/Froggie",
    ]);
    expect(JSON.stringify(projects)).not.toMatch(/"year"|"date"/i);
  });

  it("defines the exact contact actions", () => {
    expect(contact.actions).toEqual([
      {
        label: "Email",
        value: "richard.phong424@gmail.com",
        href: "mailto:richard.phong424@gmail.com",
      },
      {
        label: "LinkedIn",
        value: "linkedin.com/in/richard-phong",
        href: "https://linkedin.com/in/richard-phong/",
      },
      {
        label: "GitHub",
        value: "github.com/rphong",
        href: "https://github.com/rphong",
      },
      {
        label: "Phone",
        value: "281-777-6437",
        href: "tel:+12817776437",
      },
    ]);
    expect(contact.resumeHref).toBe("/Richard-Phong-Resume.pdf");
  });

  it("reports every home field that still needs owner input", () => {
    expect(
      getOwnerGatedFields({
        nonWorkInterest: OWNER_INPUT_SENTINEL,
        technicalCuriosity: OWNER_INPUT_SENTINEL,
      }),
    ).toEqual(["home.nonWorkInterest", "home.technicalCuriosity"]);

    expect(
      getOwnerGatedFields({
        nonWorkInterest: "",
        technicalCuriosity:
          "Draft copy still contains OWNER_INPUT_REQUIRED: inside it.",
      }),
    ).toEqual(["home.nonWorkInterest", "home.technicalCuriosity"]);

    expect(
      getOwnerGatedFields({
        nonWorkInterest: "   ",
        technicalCuriosity:
          "I keep learning how graphics tools reach the web.",
      }),
    ).toEqual(["home.nonWorkInterest"]);

    expect(home.ownerDraftMessage).toBe(
      "Richard will replace these two marked lines with his own words before production.",
    );
  });
});
