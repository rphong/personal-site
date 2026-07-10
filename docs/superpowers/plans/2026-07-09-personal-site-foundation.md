# Personal Site Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a poster-first, server-rendered four-route personal site that preserves the approved Figma palette, publishes Richard's verified content and unchanged résumé, blocks preview indexing, and ends as a working Vinext/Sites preview without Three.js.

**Architecture:** Keep all meaningful content in a typed source of truth and render it through small App Router page and shell components. A single client shell owns route palette state, fixed navigation, and an empty fixed scene-stage seam; this plan renders real reference posters in semantic sections while a later plan mounts the persistent Three.js runtime into that seam. Deployment helpers make preview metadata safe by default and only emit production canonicals and sitemap entries when an explicit HTTPS production URL is valid.

**Tech Stack:** Vinext 0.0.50, Next.js 16.2.6 App Router, React 19.2.6, TypeScript 5.9.3, plain responsive CSS, next/font, Vitest, Testing Library, jsdom, Node's test runner, Cloudflare Worker/Sites output.

---

## Focused File Map

### Create

- `tests/tracked-scaffold.test.mjs` proves the pre-existing Sites/Vinext scaffold and all five source references are actually in Git before an isolated worktree is created.
- `content/site-content.ts` — the typed source of truth for route order/direction, exact palettes, hero posters, home copy and owner-gated fields, experience chapters, projects, contact actions, and privacy copy.
- `components/site-shell.tsx` — the only client shell in this plan; maps the pathname to a route, exposes route palette state, keeps navigation fixed, and reserves one fixed scene-stage mount.
- `components/site-nav.tsx` — renders all four links in approved order and marks the active route.
- `components/site-footer.tsx` — renders the concise operational-telemetry disclosure.
- `components/page-hero.tsx` — shared full-viewport poster-first hero with semantic heading and intro.
- `components/scene-poster.tsx` — shared decorative/reference-poster figure used before WebGL exists.
- `app/experience/page.tsx` — NASA, EOG Resources, and Paycom narrative page in approved order.
- `app/projects/page.tsx` — League Ban Site followed by Froggie Adventures, with personality-first reflections and repository links.
- `app/contact/page.tsx` — public email, LinkedIn, GitHub, phone, résumé, and expanded privacy disclosure.
- `lib/deployment.ts` — resolves preview versus production without accidentally treating an arbitrary deploy as indexable.
- `lib/site-metadata.ts` — produces route metadata, robots rules, and sitemap entries from deployment state.
- `lib/production-validation.ts` — reports owner-gated copy and production-config failures without blocking local previews.
- `app/robots.ts` and `app/sitemap.ts` — expose the tested metadata routes.
- `scripts/validate-production.ts` — executable release gate for production URL, owner copy, résumé, and public poster assets.
- `tests/setup.ts` and `vitest.config.ts` — unit/component test environment.
- `tests/site-content.test.ts`, `tests/public-assets.test.ts`, `tests/site-shell.test.tsx`, `tests/home-page.test.tsx`, `tests/experience-page.test.tsx`, `tests/projects-page.test.tsx`, `tests/contact-page.test.tsx`, `tests/deployment-metadata.test.ts`, `tests/production-validation.test.ts`, and `tests/starter-cleanup.test.ts` — focused RED/GREEN contracts.
- `public/posters/home-reference.png`, `public/posters/experience-reference.png`, `public/posters/projects-reference.png`, and `public/posters/contact-reference.png` — preview-only copies of approved Figma exports; a later asset plan replaces them with deterministic web-scene captures before production.
- `public/images/froggie-gameplay.png` — authentic gameplay reference used in the Froggie project chapter and later Blender display texture.
- `public/Richard-Phong-Resume.pdf` — byte-for-byte copy of the owner-maintained canonical résumé.
- `.env.example` — documents safe preview defaults.

### Replace

- `app/layout.tsx` — replace starter Geist metadata/shell with Nunito Sans, Fraunces, light-only color scheme, and the shared site shell.
- `app/page.tsx` — replace the disposable loading skeleton with the Home route.
- `app/globals.css` — replace Tailwind starter and dark-mode override with exact route tokens and responsive layout CSS.
- `tests/rendered-html.test.mjs` — replace skeleton assertions with initial-HTML assertions for all routes and preview indexing.
- `README.md` — replace starter documentation with project-specific preview, validation, and build instructions.
- `worker/index.ts` — remove the unused D1 binding from the environment type while preserving Vinext image handling.
- `package.json` and `package-lock.json` — remove starter-only packages, add test tooling, and make npm scripts cross-platform.

### Delete

- `app/_sites-preview/SkeletonPreview.tsx` and `app/_sites-preview/preview.css`.
- `app/chatgpt-auth.ts`; authentication is a v1 non-goal.
- `db/index.ts`, `db/schema.ts`, `drizzle/meta/_journal.json`, `drizzle.config.ts`, and `examples/d1/**`; persistence is a v1 non-goal.
- `postcss.config.mjs`; the finished foundation uses plain CSS.
- `public/favicon.svg`, `public/file.svg`, `public/globe.svg`, and `public/window.svg`; these are starter artwork. A bespoke icon is intentionally outside this foundation slice.

### Preserve

- `.openai/hosting.json`, `vite.config.ts`, `build/sites-vite-plugin.ts`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, and `worker/index.ts`'s Vinext request/image behavior.
- `ReferenceImages/**` as source references; never delete or rename them.
- `docs/superpowers/specs/2026-07-09-personal-site-design.md` as the approved design authority.

## Execution Notes

- The supplied application scaffold and `ReferenceImages/**` are currently untracked. Run Task 0 once in the current workspace and commit that exact baseline **before** creating an isolated worktree. Creating a worktree from the current pre-baseline HEAD would omit the entire application.
- After Task 0 is green and committed, run Tasks 1â€“10 in an isolated worktree created from that baseline commit. Do not create a second initializer; this is an existing Vinext/Sites project.
- On this Windows workspace, Node, npm, and Git may not initially be on `PATH`. Call the Codex workspace dependency loader first, prepend the returned runtime directories, then verify `node --version` is at least 22.13.0.
- Never use the existing POSIX npm-script form `WRANGLER_LOG_PATH=... vinext ...` on Windows. This plan replaces it with plain `vinext ...`; `vite.config.ts` already sets the Wrangler paths before importing the Cloudflare plugin.
- PowerShell environment assignment and the command that consumes it must be separate lines. Do not use Bash `export`, `cp`, brace expansion, or test globs.
- Run the exact targeted test after each RED or GREEN step. Do not batch several implementation steps before seeing the expected failure.
- Every task ends with a refactor/check step and a focused commit. Do not continue after an unexpected failure; diagnose it before advancing.

### Task 0: Capture the Existing Starter Baseline Before Worktree Isolation

**Files:**
- Create: `tests/tracked-scaffold.test.mjs`
- Modify: `.gitignore`
- Track unchanged: `.openai/hosting.json`, `app/**`, `build/sites-vite-plugin.ts`, `db/**`, `drizzle.config.ts`, `drizzle/**`, `eslint.config.mjs`, `examples/**`, `next.config.ts`, `package.json`, `package-lock.json`, `postcss.config.mjs`, `public/**`, `README.md`, `tests/rendered-html.test.mjs`, `tsconfig.json`, `vite.config.ts`, and `worker/index.ts`
- Track source references: `ReferenceImages/**`

This task is intentionally executed in the current workspace. It turns the supplied, untracked starter into a reproducible Git baseline so every later worktree contains the same build, hosting, and reference inputs. The approved specification and all five files in `docs/superpowers/plans/` must already be tracked by the separate planning commit that precedes execution; if any is untracked or modified, stop and finish that planning commit before Task 0. Task 0 must not stage plan changes, `.pnpm-store/`, `tmp/`, dependency output, build output, browser reports, or Codex-local state.

- [ ] **Step 1: Ignore local package, audit, and browser-output directories**

Append these exact rules to `.gitignore`:

~~~gitignore

# Workspace-local dependency, audit, and browser output.
/.pnpm-store/
/tmp/
/test-results/
/playwright-report/
~~~

Expected: the existing `.pnpm-store/` and `tmp/` trees disappear from `git status --short`; later failed Playwright runs cannot dirty the release worktree. Snapshot baselines under `tests/browser/visual-regression.spec.ts-snapshots/` remain trackable.

- [ ] **Step 2: Write the tracked-scaffold contract**

Create `tests/tracked-scaffold.test.mjs`:

~~~js
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const git = process.env.GIT_EXECUTABLE ?? "git";

