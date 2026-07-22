import { describe, expect, it } from "vitest";
import { resolveDeployment } from "../lib/deployment";
import {
  createPageMetadata,
  createRobots,
  createSitemap,
} from "../lib/site-metadata";

describe("deployment metadata", () => {
  it.each([
    [
      "home",
      "Software developer Richard Phong shares his experience, projects, and interactive web experiments.",
    ],
    [
      "experience",
      "Software engineering experience at NASA, EOG Resources, and Paycom.",
    ],
    [
      "projects",
      "Selected projects by Richard Phong, including League Ban Site and Froggie Adventures.",
    ],
    [
      "contact",
      "Contact Richard Phong by email, LinkedIn, GitHub, or phone, and download his résumé.",
    ],
  ] as const)("uses the approved %s description", (route, description) => {
    expect(createPageMetadata(route, {}).description).toBe(description);
  });

  it("defaults every unspecified deployment to a non-indexed preview", () => {
    expect(resolveDeployment({})).toEqual({
      kind: "preview",
      siteUrl: null,
    });

    const metadata = createPageMetadata("home", {});
    expect(metadata.title).toBe("Richard Phong");
    expect(metadata.description).toBe(
      "Software developer Richard Phong shares his experience, projects, and interactive web experiments.",
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.metadataBase).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });

  it("requires an origin-only HTTPS URL before production can index", () => {
    expect(() =>
      resolveDeployment({ SITE_ENV: "production" }),
    ).toThrow("SITE_URL is required");
    expect(() =>
      resolveDeployment({
        SITE_ENV: "production",
        SITE_URL: "http://richardphong.dev",
      }),
    ).toThrow("must use https");
    expect(() =>
      resolveDeployment({
        SITE_ENV: "production",
        SITE_URL: "https://richardphong.dev/portfolio",
      }),
    ).toThrow("must be an origin");
    expect(() =>
      resolveDeployment({
        SITE_ENV: "production",
        SITE_URL: "https://richardphong.dev?",
      }),
    ).toThrow("must be an origin");
    expect(() =>
      resolveDeployment({
        SITE_ENV: "production",
        SITE_URL: "https://richardphong.dev#",
      }),
    ).toThrow("must be an origin");
  });

  it("emits canonical route metadata only for explicit production", () => {
    const env = {
      SITE_ENV: "production",
      SITE_URL: "https://richardphong.dev",
    };

    const metadata = createPageMetadata("experience", env);
    expect(metadata.title).toBe("Experience | Richard Phong");
    expect(metadata.description).toBe(
      "Software engineering experience at NASA, EOG Resources, and Paycom.",
    );
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.metadataBase?.toString()).toBe("https://richardphong.dev/");
    expect(metadata.alternates?.canonical?.toString()).toBe(
      "https://richardphong.dev/experience",
    );
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "Richard Phong",
      title: "Experience | Richard Phong",
      description:
        "Software engineering experience at NASA, EOG Resources, and Paycom.",
    });
    expect(metadata.openGraph?.url?.toString()).toBe(
      "https://richardphong.dev/experience",
    );
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Experience | Richard Phong",
      description:
        "Software engineering experience at NASA, EOG Resources, and Paycom.",
    });
  });

  it("blocks crawlers and publishes no sitemap entries in previews", () => {
    expect(createRobots({})).toEqual({
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    });
    expect(createSitemap({})).toEqual([]);
  });

  it("publishes all four ordered production URLs", () => {
    const env = {
      SITE_ENV: "production",
      SITE_URL: "https://richardphong.dev",
    };

    expect(createRobots(env)).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://richardphong.dev/sitemap.xml",
    });
    expect(createSitemap(env)).toEqual([
      {
        url: "https://richardphong.dev/",
        changeFrequency: "monthly",
        priority: 1,
      },
      {
        url: "https://richardphong.dev/experience",
        changeFrequency: "yearly",
        priority: 0.7,
      },
      {
        url: "https://richardphong.dev/projects",
        changeFrequency: "yearly",
        priority: 0.7,
      },
      {
        url: "https://richardphong.dev/contact",
        changeFrequency: "yearly",
        priority: 0.7,
      },
    ]);
  });
});
