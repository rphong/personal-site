import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const removedStarterFiles = [
  "app/_sites-preview/SkeletonPreview.tsx",
  "app/_sites-preview/preview.css",
  "app/chatgpt-auth.ts",
  "db/index.ts",
  "db/schema.ts",
  "drizzle/meta/_journal.json",
  "drizzle.config.ts",
  "examples/d1/app/api/notes/route.ts",
  "examples/d1/db/schema.ts",
  "postcss.config.mjs",
  "public/favicon.svg",
  "public/file.svg",
  "public/globe.svg",
  "public/window.svg",
] as const;

describe("starter cleanup", () => {
  it.each(removedStarterFiles)("removes %s", async (relativePath) => {
    await expect(access(relativePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps only cross-platform project scripts and dependencies", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));

    expect(packageJson.name).toBe("personal-site");
    expect(packageJson.scripts).toMatchObject({
      dev: "vinext dev",
      build: "vinext build",
      start: "vinext start",
      test: "npm run test:unit && npm run test:html",
      "test:unit": "vitest run",
      "test:html": "npm run build && node --test tests/rendered-html.test.mjs",
      "validate:production": "tsx scripts/validate-production.ts",
    });
    expect(JSON.stringify(packageJson)).not.toMatch(
      /WRANGLER_LOG_PATH=|react-loading-skeleton|drizzle|tailwind/i,
    );
  });

  it("removes starter identity from docs, app source, and Worker bindings", async () => {
    const [readme, page, layout, worker] = await Promise.all([
      readFile("README.md", "utf8"),
      readFile("app/page.tsx", "utf8"),
      readFile("app/layout.tsx", "utf8"),
      readFile("worker/index.ts", "utf8"),
    ]);

    expect(readme).toMatch(/^# Richard Phong Personal Site/m);
    expect(readme).not.toMatch(/vinext-starter|loading skeleton/i);
    expect(page).not.toMatch(/SkeletonPreview|codex-preview|taking shape/);
    expect(layout).not.toMatch(/Starter Project|Geist/);
    expect(worker).not.toMatch(/\bDB:\s*D1Database/);
  });
});