function trackedFiles() {
  const result = spawnSync(git, ["ls-files", "--cached", "-z"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || "git ls-files failed");
  return new Set(result.stdout.split("\0").filter(Boolean));
}

test("tracks every retained input and never partially captures the removable starter", () => {
  const tracked = trackedFiles();
  const requiredRetained = [
    ".gitignore",
    ".openai/hosting.json",
    "README.md",
    "app/globals.css",
    "app/layout.tsx",
    "app/page.tsx",
    "build/sites-vite-plugin.ts",
    "eslint.config.mjs",
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "tests/rendered-html.test.mjs",
    "tests/tracked-scaffold.test.mjs",
    "tsconfig.json",
    "vite.config.ts",
    "worker/index.ts",
    "docs/superpowers/specs/2026-07-09-personal-site-design.md",
    "docs/superpowers/plans/2026-07-09-personal-site-foundation.md",
    "docs/superpowers/plans/2026-07-09-personal-site-assets.md",
    "docs/superpowers/plans/2026-07-09-personal-site-runtime.md",
    "docs/superpowers/plans/2026-07-09-personal-site-observability-release.md",
    "docs/superpowers/plans/2026-07-09-personal-site-execution-index.md",
    "ReferenceImages/Experience - Pink.png",
    "ReferenceImages/Experience - Purple.png",
    "ReferenceImages/Froggie Gameplay.png",
    "ReferenceImages/Main Page - Mint.png",
    "ReferenceImages/Projects - Blue.png",
  ];
  const removableStarter = [
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
  for (const path of requiredRetained) {
    assert.ok(tracked.has(path), `${path} must be tracked before worktree creation`);
  }
  const trackedRemovable = removableStarter.filter((path) => tracked.has(path));
  if (process.env.EXPECT_STARTER_BASELINE === "1") {
    assert.equal(
      trackedRemovable.length,
      removableStarter.length,
      "Task 0 must stage the complete supplied starter before worktree creation",
    );
  }
  assert.ok(
    trackedRemovable.length === 0 ||
      trackedRemovable.length === removableStarter.length,
    "the supplied removable starter set must be wholly staged or wholly deleted",
  );
  assert.ok(
    [...tracked].every(
      (path) =>
        !path.startsWith(".pnpm-store/") &&
        !path.startsWith("tmp/") &&
        !path.startsWith("test-results/") &&
        !path.startsWith("playwright-report/"),
    ),
    "generated workspace output must stay untracked",
  );
});
~~~

- [ ] **Step 3: Stage only the supplied source baseline and verify GREEN**

Run these commands from the current workspace, using the resolved Git executable if `git` is not yet on `PATH`:

~~~powershell
git ls-files --error-unmatch docs/superpowers/specs/2026-07-09-personal-site-design.md docs/superpowers/plans/2026-07-09-personal-site-foundation.md docs/superpowers/plans/2026-07-09-personal-site-assets.md docs/superpowers/plans/2026-07-09-personal-site-runtime.md docs/superpowers/plans/2026-07-09-personal-site-observability-release.md docs/superpowers/plans/2026-07-09-personal-site-execution-index.md
git add .gitignore .openai/hosting.json README.md ReferenceImages app build db drizzle.config.ts drizzle eslint.config.mjs examples next.config.ts package.json package-lock.json postcss.config.mjs public tests tsconfig.json vite.config.ts worker
git diff --cached --name-only
$env:EXPECT_STARTER_BASELINE = "1"
node --test tests/tracked-scaffold.test.mjs
Remove-Item Env:EXPECT_STARTER_BASELINE
~~~

Expected: `git ls-files --error-unmatch` prints every specification/plan path and exits 0. The staged list then contains the intended starter, five references, and tracked-scaffold test; it contains no `docs/superpowers/plans` changes, `.pnpm-store/`, `tmp/`, `dist/`, `.vinext/`, `node_modules/`, `test-results/`, or `playwright-report/`. The Node test PASSes because staged files are part of the Git index.

- [ ] **Step 4: Commit the baseline, prove a clean tree, then create the isolated worktree**

~~~powershell
git commit -m "chore: capture personal site starter baseline"
git status --short
$env:EXPECT_STARTER_BASELINE = "1"
node --test tests/tracked-scaffold.test.mjs
Remove-Item Env:EXPECT_STARTER_BASELINE
~~~

Expected: the commit succeeds, both checks are clean/green, and a fresh worktree from this commit contains the application plus all five reference images. Only now invoke the Superpowers worktree workflow and continue with Task 1 there.

### Task 1: Cross-Platform Test Harness and Typed Content

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/site-content.test.ts`
- Create: `content/site-content.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Put the cross-platform test commands and dependencies in place**

Run each command separately from PowerShell:

~~~powershell
npm install --save-dev --save-exact vitest@4.1.10 @testing-library/react@16.3.2 @testing-library/jest-dom@6.9.1 jsdom@29.1.1 tsx@4.20.6
npm pkg set "name=personal-site"
npm pkg set "scripts.dev=vinext dev"
npm pkg set "scripts.build=vinext build"
npm pkg set "scripts.start=vinext start"
npm pkg set "scripts.test=npm run test:unit && npm run test:html"
npm pkg set "scripts.test:unit=vitest run"
npm pkg set "scripts.test:watch=vitest"
npm pkg set "scripts.test:html=npm run build && node --test tests/rendered-html.test.mjs"
npm pkg set "scripts.validate:production=tsx scripts/validate-production.ts"
npm pkg set "scripts.lint=eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern tmp"
~~~

Expected: every command exits 0; `package-lock.json` remains lockfile version 3; the new test dependencies are locked; and no script contains `WRANGLER_LOG_PATH=`. Keep starter dependencies installed until their source files are deleted under a failing cleanup test in Task 10.

Create `vitest.config.ts`:

~~~ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
~~~

Create `tests/setup.ts`:

~~~ts
import "@testing-library/jest-dom/vitest";
import type * as ReactTypes from "react";
import { vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      fill: _fill,
      priority: _priority,
      sizes: _sizes,
      ...props
    }: ReactTypes.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
      sizes?: string;
    }) => {
      void _fill;
      void _priority;
      void _sizes;
      return createElement("img", props);
    },
  };
});

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      children,
      ...props
    }: ReactTypes.AnchorHTMLAttributes<HTMLAnchorElement>) =>
      createElement("a", props, children),
  };
});
~~~

- [ ] **Step 2: Write the failing content contract**

