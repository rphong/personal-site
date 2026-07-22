import assert from "node:assert/strict";
import test from "node:test";

delete process.env.SITE_ENV;
delete process.env.SITE_URL;

async function loadWorker(cacheKey) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${encodeURIComponent(cacheKey)}`,
  );
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

function executionContext() {
  return {
    waitUntil() {},
    passThroughOnException() {},
  };
}

async function render(pathname) {
  const worker = await loadWorker(pathname);
  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    executionContext(),
  );
}

function assertOrdered(haystack, values) {
  let previousIndex = -1;
  for (const value of values) {
    const index = haystack.indexOf(value);
    assert.ok(index > previousIndex, `${value} should appear in order`);
    previousIndex = index;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chapterHeadings(html) {
  return [...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)]
    .filter(([, attributes]) =>
      /\bclass=["'][^"']*\bchapter-heading\b[^"']*["']/i.test(attributes),
    )
    .map(([, , text]) => text.replace(/<[^>]*>/g, "").trim());
}

const ROUTE_SCENE_POSTERS = {
  "/": [
    {
      id: "home-hero",
      desktop: "/posters/home-hero-desktop.webp",
      mobile: "/posters/home-hero-mobile.webp",
      requiredLive: "true",
    },
  ],
  "/experience": [
    {
      id: "experience-hero",
      desktop: "/posters/experience-hero-desktop.webp",
      mobile: "/posters/experience-hero-mobile.webp",
      requiredLive: "true",
    },
    {
      id: "experience-intro",
      desktop: "/posters/experience-intro-desktop.webp",
      mobile: "/posters/experience-intro-mobile.webp",
      requiredLive: "true",
    },
    {
      id: "nasa-rocket",
      desktop: "/posters/nasa-rocket-desktop.webp",
      mobile: "/posters/nasa-rocket-mobile.webp",
      requiredLive: "true",
    },
    {
      id: "eog-poster",
      desktop: "/posters/eog-poster-desktop.webp",
      mobile: "/posters/eog-poster-mobile.webp",
      requiredLive: "false",
    },
    {
      id: "paycom-poster",
      desktop: "/posters/paycom-poster-desktop.webp",
      mobile: "/posters/paycom-poster-mobile.webp",
      requiredLive: "false",
    },
  ],
  "/projects": [
    {
      id: "projects-hero",
      desktop: "/posters/projects-hero-desktop.webp",
      mobile: "/posters/projects-hero-mobile.webp",
      requiredLive: "true",
    },
    {
      id: "league-ban",
      desktop: "/posters/league-ban-desktop.webp",
      mobile: "/posters/league-ban-mobile.webp",
      requiredLive: "true",
    },
    {
      id: "froggie-adventures",
      desktop: "/posters/froggie-adventures-desktop.webp",
      mobile: "/posters/froggie-adventures-mobile.webp",
      requiredLive: "true",
    },
  ],
  "/contact": [
    {
      id: "contact-hero",
      desktop: "/posters/contact-hero-desktop.webp",
      mobile: "/posters/contact-hero-mobile.webp",
      requiredLive: "true",
    },
  ],
};

function initialDocument(html) {
  const closingTag = "</html>";
  const end = html.indexOf(closingTag);
  assert.notEqual(end, -1, "response should contain a complete HTML document");
  return html.slice(0, end + closingTag.length);
}

function attributeValue(attributes, name) {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${escapeRegExp(name)}=(["'])(.*?)\\1`, "i"),
  );
  return match?.[2];
}

