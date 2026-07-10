import assert from "node:assert/strict";
import test from "node:test";

delete process.env.SITE_ENV;
delete process.env.SITE_URL;

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${encodeURIComponent(pathname)}`,
  );
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
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

function assertPreviewDocument(html, title) {
  assert.match(html, new RegExp(`<title>${title}</title>`, "i"));
  assert.match(
    html,
    /<meta(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex[^"']*nofollow)[^>]*>/i,
  );
  assert.doesNotMatch(html, /<link[^>]+rel=["']canonical["']/i);
  assert.doesNotMatch(html, /<canvas\b/i);
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
  assert.match(html, /Welcome to my corner/);
  assert.match(html, /Currently building software at EOG Resources/);
  assert.match(
    html,
    /Owner wording|required before production|replace these two marked lines/i,
  );
  assert.match(html, /Operational diagnostics only/);
});

test("server-renders Experience in approved company order", async () => {
  const response = await render("/experience");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Experience \\| Richard Phong");
  assertOrdered(html, ["NASA", "EOG Resources", "Paycom"]);
  assert.match(html, /Artemis III preparation/);
  assert.match(html, /40–50 seconds to 1–2 seconds/);
  assert.match(html, /href="\/Richard-Phong-Resume\.pdf"/);
});

test("server-renders Projects in approved project order", async () => {
  const response = await render("/projects");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Projects \\| Richard Phong");
  assertOrdered(html, ["League Ban Site", "Froggie Adventures"]);
  assert.match(html, /https:\/\/github\.com\/rphong\/LeagueBanSite/);
  assert.match(html, /https:\/\/github\.com\/rphong\/Froggie/);
  assert.doesNotMatch(html, /<iframe\b/i);
});

test("server-renders every Contact action and privacy disclosure", async () => {
  const response = await render("/contact");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Contact \\| Richard Phong");
  assert.match(html, /mailto:richard\.phong424@gmail\.com/);
  assert.match(html, /https:\/\/linkedin\.com\/in\/richard-phong\//);
  assert.match(html, /https:\/\/github\.com\/rphong/);
  assert.match(html, /tel:\+12817776437/);
  assert.match(html, /Cloudflare and Sentry/);
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