Create `tests/site-content.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import {
  contact,
  experience,
  getOwnerGatedFields,
  home,
  projects,
  routeDirection,
  routeKeyFromPathname,
  routes,
} from "../content/site-content";

describe("site content", () => {
  it("keeps the approved route order and exact palettes", () => {
    expect(routes.map(({ key, href }) => [key, href])).toEqual([
      ["home", "/"],
      ["experience", "/experience"],
      ["projects", "/projects"],
      ["contact", "/contact"],
    ]);
    expect(routes.map(({ order }) => order)).toEqual([0, 1, 2, 3]);
    expect(routes.map(({ palette }) => palette)).toEqual([
      { background: "#9ECCC0", accent: "#135946", paleHeading: "#FFFFFF" },
      { background: "#DFA9B5", accent: "#722939", paleHeading: "#FBE5EA" },
      { background: "#AFD4E1", accent: "#285D71", paleHeading: "#EDF7FB" },
      { background: "#C9BAE4", accent: "#4B2E7E", paleHeading: "#EDE6FA" },
    ]);
  });

  it("maps nested pathnames to their top-level route", () => {
    expect(routeKeyFromPathname("/")).toBe("home");
    expect(routeKeyFromPathname("/experience/nasa")).toBe("experience");
    expect(routeKeyFromPathname("/projects/")).toBe("projects");
    expect(routeKeyFromPathname("/unknown")).toBe("home");
    expect(routeDirection("home", "projects")).toBe(1);
    expect(routeDirection("contact", "experience")).toBe(-1);
    expect(routeDirection("projects", "projects")).toBe(0);
  });

  it("keeps the approved company and role order", () => {
    expect(experience.map(({ company }) => company)).toEqual([
      "NASA",
      "EOG Resources",
      "Paycom",
    ]);
    expect(experience[0].roles).toEqual([
      { title: "Software Developer Intern", dates: "2023–2024" },
      { title: "Software Developer Intern", dates: "2022–2023" },
    ]);
    expect(experience[1].roles).toEqual([
      { title: "Software Developer", dates: "2025–Present" },
      { title: "Software Developer Intern", dates: "2024" },
    ]);
    expect(experience[2].roles).toEqual([
      { title: "Software Developer Intern", dates: "2023" },
    ]);
  });

  it("keeps the personality projects ordered and undated", () => {
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

  it("publishes every approved contact action and résumé path", () => {
    expect(contact.actions).toEqual([
      {
        label: "Email",
        display: "richard.phong424@gmail.com",
        href: "mailto:richard.phong424@gmail.com",
      },
      {
        label: "LinkedIn",
        display: "linkedin.com/in/richard-phong",
        href: "https://linkedin.com/in/richard-phong/",
      },
      {
        label: "GitHub",
        display: "github.com/rphong",
        href: "https://github.com/rphong",
      },
      {
        label: "Phone",
        display: "281-777-6437",
        href: "tel:+12817776437",
      },
    ]);
    expect(contact.resumeHref).toBe("/Richard-Phong-Resume.pdf");
  });

  it("makes the two owner-written Home fields explicit release gates", () => {
    expect(
      getOwnerGatedFields({
        nonWorkInterest: `${OWNER_INPUT_SENTINEL} home.nonWorkInterest`,
        technicalCuriosity:
          `${OWNER_INPUT_SENTINEL} home.technicalCuriosity`,
      }),
    ).toEqual([
      "home.nonWorkInterest",
      "home.technicalCuriosity",
    ]);
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
        technicalCuriosity: "I keep learning how graphics tools reach the web.",
      }),
    ).toEqual(["home.nonWorkInterest"]);
    expect(home.ownerDraftMessage).toBe(
      "Richard will replace these two marked lines with his own words before production.",
    );
  });
});
~~~

- [ ] **Step 3: Run the content contract and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/site-content.test.ts
~~~

Expected: FAIL with a module-resolution error containing `content/site-content` because the source of truth does not exist.

- [ ] **Step 4: Implement the complete typed content source**

Create `content/site-content.ts`:

~~~ts
export type RouteKey = "home" | "experience" | "projects" | "contact";

export type RoutePalette = {
  background: string;
  accent: string;
  paleHeading: string;
};

export type RouteDefinition = {
  key: RouteKey;
  href: string;
  label: string;
  title: string;
  description: string;
  eyebrow: string;
  heroSummary: string;
  heroPoster: string;
  heroSceneId: string;
  order: number;
  palette: RoutePalette;
};

export const OWNER_INPUT_SENTINEL = "OWNER_INPUT_REQUIRED:";

export const routes: readonly RouteDefinition[] = [
  {
    key: "home",
    href: "/",
    label: "Home",
    title: "Richard Phong",
    description:
      "Richard Phong's personal home for software work, creative experiments, and interactive web scenes.",
    eyebrow: "Personal home",
    heroSummary:
      "Software developer, curious builder, and collector of projects with a little personality.",
    heroPoster: "/posters/home-reference.png",
    heroSceneId: "home-hero",
    order: 0,
    palette: {
      background: "#9ECCC0",
      accent: "#135946",
      paleHeading: "#FFFFFF",
    },
  },
  {
    key: "experience",
    href: "/experience",
    label: "Experience",
    title: "Experience",
    description:
      "Richard Phong's first-person software experience across NASA, EOG Resources, and Paycom.",
    eyebrow: "Work, in my own words",
    heroSummary:
      "Three chapters shaped by high-stakes tools, technical data, and software people depend on.",
    heroPoster: "/posters/experience-reference.png",
    heroSceneId: "experience-hero",
    order: 1,
    palette: {
      background: "#DFA9B5",
      accent: "#722939",
      paleHeading: "#FBE5EA",
    },
  },
  {
    key: "projects",
    href: "/projects",
    label: "Projects",
    title: "Projects",
    description:
      "Creative college projects that connected Richard Phong's interests, teamwork, and software craft.",
    eyebrow: "Built for the fun of it",
    heroSummary:
      "A pair of formative projects remembered for curiosity, collaboration, and flair.",
    heroPoster: "/posters/projects-reference.png",
    heroSceneId: "projects-hero",
    order: 2,
    palette: {
      background: "#AFD4E1",
      accent: "#285D71",
      paleHeading: "#EDF7FB",
    },
  },
  {
    key: "contact",
    href: "/contact",
    label: "Contact",
    title: "Contact",
    description:
      "Email, LinkedIn, GitHub, phone, and résumé links for Richard Phong.",
    eyebrow: "Say hello",
    heroSummary:
      "The direct routes to my inbox, work, code, résumé, and phone.",
    heroPoster: "/posters/contact-reference.png",
    heroSceneId: "contact-hero",
    order: 3,
    palette: {
      background: "#C9BAE4",
      accent: "#4B2E7E",
      paleHeading: "#EDE6FA",
    },
  },
] as const;

export const routeByKey = Object.fromEntries(
  routes.map((route) => [route.key, route]),
) as Record<RouteKey, RouteDefinition>;

export function routeKeyFromPathname(pathname: string): RouteKey {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (
    segment === "experience" ||
    segment === "projects" ||
    segment === "contact"
  ) {
    return segment;
  }
  return "home";
}

export function routeDirection(from: RouteKey, to: RouteKey): -1 | 0 | 1 {
  return Math.sign(routeByKey[to].order - routeByKey[from].order) as -1 | 0 | 1;
}

export const home = {
  introduction:
    "I'm Richard, a software developer who likes turning ideas into things people can see, use, and remember. This is my corner of the web for the work, experiments, and details that feel most like me.",
  currentRole: "Currently building software at EOG Resources.",
  nonWorkInterest: `${OWNER_INPUT_SENTINEL} home.nonWorkInterest`,
  technicalCuriosity: `${OWNER_INPUT_SENTINEL} home.technicalCuriosity`,
  ownerDraftMessage:
    "Richard will replace these two marked lines with his own words before production.",
  links: [
    { label: "Read my experience", href: "/experience" },
    { label: "See my projects", href: "/projects" },
    { label: "Browse my GitHub", href: "https://github.com/rphong" },
    { label: "Contact me", href: "/contact" },
  ],
} as const;

export type OwnerHomeFields = {
  nonWorkInterest: string;
  technicalCuriosity: string;
};

export function getOwnerGatedFields(
  content: OwnerHomeFields,
): string[] {
  return [
    ["home.nonWorkInterest", content.nonWorkInterest],
    ["home.technicalCuriosity", content.technicalCuriosity],
  ]
    .filter(
      ([, value]) =>
        value.trim() === "" || value.includes(OWNER_INPUT_SENTINEL),
    )
    .map(([field]) => field);
}

export type RoleEntry = {
  title: string;
  dates: string;
};

export type ExperienceChapter = {
  id: "nasa" | "eog" | "paycom";
  company: string;
  sceneId: string;
  poster: string;
  requiredLive: boolean;
  roles: readonly RoleEntry[];
  narrative: readonly string[];
};

export const experience: readonly ExperienceChapter[] = [
  {
    id: "nasa",
    company: "NASA",
    sceneId: "nasa-rocket",
    poster: "/posters/experience-reference.png",
    requiredLive: true,
    roles: [
      { title: "Software Developer Intern", dates: "2023–2024" },
      { title: "Software Developer Intern", dates: "2022–2023" },
    ],
    narrative: [
      "At NASA, I worked across crew-facing interfaces, training tools, and simulator workflows. I helped redesign an ISS crew calendar interface used during Artemis III preparation, automated feedback for On-Board Training, and built a Razor Pages coordination tool.",
      "I also reduced a training-simulator file by 60 percent and improved one script's speed by more than 5×. That range made performance and clarity feel inseparable from the people relying on the software.",
    ],
  },
  {
    id: "eog",
    company: "EOG Resources",
    sceneId: "eog-poster",
    poster: "/posters/experience-reference.png",
    requiredLive: false,
    roles: [
      { title: "Software Developer", dates: "2025–Present" },
      { title: "Software Developer Intern", dates: "2024" },
    ],
    narrative: [
      "At EOG, I've focused on making dense technical data faster to explore and easier to trust. I reduced a reservoir proxy workflow from 40–50 seconds to 1–2 seconds and helped surface more than 100,000 data points through visualization components.",
      "I've also established automated quality gates, led cross-team visualization integration, and built a real-time anomaly detection and escalation pipeline. Moving from intern to full-time developer has reinforced how much I enjoy working close to a problem and iterating with the people who know it best.",
    ],
  },
  {
    id: "paycom",
    company: "Paycom",
    sceneId: "paycom-poster",
    poster: "/posters/experience-reference.png",
    requiredLive: false,
    roles: [{ title: "Software Developer Intern", dates: "2023" }],
    narrative: [
      "At Paycom, I built an ASP.NET and React Web API that used FedEx APIs to support more than 15,000 packages each week, then built out a test suite that reached 90 percent coverage.",
      "It was a focused lesson in treating reliability as part of the feature rather than a separate concern.",
    ],
  },
] as const;

export type ProjectChapter = {
  id: "league-ban-site" | "froggie-adventures";
  name: string;
  sceneId: string;
  poster: string;
  posterAlt: string;
  requiredLive: true;
  reflection: string;
  technicalLine: string;
  repository: string;
};

export const projects: readonly ProjectChapter[] = [
  {
    id: "league-ban-site",
    name: "League Ban Site",
    sceneId: "league-ban",
    poster: "/posters/projects-reference.png",
    posterAlt: "",
    requiredLive: true,
    reflection:
      "League Ban Site began with a simple connection: I was already playing League of Legends, and I wanted to see what would happen if I turned that familiarity into a coding project. Building around match data made software feel less abstract and pushed me to keep learning because the problem already meant something to me.",
    technicalLine:
      "Node.js · Express · EJS · node-fetch · Riot APIs · accepts a summoner name, reads recent ranked matches, and derives playful opponent/ban recommendations",
    repository: "https://github.com/rphong/LeagueBanSite",
  },
  {
    id: "froggie-adventures",
    name: "Froggie Adventures",
    sceneId: "froggie-adventures",
    poster: "/images/froggie-gameplay.png",
    posterAlt:
      "Froggie Adventures gameplay showing a pixel-art frog, platforms, hearts, and a score counter.",
    requiredLive: true,
    reflection:
      "Froggie Adventures is the project I remember most for the teamwork. I helped lead a three-person team, which meant sharing ideas, dividing responsibility, and bringing separate pieces together into something we could demonstrate publicly. Seeing the game take shape as a group made shipping feel as rewarding as the code itself.",
    technicalLine:
      "Unity · C# · three-person team · procedural, difficulty-scaled level generation",
    repository: "https://github.com/rphong/Froggie",
  },
] as const;

export const contact = {
  introduction:
    "Whether you want to talk about a role, a project, or an odd web experiment, these are the best ways to reach me.",
  actions: [
    {
      label: "Email",
      display: "richard.phong424@gmail.com",
      href: "mailto:richard.phong424@gmail.com",
    },
    {
      label: "LinkedIn",
      display: "linkedin.com/in/richard-phong",
      href: "https://linkedin.com/in/richard-phong/",
    },
    {
      label: "GitHub",
      display: "github.com/rphong",
      href: "https://github.com/rphong",
    },
    {
      label: "Phone",
      display: "281-777-6437",
      href: "tel:+12817776437",
    },
  ],
  resumeHref: "/Richard-Phong-Resume.pdf",
  privacy:
    "The production site is designed to use Cloudflare and Sentry only for sampled performance and error diagnostics. It does not attach contact details to diagnostics, track contact actions, collect visitor identity, or use session replay. The future 3D preference stays on this device.",
} as const;

export const footer = {
  disclosure:
    "Operational diagnostics only. No engagement or identity tracking.",
  privacyHref: "/contact#privacy",
} as const;
~~~

- [ ] **Step 5: Run the content contract and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/site-content.test.ts
~~~

Expected: PASS with 6 tests.

- [ ] **Step 6: Refactor-check the source and commit**

Run:

~~~powershell
npm run lint
~~~

Expected: PASS. If ESLint reports only still-imported starter Tailwind or skeleton files, do not suppress it; confirm those files are not part of this task and continue only when the new files are clean.

Commit:

~~~powershell
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/site-content.test.ts content/site-content.ts
git commit -m "feat: add typed personal site content"
~~~

Expected: one commit named `feat: add typed personal site content`.

### Task 2: Canonical Résumé and Poster-First Public Assets

**Files:**
- Create: `tests/public-assets.test.ts`
- Create: `public/Richard-Phong-Resume.pdf`
- Create: `public/posters/home-reference.png`
- Create: `public/posters/experience-reference.png`
- Create: `public/posters/projects-reference.png`
- Create: `public/posters/contact-reference.png`
- Create: `public/images/froggie-gameplay.png`
- Track unchanged source references: `ReferenceImages/Main Page - Mint.png`, `ReferenceImages/Experience - Pink.png`, `ReferenceImages/Projects - Blue.png`, `ReferenceImages/Experience - Purple.png`, and `ReferenceImages/Froggie Gameplay.png`

- [ ] **Step 1: Write the failing byte-integrity test**

Create `tests/public-assets.test.ts`:

~~~ts
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const expectedAssets = [
  {
    relativePath: "public/Richard-Phong-Resume.pdf",
    bytes: 133_744,
    sha256: "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e",
  },
  {
    relativePath: "public/posters/home-reference.png",
    bytes: 323_621,
    sha256: "a986f7f511252b521e79bc623274093845a244d67e636accd62f9d84672fd8a6",
  },
  {
    relativePath: "public/posters/experience-reference.png",
    bytes: 804_876,
    sha256: "d46c5f6d72c6087cb0f4e632bcf50aa41239415aba398682443f8e777e1f47ad",
  },
  {
    relativePath: "public/posters/projects-reference.png",
    bytes: 1_027_131,
    sha256: "5da147a96636afb90d174b2c47a53289ae2530055c95bbcf8c9968daae1d3689",
  },
  {
    relativePath: "public/posters/contact-reference.png",
    bytes: 273_901,
    sha256: "759d9c87f7d5eb92dacc9c8e1d03d9ed1ee27ba0f9cdab64e5474b604381d8d2",
  },
  {
    relativePath: "public/images/froggie-gameplay.png",
    bytes: 2_337_398,
    sha256: "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613",
  },
] as const;

describe("public foundation assets", () => {
  it.each(expectedAssets)(
    "copies $relativePath without changing bytes",
    async ({ relativePath, bytes, sha256 }) => {
      const absolutePath = path.join(root, relativePath);
      const [file, metadata] = await Promise.all([
        readFile(absolutePath),
        stat(absolutePath),
      ]);

      expect(metadata.size).toBe(bytes);
      expect(createHash("sha256").update(file).digest("hex")).toBe(sha256);
    },
  );
});
~~~

- [ ] **Step 2: Run the asset test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/public-assets.test.ts
~~~

Expected: FAIL with `ENOENT` for `public/Richard-Phong-Resume.pdf`; none of the target assets exists yet.

- [ ] **Step 3: Copy the approved binary sources without transformation**

Run each command separately:

~~~powershell
New-Item -ItemType Directory -Force -Path "public\posters"
New-Item -ItemType Directory -Force -Path "public\images"
Copy-Item -LiteralPath "C:\Users\richa\OneDrive\Documents\Jerb\PhongRichard.pdf" -Destination "public\Richard-Phong-Resume.pdf"
Copy-Item -LiteralPath "ReferenceImages\Main Page - Mint.png" -Destination "public\posters\home-reference.png"
Copy-Item -LiteralPath "ReferenceImages\Experience - Pink.png" -Destination "public\posters\experience-reference.png"
Copy-Item -LiteralPath "ReferenceImages\Projects - Blue.png" -Destination "public\posters\projects-reference.png"
Copy-Item -LiteralPath "ReferenceImages\Experience - Purple.png" -Destination "public\posters\contact-reference.png"
Copy-Item -LiteralPath "ReferenceImages\Froggie Gameplay.png" -Destination "public\images\froggie-gameplay.png"
~~~

Expected: six destination files are created. Do not optimize, recompress, crop, or rename the sources in this task; their hashes are the proof that the résumé and references stayed canonical.

- [ ] **Step 4: Run the asset test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/public-assets.test.ts
~~~

Expected: PASS with 6 parameterized cases.

- [ ] **Step 5: Refactor-check the public surface and commit**

Run:

~~~powershell
Get-ChildItem public -Recurse -File | Select-Object FullName,Length
~~~

Expected: the six new canonical targets have the byte counts in the test; starter SVGs may still be present until Task 9.

Commit:

~~~powershell
git add tests/public-assets.test.ts public/Richard-Phong-Resume.pdf public/posters public/images
git commit -m "feat: add resume and preview poster assets"
~~~

Expected: one commit named `feat: add resume and preview poster assets`; Task 0 already guarantees that a fresh clone retains all five non-public source references needed for Blender regeneration and final Figma comparison.

### Task 3: Persistent Shell Seam, Fixed Navigation, and Responsive Visual System

**Files:**
- Create: `tests/site-shell.test.tsx`
- Create: `components/site-shell.tsx`
- Create: `components/site-nav.tsx`
- Create: `components/site-footer.tsx`
- Create: `components/page-hero.tsx`
- Create: `components/scene-poster.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing shell and CSS contract**

Create `tests/site-shell.test.tsx`:

~~~tsx
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteShell } from "../components/site-shell";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
}));