function assertScenePosters(html, expected) {
  const document = initialDocument(html);
  const posterPattern =
    /<section\b(?<section>[^>]*)>\s*<picture\b(?<picture>[^>]*)>\s*<source\b(?<source>[^>]*)>\s*<img\b(?<image>[^>]*)>\s*<\/picture>/gi;
  const actual = [...document.matchAll(posterPattern)]
    .filter(({ groups }) => attributeValue(groups?.section ?? "", "data-scene-id"))
    .map(({ groups }) => ({
      id: attributeValue(groups?.section ?? "", "data-scene-id"),
      requiredLive: attributeValue(
        groups?.section ?? "",
        "data-required-live",
      ),
      status: attributeValue(groups?.section ?? "", "data-scene-status"),
      pictureClass: attributeValue(groups?.picture ?? "", "class"),
      media: attributeValue(groups?.source ?? "", "media"),
      mobile: attributeValue(groups?.source ?? "", "srcSet"),
      mobileWidth: attributeValue(groups?.source ?? "", "width"),
      mobileHeight: attributeValue(groups?.source ?? "", "height"),
      desktop: attributeValue(groups?.image ?? "", "src"),
      alt: attributeValue(groups?.image ?? "", "alt"),
      desktopWidth: attributeValue(groups?.image ?? "", "width"),
      desktopHeight: attributeValue(groups?.image ?? "", "height"),
      decoding: attributeValue(groups?.image ?? "", "decoding"),
    }));

  assert.deepEqual(
    actual.map(({ id }) => id),
    expected.map(({ id }) => id),
    "scene sections should server-render once in canonical route order",
  );

  for (const [index, scene] of expected.entries()) {
    const poster = actual[index];
    assert.equal(poster.requiredLive, scene.requiredLive, `${scene.id} live policy`);
    assert.equal(poster.status, "poster", `${scene.id} should SSR poster-first`);
    assert.match(poster.pictureClass ?? "", /\bscene-section__poster\b/);
    assert.equal(poster.media, "(max-width: 767px)");
    assert.equal(poster.mobile, scene.mobile, `${scene.id} mobile poster`);
    assert.equal(poster.mobileWidth, "585");
    assert.equal(poster.mobileHeight, "1266");
    assert.equal(poster.desktop, scene.desktop, `${scene.id} desktop poster`);
    assert.equal(poster.alt, "", `${scene.id} poster should be decorative`);
    assert.equal(poster.desktopWidth, "1920");
    assert.equal(poster.desktopHeight, "1080");
    assert.equal(poster.decoding, "async");
  }

  assert.doesNotMatch(document, /<canvas\b/i);
  assert.doesNotMatch(document, /\/models\/[^"']+\.glb/i);
}

function assertPreviewDocument(html, title) {
  assert.match(
    html,
    new RegExp(`<title>${escapeRegExp(title)}</title>`, "i"),
  );
  assert.match(
    html,
    /<meta(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex[^"']*nofollow)[^>]*>/i,
  );
  assert.doesNotMatch(html, /<link[^>]+rel=["']canonical["']/i);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /3D loading|three-preference-toggle/i);
  const nav = html.match(
    /<nav[^>]*aria-label=["']Primary navigation["'][\s\S]*?<\/nav>/i,
  );
  assert.ok(nav, "Primary navigation should be in initial HTML");
  assertOrdered(nav[0], [
    'href="/"',
    'href="/experience"',
    'href="/projects"',
    'href="/contact"',
  ]);
}

test("server-renders the complete Home page without JavaScript or WebGL", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assertPreviewDocument(html, "Richard Phong");
  assertScenePosters(html, ROUTE_SCENE_POSTERS["/"]);
  assert.match(html, /Hi, I/);
  assert.match(html, /University of Houston/);
  assert.match(html, /Rabbit holes/);
  assertOrdered(html, ["Frontend", "Games", "Contests"]);
  assert.match(html, /https:\/\/codeforces\.com\/profile\/richardp/);
  assert.doesNotMatch(
    html,
    /OWNER_INPUT_REQUIRED|replace these two marked lines|Welcome to my corner|Currently building software at EOG Resources/i,
  );
  assert.match(html, /No contact-link tracking or session replay/);
});

test("server-renders Experience in approved company order", async () => {
  const response = await render("/experience");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Experience | Richard Phong");
  assertScenePosters(html, ROUTE_SCENE_POSTERS["/experience"]);
  assert.deepEqual(chapterHeadings(html), ["NASA", "EOG Resources", "Paycom"]);
  assert.match(html, /Learning by building what matters/);
  assert.doesNotMatch(html, /Who let the intern out/i);
  assert.match(html, /Artemis III preparation/);
  assert.match(html, /40–50 seconds to 1–2 seconds/);
  assert.match(html, /href="\/Richard-Phong-Resume\.pdf"/);
});

test("server-renders Projects in approved project order", async () => {
  const response = await render("/projects");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Projects | Richard Phong");
  assertScenePosters(html, ROUTE_SCENE_POSTERS["/projects"]);
  assert.deepEqual(chapterHeadings(html), [
    "League Ban Site",
    "Froggie Adventures",
  ]);
  assert.match(html, /College project/);
  assert.match(html, /summoner name and recent ranked matches/);
  assert.match(html, /opponent and ban recommendations/);
  assert.match(html, /https:\/\/github\.com\/rphong\/LeagueBanSite/);
  assert.match(html, /https:\/\/github\.com\/rphong\/Froggie/);
  assert.doesNotMatch(html, /<iframe\b/i);
});

test("server-renders every Contact action and privacy disclosure", async () => {
  const response = await render("/contact");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Contact | Richard Phong");
  assertScenePosters(html, ROUTE_SCENE_POSTERS["/contact"]);
  assert.match(html, /mailto:richard\.phong424@gmail\.com/);
  assert.match(html, /https:\/\/linkedin\.com\/in\/richard-phong\//);
  assert.match(html, /https:\/\/github\.com\/rphong/);
  assert.match(html, /tel:\+12817776437/);
  assert.match(html, /hosted on Cloudflare/);
  assert.match(html, /does not track contact-link clicks/);
  assert.match(html, /3D preference is stored only in this browser/);
  assert.doesNotMatch(html, /Cloudflare and Sentry|future 3D/i);
});

test("preview robots disallows crawling and advertises no sitemap", async () => {
  const response = await render("/robots.txt");
  assert.equal(response.status, 200);

  const robots = await response.text();
  assert.match(robots, /User-Agent:\s*\*/i);
  assert.match(robots, /Disallow:\s*\//i);
  assert.doesNotMatch(robots, /Sitemap:/i);
});

test("preview sitemap contains no production URLs", async () => {
  const response = await render("/sitemap.xml");
  assert.equal(response.status, 200);

  const sitemap = await response.text();
  assert.doesNotMatch(sitemap, /<url>/i);
  assert.doesNotMatch(sitemap, /richardphong/i);
});

test("preview image requests fall back when optimizer bindings are absent", async () => {
  const worker = await loadWorker("image-without-bindings");
  const response = await worker.fetch(
    new Request(
      "http://localhost/_vinext/image?url=%2Fposters%2Fhome-hero-desktop.webp&w=1080&q=75",
    ),
    {},
    executionContext(),
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "http://localhost/posters/home-hero-desktop.webp",
  );
});
