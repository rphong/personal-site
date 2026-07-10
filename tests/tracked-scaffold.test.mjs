import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const gitExecutable = process.env.GIT_EXECUTABLE ?? "git";

const retainedPaths = [
  ".gitignore",
  ".openai/hosting.json",
  "README.md",
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "build/sites-vite-plugin.ts",
  "docs/superpowers/plans/2026-07-09-personal-site-assets.md",
  "docs/superpowers/plans/2026-07-09-personal-site-execution-index.md",
  "docs/superpowers/plans/2026-07-09-personal-site-foundation.md",
  "docs/superpowers/plans/2026-07-09-personal-site-observability-release.md",
  "docs/superpowers/plans/2026-07-09-personal-site-runtime.md",
  "docs/superpowers/specs/2026-07-09-personal-site-design.md",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "ReferenceImages/Experience - Pink.png",
  "ReferenceImages/Experience - Purple.png",
  "ReferenceImages/Froggie Gameplay.png",
  "ReferenceImages/Main Page - Mint.png",
  "ReferenceImages/Projects - Blue.png",
  "tests/rendered-html.test.mjs",
  "tests/tracked-scaffold.test.mjs",
  "tsconfig.json",
  "vite.config.ts",
  "worker/index.ts",
];

const removableStarterPaths = [
  "app/_sites-preview/preview.css",
  "app/_sites-preview/SkeletonPreview.tsx",
  "app/chatgpt-auth.ts",
  "db/index.ts",
  "db/schema.ts",
  "drizzle.config.ts",
  "drizzle/meta/_journal.json",
  "examples/d1/app/api/notes/route.ts",
  "examples/d1/db/schema.ts",
  "postcss.config.mjs",
  "public/favicon.svg",
  "public/file.svg",
  "public/globe.svg",
  "public/window.svg",
];

const forbiddenTrackedPrefixes = [
  ".pnpm-store/",
  "tmp/",
  "test-results/",
  "playwright-report/",
];

function readTrackedPaths() {
  const result = spawnSync(
    gitExecutable,
    ["ls-files", "--cached", "-z"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `git ls-files failed: ${result.stderr || "unknown error"}`,
  );

  return new Set(result.stdout.split("\0").filter(Boolean));
}

test("tracks the retained scaffold without generated workspace output", () => {
  const trackedPaths = readTrackedPaths();

  for (const retainedPath of retainedPaths) {
    assert.ok(trackedPaths.has(retainedPath), `${retainedPath} must be tracked`);
  }

  const trackedRemovablePaths = removableStarterPaths.filter((starterPath) =>
    trackedPaths.has(starterPath),
  );

  assert.ok(
    trackedRemovablePaths.length === 0 ||
      trackedRemovablePaths.length === removableStarterPaths.length,
    "the removable starter files must be wholly present or wholly absent",
  );

  if (process.env.EXPECT_STARTER_BASELINE === "1") {
    assert.deepEqual(
      trackedRemovablePaths,
      removableStarterPaths,
      "the starter baseline must track every removable starter file",
    );
  }

  for (const trackedPath of trackedPaths) {
    assert.ok(
      forbiddenTrackedPrefixes.every(
        (forbiddenPrefix) => !trackedPath.startsWith(forbiddenPrefix),
      ),
      `${trackedPath} is generated workspace output and must not be tracked`,
    );
  }
});