describe("site shell", () => {
  beforeEach(() => {
    mocks.usePathname.mockReturnValue("/projects");
  });

  it("keeps all four navigation links visible and marks the route", () => {
    const { container } = render(
      <SiteShell>
        <main>Page content</main>
      </SiteShell>,
    );

    expect(
      screen.getAllByRole("link").slice(0, 4).map((link) => link.textContent),
    ).toEqual(["Home", "Experience", "Projects", "Contact"]);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(container.firstElementChild).toHaveAttribute(
      "data-route",
      "projects",
    );
    expect(container.querySelectorAll("[data-scene-stage]")).toHaveLength(1);
  });

  it("renders the operational privacy disclosure", () => {
    render(
      <SiteShell>
        <main>Page content</main>
      </SiteShell>,
    );

    expect(
      screen.getByText(
        "Operational diagnostics only. No engagement or identity tracking.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy details." })).toHaveAttribute(
      "href",
      "/contact#privacy",
    );
  });

  it("defines the fixed, light-only, mobile-visible shell in CSS", () => {
    const css = readFileSync("app/globals.css", "utf8");

    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).toMatch(/\.site-nav\s*\{[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.scene-stage\s*\{[\s\S]*height:\s*100svh/);
    expect(css).toMatch(/\.page-hero\s*\{[\s\S]*min-height:\s*calc\(100svh/);
    expect(css).toMatch(/\.content-surface\s*\{[\s\S]*background:\s*#eeeeee/i);
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });
});
~~~

- [ ] **Step 2: Run the shell test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/site-shell.test.tsx
~~~

Expected: FAIL with a module-resolution error containing `components/site-shell`.

- [ ] **Step 3: Implement the complete shell components**

Create `components/site-nav.tsx`:

~~~tsx
import Link from "next/link";
import { routes, type RouteKey } from "../content/site-content";

type SiteNavProps = {
  activeRoute: RouteKey;
};

export function SiteNav({ activeRoute }: SiteNavProps) {
  return (
    <header className="site-nav">
      <nav aria-label="Primary navigation" className="site-nav__inner">
        {routes.map((route) => (
          <Link
            aria-current={activeRoute === route.key ? "page" : undefined}
            className="site-nav__link"
            href={route.href}
            key={route.key}
          >
            {route.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
~~~

Create `components/site-footer.tsx`:

~~~tsx
import Link from "next/link";
import { footer } from "../content/site-content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        {footer.disclosure}{" "}
        <Link href={footer.privacyHref}>Privacy details.</Link>
      </p>
    </footer>
  );
}
~~~

Create `components/site-shell.tsx`:

~~~tsx
"use client";

import { usePathname } from "next/navigation";
import { routeKeyFromPathname } from "../content/site-content";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

type SiteShellProps = {
  children: React.ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  const activeRoute = routeKeyFromPathname(usePathname());

  return (
    <div className="site-shell" data-route={activeRoute}>
      <div aria-hidden="true" className="scene-stage" data-scene-stage />
      <SiteNav activeRoute={activeRoute} />
      <div className="site-shell__content">{children}</div>
      <SiteFooter />
    </div>
  );
}
~~~

Create `components/scene-poster.tsx`:

~~~tsx
import Image from "next/image";

type ScenePosterProps = {
  src: string;
  alt?: string;
  priority?: boolean;
  className?: string;
};

export function ScenePoster({
  src,
  alt = "",
  priority = false,
  className = "",
}: ScenePosterProps) {
  return (
    <figure
      aria-hidden={alt === "" ? "true" : undefined}
      className={`scene-poster ${className}`.trim()}
      data-scene-poster={src}
    >
      <Image
        alt={alt}
        className="scene-poster__image"
        fill
        priority={priority}
        sizes="(max-width: 720px) 100vw, 72vw"
        src={src}
      />
    </figure>
  );
}
~~~

Create `components/page-hero.tsx`:

~~~tsx
import { ScenePoster } from "./scene-poster";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  summary: string;
  poster: string;
  sceneId: string;
  titleStyle?: "rounded" | "editorial";
};

export function PageHero({
  eyebrow,
  title,
  summary,
  poster,
  sceneId,
  titleStyle = "rounded",
}: PageHeroProps) {
  return (
    <section
      className={`page-hero page-hero--${titleStyle}`}
      data-scene-id={sceneId}
    >
      <ScenePoster className="page-hero__poster" priority src={poster} />
      <div className="page-hero__wash" aria-hidden="true" />
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-hero__summary">{summary}</p>
      </div>
      <a className="scroll-cue" href="#page-content">
        Continue
      </a>
    </section>
  );
}
~~~

- [ ] **Step 4: Replace the root layout and global CSS**

Replace `app/layout.tsx` completely:

~~~tsx
import { Fraunces, Nunito_Sans } from "next/font/google";
import { SiteShell } from "../components/site-shell";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} ${fraunces.variable}`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
~~~

Replace `app/globals.css` completely:

~~~css
:root {
  color-scheme: light;
  --nav-height: 4.75rem;
  --content-max: 76rem;
  --route-background: #9eccc0;
  --route-accent: #135946;
  --route-pale-heading: #ffffff;
  --surface: #eeeeee;
  --text: #505050;
  --text-strong: #282828;
  --hairline: rgb(40 40 40 / 0.18);
  --page-gutter: clamp(1.25rem, 4vw, 4.5rem);
}

* {
  box-sizing: border-box;
}

html {
  min-width: 20rem;
  background: #9eccc0;
}

body {
  min-height: 100vh;
  margin: 0;
  background: var(--route-background);
  color: var(--text);
  font-family: var(--font-body), "Trebuchet MS", sans-serif;
  font-size: 1rem;
  line-height: 1.65;
  text-rendering: optimizeLegibility;
}

a {
  color: inherit;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

a:focus-visible,
button:focus-visible {
  outline: 0.18rem solid var(--route-accent);
  outline-offset: 0.22rem;
}

img {
  max-width: 100%;
}

.site-shell {
  --route-background: #9eccc0;
  --route-accent: #135946;
  --route-pale-heading: #ffffff;
  min-height: 100vh;
  background: var(--route-background);
}

.site-shell[data-route="experience"] {
  --route-background: #dfa9b5;
  --route-accent: #722939;
  --route-pale-heading: #fbe5ea;
}

.site-shell[data-route="projects"] {
  --route-background: #afd4e1;
  --route-accent: #285d71;
  --route-pale-heading: #edf7fb;
}

.site-shell[data-route="contact"] {
  --route-background: #c9bae4;
  --route-accent: #4b2e7e;
  --route-pale-heading: #ede6fa;
}

.scene-stage {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100svh;
  pointer-events: none;
}

.site-nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  height: var(--nav-height);
  border-bottom: 1px solid var(--hairline);
  background: var(--route-background);
}

.site-nav__inner {
  display: grid;
  grid-template-columns: repeat(4, max-content);
  justify-content: end;
  align-items: center;
  gap: clamp(1.1rem, 3vw, 3rem);
  width: min(100%, calc(var(--content-max) + 2 * var(--page-gutter)));
  height: 100%;
  margin-inline: auto;
  padding-inline: var(--page-gutter);
}

.site-nav__link {
  position: relative;
  font-size: 0.82rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-decoration: none;
  text-transform: uppercase;
}

.site-nav__link[aria-current="page"] {
  color: var(--route-accent);
}

.site-nav__link[aria-current="page"]::after {
  position: absolute;
  right: 0;
  bottom: -0.42rem;
  left: 0;
  height: 0.12rem;
  background: currentColor;
  content: "";
}

.site-shell__content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding-top: var(--nav-height);
}

.page-hero {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: calc(100svh - var(--nav-height));
  align-items: center;
  overflow: hidden;
  padding: clamp(4.5rem, 10vh, 8rem) var(--page-gutter);
  background: var(--route-background);
}

.page-hero__poster {
  position: absolute;
  inset: 0 0 0 30%;
  z-index: -3;
  min-height: 100%;
  margin: 0;
  overflow: hidden;
  opacity: 0.82;
}

.page-hero__poster .scene-poster__image {
  object-fit: cover;
  object-position: top center;
}

.page-hero__wash {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(
      90deg,
      var(--route-background) 0 30%,
      var(--route-background) 48%,
      transparent 78%
    ),
    linear-gradient(0deg, var(--route-background), transparent 35%);
  pointer-events: none;
}

.page-hero__copy {
  width: min(62rem, 100%);
  margin-inline: auto;
}

.eyebrow {
  margin: 0 0 1.15rem;
  color: var(--route-accent);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.page-hero h1 {
  max-width: 10ch;
  margin: 0;
  color: var(--route-pale-heading);
  font-family: var(--font-body), "Trebuchet MS", sans-serif;
  font-size: clamp(4.25rem, 13vw, 10.5rem);
  font-weight: 850;
  letter-spacing: -0.055em;
  line-height: 0.82;
  text-wrap: balance;
}

.page-hero--editorial h1 {
  font-family: var(--font-display), Georgia, serif;
  font-weight: 650;
  letter-spacing: -0.07em;
}

.page-hero__summary {
  max-width: 35rem;
  margin: clamp(2rem, 5vh, 3.5rem) 0 0;
  color: var(--route-accent);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  font-weight: 650;
  line-height: 1.45;
}

.scroll-cue {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  color: var(--route-accent);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-decoration: none;
  text-transform: uppercase;
  transform: translateX(-50%);
}

.content-surface {
  position: relative;
  z-index: 2;
  background: #eeeeee;
}

.content-inner {
  width: min(100%, calc(var(--content-max) + 2 * var(--page-gutter)));
  margin-inline: auto;
  padding: clamp(4.5rem, 9vw, 8.5rem) var(--page-gutter);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: clamp(2rem, 7vw, 7rem);
  align-items: start;
}

.section-kicker {
  margin: 0 0 0.8rem;
  color: var(--route-accent);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.section-heading,
.chapter-heading {
  margin: 0;
  color: var(--text-strong);
  font-family: var(--font-display), Georgia, serif;
  font-size: clamp(2.4rem, 6vw, 5.8rem);
  font-weight: 620;
  letter-spacing: -0.055em;
  line-height: 0.95;
}

.prose {
  max-width: 45rem;
  font-size: clamp(1.06rem, 1.5vw, 1.23rem);
}

.prose > :first-child {
  margin-top: 0;
}

.prose > :last-child {
  margin-bottom: 0;
}

.text-link {
  color: var(--route-accent);
  font-weight: 800;
}

.link-cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.5rem;
  margin-top: 2rem;
}

.owner-gate {
  margin-top: 2rem;
  padding: 1rem 1.1rem;
  border-left: 0.24rem solid var(--route-accent);
  background: rgb(255 255 255 / 0.52);
  color: var(--route-accent);
  font-size: 0.9rem;
  font-weight: 700;
}

.chapter-list {
  display: grid;
  gap: clamp(4rem, 10vw, 9rem);
}

.chapter {
  scroll-margin-top: calc(var(--nav-height) + 2rem);
}

.chapter-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: clamp(2rem, 6vw, 6rem);
  align-items: center;
}

.chapter:nth-child(even) .chapter-layout > :first-child {
  order: 2;
}

.scene-poster {
  position: relative;
  min-height: clamp(20rem, 50vw, 39rem);
  margin: 0;
  overflow: hidden;
  border-radius: 0.35rem;
  background: var(--route-background);
  box-shadow: 0 1.5rem 4rem rgb(40 40 40 / 0.12);
}

.scene-poster__image {
  object-fit: cover;
  object-position: top center;
}

.role-list {
  display: grid;
  gap: 0.65rem;
  margin: 1.5rem 0 2rem;
  padding: 0;
  list-style: none;
}

.role-entry {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  justify-content: space-between;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--hairline);
}

.role-entry strong {
  color: var(--text-strong);
}

.technical-line {
  margin-top: 1.4rem;
  color: var(--route-accent);
  font-size: 0.83rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.contact-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 2.5rem 0 0;
  padding: 0;
  list-style: none;
}

.contact-card {
  display: grid;
  gap: 0.25rem;
  min-height: 8.5rem;
  align-content: center;
  padding: 1.25rem;
  border: 1px solid var(--hairline);
  background: rgb(255 255 255 / 0.45);
  text-decoration: none;
}

.contact-card strong {
  color: var(--route-accent);
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.privacy-panel {
  margin-top: clamp(4rem, 8vw, 7rem);
  padding-top: 2rem;
  border-top: 1px solid var(--hairline);
  scroll-margin-top: calc(var(--nav-height) + 2rem);
}

.site-footer {
  position: relative;
  z-index: 2;
  padding: 1.35rem var(--page-gutter);
  border-top: 1px solid var(--hairline);
  background: var(--route-background);
  color: var(--route-accent);
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
}

.site-footer p {
  margin: 0;
}

@media (max-width: 720px) {
  :root {
    --nav-height: 4.25rem;
    --page-gutter: 1.15rem;
  }

  .site-nav__inner {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.35rem;
    justify-content: stretch;
    padding-inline: 0.8rem;
  }

  .site-nav__link {
    font-size: clamp(0.59rem, 2.55vw, 0.72rem);
    letter-spacing: 0.035em;
    text-align: center;
    white-space: nowrap;
  }

  .page-hero {
    align-items: end;
    min-height: calc(100svh - var(--nav-height));
    padding-top: 44svh;
    padding-bottom: 5.5rem;
  }

  .page-hero__poster {
    inset: 0;
    height: 62svh;
    min-height: 0;
    opacity: 0.54;
  }

  .page-hero__wash {
    background: linear-gradient(
      0deg,
      var(--route-background) 0 42%,
      var(--route-background) 70%,
      transparent
    );
  }

  .page-hero h1 {
    font-size: clamp(3.8rem, 20vw, 6.5rem);
  }

  .content-grid,
  .chapter-layout {
    grid-template-columns: 1fr;
  }

  .chapter:nth-child(even) .chapter-layout > :first-child {
    order: initial;
  }

  .scene-poster {
    min-height: min(78vw, 28rem);
  }

  .contact-list {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
~~~

- [ ] **Step 5: Run the shell test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/site-shell.test.tsx
~~~

Expected: PASS with 3 tests.

- [ ] **Step 6: Refactor-check type and CSS boundaries, then commit**

Run:

~~~powershell
npm run test:unit -- tests/site-content.test.ts tests/site-shell.test.tsx
npm run lint
~~~

Expected: both commands PASS. The shell contains exactly one `data-scene-stage`; there is no canvas, WebGL import, animation library, dark-mode media query, mobile menu, or route-transition code.

Commit:

~~~powershell
git add components app/layout.tsx app/globals.css tests/site-shell.test.tsx
git commit -m "feat: add fixed poster-first site shell"
~~~

Expected: one commit named `feat: add fixed poster-first site shell`.

### Task 4: Home Route

**Files:**
- Create: `tests/home-page.test.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the failing Home-page contract**

Create `tests/home-page.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";
import { getOwnerGatedFields, home } from "../content/site-content";

describe("Home page", () => {
  it("leads with Richard's personal home rather than a résumé pitch", () => {
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
    expect(container.querySelector("[data-scene-id='home-hero']")).not.toBeNull();
    expect(screen.getByText(home.nonWorkInterest)).toBeInTheDocument();
    expect(screen.getByText(home.technicalCuriosity)).toBeInTheDocument();
    const ownerGate = container.querySelector("[data-owner-gated-fields]");
    if (getOwnerGatedFields(home).length > 0) {
      expect(ownerGate).toHaveTextContent(
        "Richard will replace these two marked lines with his own words before production.",
      );
    } else {
      expect(ownerGate).not.toHaveTextContent(
        "Richard will replace these two marked lines with his own words before production.",
      );
    }
    expect(container.textContent).not.toMatch(/skills|resume bullets/i);
  });

  it("links quietly to the rest of the personal home", () => {
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
~~~

- [ ] **Step 2: Run the Home test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/home-page.test.tsx
~~~

Expected: FAIL because the current page still renders `SkeletonPreview`; the `Richard Phong` heading is absent.

- [ ] **Step 3: Replace the starter page with the complete Home route**

Replace `app/page.tsx` completely:

~~~tsx
import Link from "next/link";
import { PageHero } from "../components/page-hero";
import {
  getOwnerGatedFields,
  home,
  routeByKey,
} from "../content/site-content";

const route = routeByKey.home;
const unresolvedOwnerFields = getOwnerGatedFields(home);

export default function HomePage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        poster={route.heroPoster}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
        titleStyle="editorial"
      />

      <section className="content-surface" id="page-content">
        <div className="content-inner content-grid">
          <div>
            <p className="section-kicker">A little context</p>
            <h2 className="section-heading">Welcome to my corner.</h2>
          </div>

          <div className="prose">
            <p>{home.introduction}</p>
            <p>
              <strong>{home.currentRole}</strong>
            </p>
            <div className="link-cluster" aria-label="Explore Richard's site">
              {home.links.map((link) => {
                const external = link.href.startsWith("https://");
                return (
                  <Link
                    className="text-link"
                    href={link.href}
                    key={link.href}
                    rel={external ? "noreferrer" : undefined}
                    target={external ? "_blank" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div
              className="owner-gate"
              data-owner-gated-fields="home.nonWorkInterest home.technicalCuriosity"
            >
              <p>{home.nonWorkInterest}</p>
              <p>{home.technicalCuriosity}</p>
              {unresolvedOwnerFields.length > 0 ? (
                <p>{home.ownerDraftMessage}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
~~~

- [ ] **Step 4: Run the Home test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/home-page.test.tsx
~~~

Expected: PASS with 2 tests.

- [ ] **Step 5: Refactor-check and commit**

Run:

~~~powershell
npm run test:unit -- tests/home-page.test.tsx tests/site-shell.test.tsx tests/site-content.test.ts
npm run lint
~~~

Expected: both commands PASS; `app/page.tsx` contains no client directive, canvas, animation code, or starter-preview import.

Commit:

~~~powershell
git add app/page.tsx tests/home-page.test.tsx
git commit -m "feat: build personal home route"
~~~

Expected: one commit named `feat: build personal home route`.

### Task 5: Experience Route

**Files:**
- Create: `tests/experience-page.test.tsx`
- Create: `app/experience/page.tsx`

- [ ] **Step 1: Write the failing Experience-page contract**

Create `tests/experience-page.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExperiencePage from "../app/experience/page";

describe("Experience page", () => {
  it("renders company chapters and nested roles in approved order", () => {
    const { container } = render(<ExperiencePage />);
    const text = container.textContent ?? "";

    expect(screen.getByRole("heading", { level: 1, name: "Experience" })).toBeInTheDocument();
    expect(text.indexOf("NASA")).toBeLessThan(text.indexOf("EOG Resources"));
    expect(text.indexOf("EOG Resources")).toBeLessThan(text.indexOf("Paycom"));
    expect(
      screen.getAllByText("Software Developer Intern", { exact: true }),
    ).toHaveLength(4);
    expect(screen.getByText("2025–Present")).toBeInTheDocument();
    expect(screen.getByText("2024", { exact: true })).toBeInTheDocument();
  });

  it("keeps verified outcomes in first-person paragraphs", () => {
    const { container } = render(<ExperiencePage />);

    expect(screen.getByText(/Artemis III preparation/)).toBeInTheDocument();
    expect(screen.getByText(/40–50 seconds to 1–2 seconds/)).toBeInTheDocument();
    expect(screen.getByText(/more than 15,000 packages each week/)).toBeInTheDocument();
    expect(container.querySelector("[data-scene-id='experience-intro']")).not.toBeNull();
    expect(screen.queryByText(/Who let the intern out/i)).not.toBeInTheDocument();
  });

  it("offers the unchanged public résumé", () => {
    render(<ExperiencePage />);

    expect(screen.getByRole("link", { name: "Download my résumé" })).toHaveAttribute(
      "href",
      "/Richard-Phong-Resume.pdf",
    );
    expect(screen.getByRole("link", { name: "Download my résumé" })).toHaveAttribute(
      "download",
    );
  });
});
~~~

- [ ] **Step 2: Run the Experience test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/experience-page.test.tsx
~~~

Expected: FAIL with a module-resolution error containing `app/experience/page`.

- [ ] **Step 3: Implement the complete Experience route**

Create `app/experience/page.tsx`:

~~~tsx
import { PageHero } from "../../components/page-hero";
import { ScenePoster } from "../../components/scene-poster";
import { contact, experience, routeByKey } from "../../content/site-content";

const route = routeByKey.experience;

export default function ExperiencePage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        poster={route.heroPoster}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
      />

      <article className="content-surface" id="page-content">
        <div className="content-inner">
          <header
            className="content-grid"
            data-required-live="true"
            data-scene-id="experience-intro"
          >
            <div>
              <p className="section-kicker">The through line</p>
              <h2 className="section-heading">Learning by building what matters.</h2>
            </div>
            <div className="prose">
              <p>
                I think about my experience as a set of company chapters rather
                than a list of disconnected tasks. Each one changed the scale,
                stakes, or audience of the software I was learning to build.
              </p>
              <a
                className="text-link"
                download
                href={contact.resumeHref}
              >
                Download my résumé
              </a>
            </div>
          </header>

          <div className="chapter-list">
            {experience.map((chapter) => (
              <section
                className="chapter"
                data-required-live={chapter.requiredLive}
                data-scene-id={chapter.sceneId}
                id={chapter.id}
                key={chapter.id}
              >
                <div className="chapter-layout">
                  <ScenePoster src={chapter.poster} />
                  <div>
                    <p className="section-kicker">Company chapter</p>
                    <h2 className="chapter-heading">{chapter.company}</h2>
                    <ul className="role-list" aria-label={`${chapter.company} roles`}>
                      {chapter.roles.map((role) => (
                        <li
                          className="role-entry"
                          key={`${role.title}-${role.dates}`}
                        >
                          <strong>{role.title}</strong>
                          <span>{role.dates}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="prose">
                      {chapter.narrative.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}
~~~

- [ ] **Step 4: Run the Experience test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/experience-page.test.tsx
~~~

Expected: PASS with 3 tests.

- [ ] **Step 5: Refactor-check and commit**

Run:

~~~powershell
npm run test:unit -- tests/experience-page.test.tsx tests/site-content.test.ts
npm run lint
~~~

Expected: both commands PASS. The page contains three company sections, NASA is the only required-live company scene in this foundation data, and EOG/Paycom remain poster-first.

Commit:

~~~powershell
git add app/experience/page.tsx tests/experience-page.test.tsx
git commit -m "feat: add narrative experience route"
~~~

Expected: one commit named `feat: add narrative experience route`.

### Task 6: Projects Route

**Files:**
- Create: `tests/projects-page.test.tsx`
- Create: `app/projects/page.tsx`

- [ ] **Step 1: Write the failing Projects-page contract**

Create `tests/projects-page.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectsPage from "../app/projects/page";

describe("Projects page", () => {
  it("presents League Ban Site before Froggie without project years", () => {
    const { container } = render(<ProjectsPage />);
    const text = container.textContent ?? "";

    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    expect(text.indexOf("League Ban Site")).toBeLessThan(
      text.indexOf("Froggie Adventures"),
    );
    expect(text).not.toMatch(/\b20(1\d|2[0-4])\b/);
  });

  it("centers personality and teamwork while keeping technical facts compact", () => {
    render(<ProjectsPage />);

    expect(screen.getByText(/I was already playing League of Legends/i)).toBeInTheDocument();
    expect(screen.getByText(/helped lead a three-person team/i)).toBeInTheDocument();
    expect(screen.getByText(/Node\.js · Express · EJS/)).toBeInTheDocument();
    expect(screen.getByText(/Unity · C# · three-person team/)).toBeInTheDocument();
  });

  it("links to both repositories without embedding the Unity build", () => {
    const { container } = render(<ProjectsPage />);

    expect(
      screen.getByRole("link", { name: "View League Ban Site on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/rphong/LeagueBanSite");
    expect(
      screen.getByRole("link", { name: "View Froggie Adventures on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/rphong/Froggie");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-scene-id='froggie-adventures']")).not.toBeNull();
  });
});
~~~

- [ ] **Step 2: Run the Projects test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/projects-page.test.tsx
~~~

Expected: FAIL with a module-resolution error containing `app/projects/page`.

- [ ] **Step 3: Implement the complete Projects route**

Create `app/projects/page.tsx`:

~~~tsx
import { PageHero } from "../../components/page-hero";
import { ScenePoster } from "../../components/scene-poster";
import { projects, routeByKey } from "../../content/site-content";

const route = routeByKey.projects;

export default function ProjectsPage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        poster={route.heroPoster}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
      />

      <article className="content-surface" id="page-content">
        <div className="content-inner">
          <header className="content-grid">
            <div>
              <p className="section-kicker">Formative favorites</p>
              <h2 className="section-heading">Projects with a point of view.</h2>
            </div>
            <div className="prose">
              <p>
                These are not meant to be polished flagship case studies. I keep
                them here because they show the moments when software connected
                with something I already cared about, or became more meaningful
                through the people building it with me.
              </p>
            </div>
          </header>

          <div className="chapter-list">
            {projects.map((project) => (
              <section
                className="chapter"
                data-required-live={project.requiredLive}
                data-scene-id={project.sceneId}
                id={project.id}
                key={project.id}
              >
                <div className="chapter-layout">
                  <ScenePoster
                    alt={project.posterAlt}
                    src={project.poster}
                  />
                  <div>
                    <p className="section-kicker">Creative project</p>
                    <h2 className="chapter-heading">{project.name}</h2>
                    <div className="prose">
                      <p>{project.reflection}</p>
                    </div>
                    <p className="technical-line">{project.technicalLine}</p>
                    <a
                      className="text-link"
                      href={project.repository}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View {project.name} on GitHub
                    </a>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}
~~~

- [ ] **Step 4: Run the Projects test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/projects-page.test.tsx
~~~

Expected: PASS with 3 tests.

- [ ] **Step 5: Refactor-check and commit**

Run:

~~~powershell
npm run test:unit -- tests/projects-page.test.tsx tests/site-content.test.ts
npm run lint
~~~

Expected: both commands PASS. The page has no year field, no Unity iframe, no Riot-owned champion/item art, and both sections expose required-live scene seams for the later 3D plan.

Commit:

~~~powershell
git add app/projects/page.tsx tests/projects-page.test.tsx
git commit -m "feat: add personality-first projects route"
~~~

Expected: one commit named `feat: add personality-first projects route`.

### Task 7: Contact Route and Privacy Disclosure

**Files:**
- Create: `tests/contact-page.test.tsx`
- Create: `app/contact/page.tsx`

- [ ] **Step 1: Write the failing Contact-page contract**

Create `tests/contact-page.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContactPage from "../app/contact/page";

describe("Contact page", () => {
  it("renders every approved public contact action", () => {
    render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /richard\.phong424@gmail\.com/ })).toHaveAttribute(
      "href",
      "mailto:richard.phong424@gmail.com",
    );
    expect(screen.getByRole("link", { name: /linkedin\.com\/in\/richard-phong/ })).toHaveAttribute(
      "href",
      "https://linkedin.com/in/richard-phong/",
    );
    expect(screen.getByRole("link", { name: /github\.com\/rphong/ })).toHaveAttribute(
      "href",
      "https://github.com/rphong",
    );
    expect(screen.getByRole("link", { name: /281-777-6437/ })).toHaveAttribute(
      "href",
      "tel:+12817776437",
    );
  });

  it("offers the résumé and explains operational-only telemetry", () => {
    render(<ContactPage />);

    expect(screen.getByRole("link", { name: "Download résumé" })).toHaveAttribute(
      "href",
      "/Richard-Phong-Resume.pdf",
    );
    expect(screen.getByRole("link", { name: "Download résumé" })).toHaveAttribute(
      "download",
    );
    expect(screen.getByRole("heading", { name: "Privacy, plainly." })).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare and Sentry only for sampled performance and error diagnostics/)).toBeInTheDocument();
    expect(screen.getByText(/does not attach contact details/)).toBeInTheDocument();
    expect(screen.getByText(/future 3D preference stays on this device/)).toBeInTheDocument();
  });

  it("does not add a contact form", () => {
    const { container } = render(<ContactPage />);

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("[data-scene-id='contact-hero']")).not.toBeNull();
  });
});
~~~

- [ ] **Step 2: Run the Contact test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/contact-page.test.tsx
~~~

Expected: FAIL with a module-resolution error containing `app/contact/page`.

- [ ] **Step 3: Implement the complete Contact route**

Create `app/contact/page.tsx`:

~~~tsx
import { PageHero } from "../../components/page-hero";
import { contact, routeByKey } from "../../content/site-content";

const route = routeByKey.contact;

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        poster={route.heroPoster}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
      />

      <section className="content-surface" id="page-content">
        <div className="content-inner">
          <div className="content-grid">
            <div>
              <p className="section-kicker">Direct lines</p>
              <h2 className="section-heading">Let's get in touch.</h2>
            </div>
            <div className="prose">
              <p>{contact.introduction}</p>
              <a
                className="text-link"
                download
                href={contact.resumeHref}
              >
                Download résumé
              </a>
            </div>
          </div>

          <ul className="contact-list" aria-label="Contact Richard">
            {contact.actions.map((action) => {
              const external = action.href.startsWith("https://");
              return (
                <li key={action.href}>
                  <a
                    className="contact-card"
                    href={action.href}
                    rel={external ? "noreferrer" : undefined}
                    target={external ? "_blank" : undefined}
                  >
                    <strong>{action.label}</strong>
                    <span>{action.display}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          <section className="privacy-panel prose" id="privacy">
            <p className="section-kicker">Operational telemetry</p>
            <h2 className="chapter-heading">Privacy, plainly.</h2>
            <p>{contact.privacy}</p>
          </section>
        </div>
      </section>
    </main>
  );
}
~~~

- [ ] **Step 4: Run the Contact test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/contact-page.test.tsx
~~~

Expected: PASS with 3 tests.

- [ ] **Step 5: Refactor-check and commit**

Run:

~~~powershell
npm run test:unit -- tests/contact-page.test.tsx tests/site-content.test.ts
npm run lint
~~~

Expected: both commands PASS. Contact has only links, no form, no tracking event handlers, and no identity-dependent code.

Commit:

~~~powershell
git add app/contact/page.tsx tests/contact-page.test.tsx
git commit -m "feat: add direct contact route"
~~~

Expected: one commit named `feat: add direct contact route`.

### Task 8: Preview-Safe Metadata, Robots, Sitemap, and Rendered HTML

**Files:**
- Create: `tests/deployment-metadata.test.ts`
- Create: `lib/deployment.ts`
- Create: `lib/site-metadata.ts`
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/experience/page.tsx`
- Modify: `app/projects/page.tsx`
- Modify: `app/contact/page.tsx`

- [ ] **Step 1: Write the failing deployment and metadata unit contract**

Create `tests/deployment-metadata.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { resolveDeployment } from "../lib/deployment";
import {
  createPageMetadata,
  createRobots,
  createSitemap,
} from "../lib/site-metadata";

describe("deployment metadata", () => {
  it("defaults every unspecified deployment to a non-indexed preview", () => {
    expect(resolveDeployment({})).toEqual({
      kind: "preview",
      siteUrl: null,
    });

    const metadata = createPageMetadata("home", {});
    expect(metadata.title).toBe("Richard Phong");
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.metadataBase).toBeUndefined();
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
  });

  it("emits canonical route metadata only for explicit production", () => {
    const env = {
      SITE_ENV: "production",
      SITE_URL: "https://richardphong.dev",
    };

    const metadata = createPageMetadata("experience", env);
    expect(metadata.title).toBe("Experience | Richard Phong");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.metadataBase?.toString()).toBe("https://richardphong.dev/");
    expect(metadata.alternates?.canonical?.toString()).toBe(
      "https://richardphong.dev/experience",
    );
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
    expect(createSitemap(env).map(({ url }) => url)).toEqual([
      "https://richardphong.dev/",
      "https://richardphong.dev/experience",
      "https://richardphong.dev/projects",
      "https://richardphong.dev/contact",
    ]);
  });
});
~~~

- [ ] **Step 2: Replace the skeleton test with the failing initial-HTML contract**

Replace `tests/rendered-html.test.mjs` completely:

~~~js
import assert from "node:assert/strict";
import test from "node:test";

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
  const nav = html.match(/<nav[^>]*aria-label=["']Primary navigation["'][\s\S]*?<\/nav>/i);
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
  assert.match(html, /Owner wording|required before production|replace these two marked lines/i);
  assert.match(html, /Operational diagnostics only/);
});

test("server-renders Experience in approved company order", async () => {
  const response = await render("/experience");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Experience \| Richard Phong");
  assertOrdered(html, ["NASA", "EOG Resources", "Paycom"]);
  assert.match(html, /Artemis III preparation/);
  assert.match(html, /40–50 seconds to 1–2 seconds/);
  assert.match(html, /href="\/Richard-Phong-Resume\.pdf"/);
});

test("server-renders Projects in approved project order", async () => {
  const response = await render("/projects");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Projects \| Richard Phong");
  assertOrdered(html, ["League Ban Site", "Froggie Adventures"]);
  assert.match(html, /https:\/\/github\.com\/rphong\/LeagueBanSite/);
  assert.match(html, /https:\/\/github\.com\/rphong\/Froggie/);
  assert.doesNotMatch(html, /<iframe\b/i);
});

test("server-renders every Contact action and privacy disclosure", async () => {
  const response = await render("/contact");
  assert.equal(response.status, 200);

  const html = await response.text();
  assertPreviewDocument(html, "Contact \| Richard Phong");
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
~~~

- [ ] **Step 3: Run the metadata and rendered contracts and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/deployment-metadata.test.ts
~~~

Expected: FAIL with a module-resolution error containing `lib/deployment`.

Then run:

~~~powershell
npm run test:html
~~~

Expected: FAIL after the Vinext build because route titles, preview robots metadata, `robots.txt`, and `sitemap.xml` are not implemented.

- [ ] **Step 4: Implement deployment resolution and metadata helpers**

Create `lib/deployment.ts`:

~~~ts
export type RuntimeEnvironment = {
  SITE_ENV?: string;
  SITE_URL?: string;
};

export type Deployment =
  | {
      kind: "preview";
      siteUrl: null;
    }
  | {
      kind: "production";
      siteUrl: URL;
    };

export function resolveDeployment(
  env: RuntimeEnvironment = process.env,
): Deployment {
  if (env.SITE_ENV !== "production") {
    return {
      kind: "preview",
      siteUrl: null,
    };
  }

  if (!env.SITE_URL) {
    throw new Error("SITE_URL is required when SITE_ENV is production.");
  }

  let siteUrl: URL;
  try {
    siteUrl = new URL(env.SITE_URL);
  } catch {
    throw new Error("SITE_URL must be a valid absolute URL.");
  }

  if (siteUrl.protocol !== "https:") {
    throw new Error("Production SITE_URL must use https.");
  }

  if (
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error("Production SITE_URL must be an origin with no path, query, or hash.");
  }

  return {
    kind: "production",
    siteUrl,
  };
}
~~~

Create `lib/site-metadata.ts`:

~~~ts
import type { Metadata, MetadataRoute } from "next";
import { routeByKey, routes, type RouteKey } from "../content/site-content";
import {
  resolveDeployment,
  type RuntimeEnvironment,
} from "./deployment";

function pageTitle(routeKey: RouteKey): string {
  return routeKey === "home"
    ? "Richard Phong"
    : `${routeByKey[routeKey].title} | Richard Phong`;
}

export function createPageMetadata(
  routeKey: RouteKey,
  env: RuntimeEnvironment = process.env,
): Metadata {
  const route = routeByKey[routeKey];
  const deployment = resolveDeployment(env);
  const title = pageTitle(routeKey);

  const base: Metadata = {
    title,
    description: route.description,
    robots:
      deployment.kind === "production"
        ? {
            index: true,
            follow: true,
          }
        : {
            index: false,
            follow: false,
            noarchive: true,
            googleBot: {
              index: false,
              follow: false,
              noimageindex: true,
            },
          },
  };

  if (deployment.kind === "preview") {
    return base;
  }

  const canonical = new URL(route.href, deployment.siteUrl);

  return {
    ...base,
    metadataBase: deployment.siteUrl,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      siteName: "Richard Phong",
      title,
      description: route.description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: route.description,
    },
  };
}

export function createRobots(
  env: RuntimeEnvironment = process.env,
): MetadataRoute.Robots {
  const deployment = resolveDeployment(env);
  if (deployment.kind === "preview") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", deployment.siteUrl).toString(),
  };
}

export function createSitemap(
  env: RuntimeEnvironment = process.env,
): MetadataRoute.Sitemap {
  const deployment = resolveDeployment(env);
  if (deployment.kind === "preview") {
    return [];
  }

  return routes.map((route) => ({
    url: new URL(route.href, deployment.siteUrl).toString(),
    changeFrequency: route.key === "home" ? "monthly" : "yearly",
    priority: route.key === "home" ? 1 : 0.7,
  }));
}
~~~

Create `app/robots.ts`:

~~~ts
import type { MetadataRoute } from "next";
import { createRobots } from "../lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return createRobots();
}
~~~

Create `app/sitemap.ts`:

~~~ts
import type { MetadataRoute } from "next";
import { createSitemap } from "../lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemap();
}
~~~

- [ ] **Step 5: Wire route metadata with exact imports and exports**

Apply these exact changes to `app/layout.tsx`:

~~~diff
+import type { Metadata } from "next";
 import { Fraunces, Nunito_Sans } from "next/font/google";
 import { SiteShell } from "../components/site-shell";
+import { createPageMetadata } from "../lib/site-metadata";
 import "./globals.css";

+export function generateMetadata(): Metadata {
+  return createPageMetadata("home");
+}
+
 export default function RootLayout({
~~~

Apply these exact changes to `app/page.tsx`:

~~~diff
+import type { Metadata } from "next";
 import Link from "next/link";
 import { PageHero } from "../components/page-hero";
 import { home, routeByKey } from "../content/site-content";
+import { createPageMetadata } from "../lib/site-metadata";

 const route = routeByKey.home;

+export function generateMetadata(): Metadata {
+  return createPageMetadata("home");
+}
+
 export default function HomePage() {
~~~

Apply these exact changes to `app/experience/page.tsx`:

~~~diff
+import type { Metadata } from "next";
 import { PageHero } from "../../components/page-hero";
 import { ScenePoster } from "../../components/scene-poster";
 import { contact, experience, routeByKey } from "../../content/site-content";
+import { createPageMetadata } from "../../lib/site-metadata";

 const route = routeByKey.experience;

+export function generateMetadata(): Metadata {
+  return createPageMetadata("experience");
+}
+
 export default function ExperiencePage() {
~~~

Apply these exact changes to `app/projects/page.tsx`:

~~~diff
+import type { Metadata } from "next";
 import { PageHero } from "../../components/page-hero";
 import { ScenePoster } from "../../components/scene-poster";
 import { projects, routeByKey } from "../../content/site-content";
+import { createPageMetadata } from "../../lib/site-metadata";

 const route = routeByKey.projects;

+export function generateMetadata(): Metadata {
+  return createPageMetadata("projects");
+}
+
 export default function ProjectsPage() {
~~~

Apply these exact changes to `app/contact/page.tsx`:

~~~diff
+import type { Metadata } from "next";
 import { PageHero } from "../../components/page-hero";
 import { contact, routeByKey } from "../../content/site-content";
+import { createPageMetadata } from "../../lib/site-metadata";

 const route = routeByKey.contact;

+export function generateMetadata(): Metadata {
+  return createPageMetadata("contact");
+}
+
 export default function ContactPage() {
~~~

Do not add a canonical URL, social image, or production hostname anywhere else. The helper is the only indexing authority.

- [ ] **Step 6: Run the metadata unit contract and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/deployment-metadata.test.ts
~~~

Expected: PASS with 5 tests.

- [ ] **Step 7: Build and run the rendered-HTML contract and verify GREEN**

Run:

~~~powershell
npm run test:html
~~~

Expected: Vinext build exits 0, then Node reports 6 passing rendered-HTML tests. The four HTML responses include meaningful copy, contain no canvas, carry `noindex, nofollow`, and omit canonical links. `robots.txt` disallows `/`; the preview sitemap contains no URLs.

- [ ] **Step 8: Refactor-check preview safety and commit**

Run:

~~~powershell
npm run test:unit -- tests/deployment-metadata.test.ts tests/site-content.test.ts
npm run lint
~~~

Expected: both commands PASS. Search the compiled HTML:

~~~powershell
Get-ChildItem dist -Recurse -File | Select-String -Pattern "canonical|index, follow|codex-preview|Starter Project"
~~~

Expected: no preview canonical, no `index, follow`, no `codex-preview`, and no starter title. A match inside source maps or framework code is not acceptable evidence; inspect any match and confirm no emitted HTML metadata violates the contract.

Commit:

~~~powershell
git add lib/deployment.ts lib/site-metadata.ts app/robots.ts app/sitemap.ts app/layout.tsx app/page.tsx app/experience/page.tsx app/projects/page.tsx app/contact/page.tsx tests/deployment-metadata.test.ts tests/rendered-html.test.mjs
git commit -m "feat: add preview-safe site metadata"
~~~

Expected: one commit named `feat: add preview-safe site metadata`.

### Task 9: Explicit Production Release Gate

**Files:**
- Create: `tests/production-validation.test.ts`
- Create: `lib/production-validation.ts`
- Create: `scripts/validate-production.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing production-validation contract**

Create `tests/production-validation.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { OWNER_INPUT_SENTINEL } from "../content/site-content";
import {
  FOUNDATION_PREVIEW_ONLY_MESSAGE,
  collectProductionConfigErrors,
  requiredPublicAssets,
} from "../lib/production-validation";

const completedOwnerFields = {
  nonWorkInterest: "I spend time on a specific activity Richard has approved.",
  technicalCuriosity:
    "I am exploring a technical curiosity Richard has approved.",
};

const unresolvedOwnerFields = {
  nonWorkInterest: `${OWNER_INPUT_SENTINEL} home.nonWorkInterest`,
  technicalCuriosity:
    `${OWNER_INPUT_SENTINEL} home.technicalCuriosity`,
};

describe("production validation", () => {
  it("rejects a preview, owner-gated copy, and the foundation asset phase", () => {
    expect(collectProductionConfigErrors({}, unresolvedOwnerFields)).toEqual([
      "SITE_ENV must equal production for a production release.",
      "Owner copy is still gated: home.nonWorkInterest.",
      "Owner copy is still gated: home.technicalCuriosity.",
      FOUNDATION_PREVIEW_ONLY_MESSAGE,
    ]);
  });

  it("leaves only the explicit asset-phase gate after config and copy resolve", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "https://richardphong.example",
        },
        completedOwnerFields,
      ),
    ).toEqual([FOUNDATION_PREVIEW_ONLY_MESSAGE]);
  });

  it("reports invalid production origins without losing other gates", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "http://richardphong.example/path",
        },
        completedOwnerFields,
      ),
    ).toEqual([
      "Production SITE_URL must use https.",
      FOUNDATION_PREVIEW_ONLY_MESSAGE,
    ]);
  });

  it("checks every foundation public artifact", () => {
    expect(requiredPublicAssets).toEqual([
      "public/Richard-Phong-Resume.pdf",
      "public/posters/home-reference.png",
      "public/posters/experience-reference.png",
      "public/posters/projects-reference.png",
      "public/posters/contact-reference.png",
      "public/images/froggie-gameplay.png",
    ]);
  });
});
~~~

- [ ] **Step 2: Run the validation test and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/production-validation.test.ts
~~~

Expected: FAIL with a module-resolution error containing `lib/production-validation`.

- [ ] **Step 3: Implement the complete validation library**

Create `lib/production-validation.ts`:

~~~ts
import { access } from "node:fs/promises";
import path from "node:path";
import {
  getOwnerGatedFields,
  home,
  type OwnerHomeFields,
} from "../content/site-content";
import {
  resolveDeployment,
  type RuntimeEnvironment,
} from "./deployment";

export const FOUNDATION_PREVIEW_ONLY_MESSAGE =
  "Foundation reference posters are preview-only; production requires deterministic scene posters and every required GLB.";

export const requiredPublicAssets = [
  "public/Richard-Phong-Resume.pdf",
  "public/posters/home-reference.png",
  "public/posters/experience-reference.png",
  "public/posters/projects-reference.png",
  "public/posters/contact-reference.png",
  "public/images/froggie-gameplay.png",
] as const;

export function collectProductionConfigErrors(
  env: RuntimeEnvironment,
  ownerFields: OwnerHomeFields = home,
): string[] {
  const errors: string[] = [];

  if (env.SITE_ENV !== "production") {
    errors.push("SITE_ENV must equal production for a production release.");
  } else {
    try {
      resolveDeployment(env);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Production deployment configuration is invalid.",
      );
    }
  }

  errors.push(
    ...getOwnerGatedFields(ownerFields).map(
      (field) => `Owner copy is still gated: ${field}.`,
    ),
  );
  errors.push(FOUNDATION_PREVIEW_ONLY_MESSAGE);

  return errors;
}

export async function collectMissingAssetErrors(
  root = process.cwd(),
): Promise<string[]> {
  const errors: string[] = [];

  for (const relativePath of requiredPublicAssets) {
    try {
      await access(path.join(root, relativePath));
    } catch {
      errors.push(`Required public asset is missing: ${relativePath}.`);
    }
  }

  return errors;
}

export async function collectProductionValidationErrors({
  env = process.env,
  ownerFields = home,
  root = process.cwd(),
}: {
  env?: RuntimeEnvironment;
  ownerFields?: OwnerHomeFields;
  root?: string;
} = {}): Promise<string[]> {
  const [configErrors, assetErrors] = await Promise.all([
    Promise.resolve(collectProductionConfigErrors(env, ownerFields)),
    collectMissingAssetErrors(root),
  ]);

  return [...configErrors, ...assetErrors];
}
~~~

This deliberately keeps production blocked after foundation completion. The later 3D/asset plan removes `FOUNDATION_PREVIEW_ONLY_MESSAGE` only after deterministic posters and required GLBs pass their own validation.

- [ ] **Step 4: Add the executable validator and safe environment example**

Create `scripts/validate-production.ts`:

~~~ts
import { collectProductionValidationErrors } from "../lib/production-validation";

const errors = await collectProductionValidationErrors();

if (errors.length > 0) {
  console.error("Production validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Production validation passed.");
}
~~~

Create `.env.example`:

~~~dotenv
SITE_ENV=preview
SITE_URL=
~~~

Append this exact exception immediately after the existing `.env*` line in `.gitignore`:

~~~gitignore
!.env.example
~~~

- [ ] **Step 5: Run the validation unit test and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/production-validation.test.ts
~~~

Expected: PASS with 4 tests.

- [ ] **Step 6: Exercise the release command and verify the intentional gate**

Set the environment on separate PowerShell lines:

~~~powershell
$env:SITE_ENV = "production"
$env:SITE_URL = "https://richardphong.example"
npm run validate:production
~~~

Expected: command exits 1 and prints exactly three substantive gates: `home.nonWorkInterest`, `home.technicalCuriosity`, and the foundation reference-poster/required-GLB gate. It must not report the résumé or copied reference assets as missing.

Clear the temporary environment:

~~~powershell
Remove-Item Env:SITE_ENV
Remove-Item Env:SITE_URL
~~~

Expected: both environment variables are absent.

- [ ] **Step 7: Refactor-check and commit**

Run:

~~~powershell
npm run test:unit -- tests/production-validation.test.ts tests/deployment-metadata.test.ts tests/public-assets.test.ts
npm run lint
~~~

Expected: both commands PASS. Local `npm run build` remains allowed because production gating is an explicit command, not an unconditional module-load side effect.

Commit:

~~~powershell
git add .env.example .gitignore lib/production-validation.ts scripts/validate-production.ts tests/production-validation.test.ts
git commit -m "feat: add explicit production release gate"
~~~

Expected: one commit named `feat: add explicit production release gate`.

### Task 10: Starter Cleanup, Full Verification, and Working Preview

**Files:**
- Create: `tests/starter-cleanup.test.ts`
- Modify: `README.md`
- Modify: `worker/index.ts`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`
- Delete: `app/chatgpt-auth.ts`
- Delete: `db/index.ts`
- Delete: `db/schema.ts`
- Delete: `drizzle/meta/_journal.json`
- Delete: `drizzle.config.ts`
- Delete: `examples/d1/app/api/notes/route.ts`
- Delete: `examples/d1/db/schema.ts`
- Delete: `postcss.config.mjs`
- Delete: `public/favicon.svg`
- Delete: `public/file.svg`
- Delete: `public/globe.svg`
- Delete: `public/window.svg`

- [ ] **Step 1: Write the failing starter-cleanup contract**

Create `tests/starter-cleanup.test.ts`:

~~~ts
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
~~~

- [ ] **Step 2: Run the cleanup contract and verify RED**

Run:

~~~powershell
npm run test:unit -- tests/starter-cleanup.test.ts
~~~

Expected: FAIL because the starter skeleton, auth/D1 examples, README identity, Worker DB type, and SVG artwork still exist.

- [ ] **Step 3: Delete every scoped starter file with one explicit patch**

Apply this patch exactly:

~~~diff
*** Begin Patch
*** Delete File: app/_sites-preview/SkeletonPreview.tsx
*** Delete File: app/_sites-preview/preview.css
*** Delete File: app/chatgpt-auth.ts
*** Delete File: db/index.ts
*** Delete File: db/schema.ts
*** Delete File: drizzle/meta/_journal.json
*** Delete File: drizzle.config.ts
*** Delete File: examples/d1/app/api/notes/route.ts
*** Delete File: examples/d1/db/schema.ts
*** Delete File: postcss.config.mjs
*** Delete File: public/favicon.svg
*** Delete File: public/file.svg
*** Delete File: public/globe.svg
*** Delete File: public/window.svg
*** End Patch
~~~

Expected: each listed file is removed. Empty directories may remain; do not use recursive deletion.

- [ ] **Step 4: Remove starter dependencies, replace README, and remove the unused Worker DB type**

Run each dependency cleanup command separately:

~~~powershell
npm uninstall react-loading-skeleton drizzle-orm
npm uninstall --save-dev drizzle-kit tailwindcss @tailwindcss/postcss
npm pkg delete "scripts.db:generate"
~~~

Expected: all three commands exit 0; `package.json` and `package-lock.json` contain none of those packages or the obsolete `db:generate` script.

Replace `README.md` completely:

~~~md
# Richard Phong Personal Site

Richard Phong's poster-first personal home, creative work showcase, and hiring
signal. The foundation has four server-rendered routes:

- `/`
- `/experience`
- `/projects`
- `/contact`

The current slice uses approved Figma exports as preview posters and preserves a
single fixed scene-stage seam. The Three.js runtime, optimized GLBs, and
deterministic scene posters belong to the next implementation slice.

## Requirements

- Node.js 22.13.0 or newer
- npm using the committed `package-lock.json`

## Local preview

```powershell
npm ci
npm run dev
```

Vinext prints the local URL. All unspecified environments are safe previews:
they render `noindex, nofollow`, omit canonical URLs, disallow crawlers in
`robots.txt`, and publish no sitemap entries.

## Verification

```powershell
npm run test:unit
npm run lint
npm run test:html
```

`npm run test:html` creates the Cloudflare-compatible Vinext build and checks
the meaningful initial HTML for every route without relying on JavaScript or
WebGL.

## Production gate

```powershell
$env:SITE_ENV = "production"
$env:SITE_URL = "https://richardphong.example"
npm run validate:production
```

The foundation intentionally fails this gate until Richard supplies the two
owner-written Home details and the 3D asset slice replaces reference exports
with deterministic posters and validated required GLBs. The canonical résumé is
published unchanged at `/Richard-Phong-Resume.pdf`.

## Sites

`.openai/hosting.json` remains the Sites capability declaration. The project
uses the existing Vinext Vite plugin and Cloudflare Worker entry point; it does
not use D1, R2, authentication, a CMS, or a contact form.
~~~

Replace `worker/index.ts` completely:

~~~ts
/** Cloudflare Worker entry point for Richard Phong's personal site. */
import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (assetPath) =>
            env.ASSETS.fetch(new Request(new URL(assetPath, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
~~~

Append these exact Blender hygiene rules to `.gitignore`:

~~~gitignore

# Blender backups and local caches; canonical .blend sources remain tracked.
*.blend1
*.blend2
*.blend@
*.blend~
/assets/blender/.cache/
~~~

- [ ] **Step 5: Run the cleanup contract and verify GREEN**

Run:

~~~powershell
npm run test:unit -- tests/starter-cleanup.test.ts
~~~

Expected: PASS for every deleted file plus the package, identity, and Worker checks.

- [ ] **Step 6: Run the complete unit and rendered-HTML suite**

Run:

~~~powershell
npm test
~~~

Expected: all Vitest tests PASS, Vinext build exits 0, and all 6 Node rendered-HTML tests PASS.

- [ ] **Step 7: Run lint and inspect the production build surface**

Run:

~~~powershell
npm run lint
~~~

Expected: PASS with no warnings promoted to errors.

Run:

~~~powershell
Get-Item dist\server\index.js
Get-Item dist\.openai\hosting.json
~~~

Expected: both files exist. The first is the Cloudflare-compatible server entry; the second is the preserved Sites capability declaration.

- [ ] **Step 8: Commit the cleanup and verified foundation**

Commit:

~~~powershell
git add README.md worker/index.ts .gitignore package.json package-lock.json tests/starter-cleanup.test.ts
git add -- app/_sites-preview/SkeletonPreview.tsx app/_sites-preview/preview.css app/chatgpt-auth.ts db/index.ts db/schema.ts drizzle/meta/_journal.json drizzle.config.ts examples/d1/app/api/notes/route.ts examples/d1/db/schema.ts postcss.config.mjs public/favicon.svg public/file.svg public/globe.svg public/window.svg
git commit -m "chore: finish verified personal site foundation"
node --test tests/tracked-scaffold.test.mjs
git status --short
~~~

Expected: one commit named `chore: finish verified personal site foundation`; the tracked-scaffold contract still PASSes for the retained build/Sites files and all five references, and `git status --short` is empty immediately afterward.

- [ ] **Step 9: Launch the working preview without adding browser-only dependencies**

Start a retained process:

~~~powershell
npm run dev
~~~

Expected: Vinext prints one healthy local URL. Keep the process running. In a visible Codex session, open that exact URL once in the in-app browser. In a delegated or background session, do not open a browser; report the URL to the parent agent.

Verify the four route responses from a second PowerShell process, substituting the exact printed origin:

~~~powershell
$origin = "http://localhost:3000"
Invoke-WebRequest "$origin/" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest "$origin/experience" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest "$origin/projects" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest "$origin/contact" -UseBasicParsing | Select-Object StatusCode
~~~

Expected: four `StatusCode 200` results. If Vinext printed a different port, use it; never scan ports or open a second browser tab.

## Foundation Acceptance Checklist

- [ ] Home, Experience, Projects, and Contact independently return 200 and contain meaningful initial HTML.
- [ ] Fixed navigation exposes all four links on desktop and mobile CSS without a menu.
- [ ] Exact approved route palettes and light-only color scheme are present.
- [ ] Figma reference posters render as preview fallbacks; no Three.js, canvas, WebGL, transition, or animation-library code ships in this slice.
- [ ] NASA, EOG Resources, and Paycom appear in approved company/role order and use verified outcomes.
- [ ] League Ban Site and Froggie Adventures appear in approved order, without years, and focus on coding-interest and teamwork reflections.
- [ ] Email, LinkedIn, GitHub, phone, privacy disclosure, and unchanged résumé are available as semantic links.
- [ ] Preview HTML is `noindex, nofollow`, has no canonical, robots disallow crawling, and sitemap has no URLs.
- [ ] Production validation remains intentionally blocked by the two owner-gated Home fields and the deterministic-poster/required-GLB asset phase.
- [ ] Starter skeleton, starter metadata/art, optional auth/D1 examples, Tailwind, Drizzle, and loading-skeleton dependency are absent.
- [ ] The supplied Vinext/Sites scaffold, hosting declaration, build plugin, project configs, and five source references are tracked; local dependency/audit/browser output remains ignored.
- [ ] `npm test` and `npm run lint` pass, the Vinext/Sites output exists, and the retained preview serves all four routes.
