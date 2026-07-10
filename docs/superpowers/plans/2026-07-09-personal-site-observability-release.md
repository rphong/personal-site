# Observability and Release Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-bounded operational diagnostics and deterministic release gates so the poster-first site can be previewed safely and can reach production only after content, assets, accessibility, performance, metadata, and monitoring are verified.

**Architecture:** A strict shared event parser is the only path into a same-origin Worker diagnostics endpoint; the browser samples five operational event types and never sends identity, contact actions, URLs with queries, or the local 3D preference. Cloudflare Web Analytics supplies field Core Web Vitals, Sentry captures sanitized browser and uncaught Worker exceptions without replay or tracing, and local scripts turn contrast, public-artifact, WebGL, and repeatable mobile-profile checks into release gates. Preview metadata remains non-indexable, and the production validator is deliberately red until Richard supplies the two owner-written paragraphs, final hostname, monitoring credentials, evidence-backed approvals, and contrast decisions.

**Tech Stack:** TypeScript 5.9, React 19, vinext/Next App Router, Cloudflare Workers and Web Analytics, `@sentry/browser@10.64.0`, `@sentry/cloudflare@10.64.0`, `@sentry/cli@3.6.0`, Vitest 4, Testing Library, Playwright 1.61, axe-core, Sharp, Node.js 22

---

## Boundaries and prerequisites

Execute this plan after:

1. `2026-07-09-personal-site-foundation.md`
2. `2026-07-09-personal-site-assets.md`
3. `2026-07-09-personal-site-runtime.md`

Those plans establish `siteContent`, deployment metadata, the asset manifests, the persistent scene runtime, and these stable runtime hooks:

- `site:scene-runtime` carries `ready`, `failure`, `context-lost`, and `rotation-health` details.
- The scene host exposes `data-three-status` and `data-active-scene-id`.
- The bounded drag surface exposes `data-testid="scene-rotation-area"`.
- A successful first frame records `performance.mark("scene-ready:<sceneId>")`.

This plan must not add analytics for outbound links, contact actions, scroll depth, the 3D preference, or general pointer activity. It must not enable Sentry replay, browser tracing, generic Worker tracing, or default PII.

## Focused file map

### Operational diagnostics

- Create `lib/observability/operational-event.ts` — strict allow-list parser shared by browser and Worker.
- Create `app/observability/report-operational.ts` — sampled same-origin sender with injectable transport.
- Create `app/observability/OperationalTelemetry.client.tsx` — translates route and scene lifecycle signals into allowed events.
- Create `app/observability/sentry-options.ts` — sanitized, error-only browser SDK options.
- Create `app/observability/init-browser-sentry.ts` — guarded one-shot initializer used by the pre-hydration client entry.
- Create `instrumentation-client.ts` — calls the guarded initializer before React hydration.
- Create `worker/observability.ts` — validates and logs the diagnostics endpoint without request metadata.
- Modify `worker/index.ts` — routes `POST /__ops` and wraps uncaught Worker failures with Sentry.
- Modify `vite.config.ts` — conditionally emits hidden source maps only for the controlled production release build.

### Disclosure and field metrics

- Create `components/telemetry-disclosure.tsx` — concise footer disclosure plus expanded contact-page copy.
- Modify `components/site-footer.tsx` — renders the concise disclosure globally.
- Modify `app/contact/page.tsx` — renders the expanded disclosure.
- Create `app/observability/CloudflareWebAnalytics.tsx` — production-only beacon.
- Modify `app/layout.tsx` — mounts operational telemetry and the Web Analytics beacon.

### Release evidence

- Create `config/contrast-checks.json` — exact Figma token pairs and explicit owner-decision state.
- Create `scripts/quality/contrast.mjs` — WCAG ratio report and approval gate.
- Create `tests/quality/contrast.test.mjs` — ratio and decision-state tests.
- Create `tests/browser/accessibility.spec.ts` — axe checks with color handled by the dedicated gate.
- Create `scripts/quality/performance-gate.mjs` — repeatable mobile Web Vitals, first-frame, and rotation-FPS gate.
- Create `tests/quality/performance-gate.test.mjs` — threshold evaluator tests.
- Create `tests/fixtures/social-card-outlined.svg` — complete, deterministic outlined-path proposal used only after owner approval.
- Create `scripts/quality/generate-social-card.mjs` — guarded promotion and deterministic 1200x630 PNG generation.
- Create `config/public-artifacts.json` — immutable resume expectation plus an explicit pending/generated social-card state.
- Create `scripts/quality/validate-public-artifacts.mjs` — digest and image-dimension checks.
- Create `tests/browser/site-acceptance.spec.ts` and `tests/browser/visual-regression.spec.ts` — semantic acceptance now and deferred final visual baselines.
- Create `config/release-approval.json` and `scripts/quality/release-approval.mjs` — Git-index-bound, hashed production evidence.
- Create `scripts/quality/run-preview-browser.mjs` — one built-preview server for baseline and browser suites.
- Create `scripts/quality/upload-sentry-sourcemaps.mjs` — two scoped CLI uploads with counted resumable receipts.
- Create `scripts/quality/validate-release.mjs` — ordered production gate runner.
- Modify `.env.example` — documents public and private deployment values without secrets.
- Modify `package.json` and `package-lock.json` — pins diagnostics and quality dependencies and exposes gate commands.
- Create `docs/release-checklist.md` — exact preview, approval, and production procedure.

## Task 1: Lock the operational event contract

**Files:**

- Create: `lib/observability/operational-event.ts`
- Create: `tests/observability/operational-event.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Create `tests/observability/operational-event.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseOperationalEvent,
  type OperationalEvent,
} from "../../lib/observability/operational-event";

describe("parseOperationalEvent", () => {
  it("accepts and rounds the five operational event shapes", () => {
    const cases: Array<[unknown, OperationalEvent]> = [
      [
        { name: "route_load", route: "/projects", durationMs: 321.49 },
        { name: "route_load", route: "/projects", durationMs: 321 },
      ],
      [
        {
          name: "scene_load",
          route: "/experience",
          sceneId: "experience-hero",
          durationMs: 982.6,
        },
        {
          name: "scene_load",
          route: "/experience",
          sceneId: "experience-hero",
          durationMs: 983,
        },
      ],
      [
        {
          name: "scene_failure",
          route: "/projects",
          sceneId: "league-ban",
          reason: "decode",
        },
        {
          name: "scene_failure",
          route: "/projects",
          sceneId: "league-ban",
          reason: "decode",
        },
      ],
      [
        {
          name: "webgl_context_lost",
          route: "/",
          sceneId: "home-hero",
        },
        {
          name: "webgl_context_lost",
          route: "/",
          sceneId: "home-hero",
        },
      ],
      [
        {
          name: "rotation_health",
          route: "/contact",
          sceneId: "contact-hero",
          fps: 44.64,
        },
        {
          name: "rotation_health",
          route: "/contact",
          sceneId: "contact-hero",
          fps: 44.6,
        },
      ],
    ];

    for (const [input, expected] of cases) {
      expect(parseOperationalEvent(input)).toEqual(expected);
    }
  });

  it.each([
    null,
    [],
    { name: "contact_click", route: "/" },
    { name: "route_load", route: "/projects?person=richard", durationMs: 4 },
    { name: "route_load", route: "/", durationMs: -1 },
    { name: "scene_load", route: "/", durationMs: 4 },
    {
      name: "scene_failure",
      route: "/",
      sceneId: "home-hero",
      reason: "save-data",
    },
    {
      name: "rotation_health",
      route: "/",
      sceneId: "home-hero",
      fps: 241,
    },
    {
      name: "route_load",
      route: "/",
      durationMs: 4,
      sceneId: "home-hero",
    },
    {
      name: "scene_failure",
      route: "/",
      sceneId: "home-hero",
      reason: "fetch",
      durationMs: 4,
    },
    {
      name: "scene_load",
      route: "/",
      sceneId: "home-hero",
      durationMs: 4,
      email: "richard.phong424@gmail.com",
    },
  ])("rejects malformed or privacy-expanding input %#", (input) => {
    expect(parseOperationalEvent(input)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:unit -- tests/observability/operational-event.test.ts
```

Expected: FAIL because `lib/observability/operational-event.ts` does not exist.

- [ ] **Step 3: Implement the strict parser**

Create `lib/observability/operational-event.ts`:

```ts
export const operationalEventNames = [
  "route_load",
  "scene_load",
  "scene_failure",
  "webgl_context_lost",
  "rotation_health",
] as const;

export const operationalFailureReasons = [
  "fetch",
  "decode",
  "timeout",
  "webgl2-unavailable",
  "context-lost",
  "unknown",
] as const;

export type OperationalEventName = (typeof operationalEventNames)[number];
export type OperationalFailureReason =
  (typeof operationalFailureReasons)[number];

export type OperationalEvent =
  | { name: "route_load"; route: SiteRoute; durationMs: number }
  | {
      name: "scene_load";
      route: SiteRoute;
      sceneId: string;
      durationMs: number;
    }
  | {
      name: "scene_failure";
      route: SiteRoute;
      sceneId: string;
      reason: OperationalFailureReason;
    }
  | {
      name: "webgl_context_lost";
      route: SiteRoute;
      sceneId: string;
    }
  | {
      name: "rotation_health";
      route: SiteRoute;
      sceneId: string;
      fps: number;
    };

export type SiteRoute = "/" | "/experience" | "/projects" | "/contact";

const routes = new Set<SiteRoute>([
  "/",
  "/experience",
  "/projects",
  "/contact",
]);
const names = new Set<string>(operationalEventNames);
const reasons = new Set<string>(operationalFailureReasons);
const sceneIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function hasSceneId(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { sceneId: string } {
  return (
    typeof value.sceneId === "string" &&
    value.sceneId.length <= 64 &&
    sceneIdPattern.test(value.sceneId)
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

export function parseOperationalEvent(
  value: unknown,
): OperationalEvent | null {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !names.has(value.name) ||
    typeof value.route !== "string" ||
    !routes.has(value.route as SiteRoute)
  ) {
    return null;
  }

  const route = value.route as SiteRoute;

  if (
    value.name === "route_load" &&
    hasExactKeys(value, ["durationMs", "name", "route"]) &&
    isFiniteNumber(value.durationMs, 0, 60_000)
  ) {
    return {
      name: "route_load",
      route,
      durationMs: Math.round(value.durationMs),
    };
  }

  if (
    value.name === "scene_load" &&
    hasExactKeys(value, ["durationMs", "name", "route", "sceneId"]) &&
    hasSceneId(value) &&
    isFiniteNumber(value.durationMs, 0, 60_000)
  ) {
    return {
      name: "scene_load",
      route,
      sceneId: value.sceneId,
      durationMs: Math.round(value.durationMs),
    };
  }

  if (
    value.name === "scene_failure" &&
    hasExactKeys(value, ["name", "reason", "route", "sceneId"]) &&
    hasSceneId(value) &&
    typeof value.reason === "string" &&
    reasons.has(value.reason)
  ) {
    return {
      name: "scene_failure",
      route,
      sceneId: value.sceneId,
      reason: value.reason as OperationalFailureReason,
    };
  }

  if (
    value.name === "webgl_context_lost" &&
    hasExactKeys(value, ["name", "route", "sceneId"]) &&
    hasSceneId(value)
  ) {
    return {
      name: "webgl_context_lost",
      route,
      sceneId: value.sceneId,
    };
  }

  if (
    value.name === "rotation_health" &&
    hasExactKeys(value, ["fps", "name", "route", "sceneId"]) &&
    hasSceneId(value) &&
    isFiniteNumber(value.fps, 0, 240)
  ) {
    return {
      name: "rotation_health",
      route,
      sceneId: value.sceneId,
      fps: Math.round(value.fps * 10) / 10,
    };
  }

  return null;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm run test:unit -- tests/observability/operational-event.test.ts
```

Expected: PASS with 10 accepted/rejected contract cases and no snapshot updates.

- [ ] **Step 5: Commit the contract**

```bash
git add lib/observability/operational-event.ts tests/observability/operational-event.test.ts
git commit -m "test: lock operational telemetry contract"
```

## Task 2: Add a sampled, injectable browser sender

**Files:**

- Create: `app/observability/report-operational.ts`
- Create: `tests/observability/report-operational.test.ts`

- [ ] **Step 1: Write the failing sender tests**

Create `tests/observability/report-operational.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createOperationalReporter,
  isOperationalVisitEligible,
} from "../../app/observability/report-operational";

const validEvent = {
  name: "scene_load" as const,
  route: "/projects" as const,
  sceneId: "projects-hero",
  durationMs: 410,
};

describe("createOperationalReporter", () => {
  it("draws once per page visit and keeps that decision for every event", () => {
    const send = vi.fn();
    const random = vi.fn(() => 0.049);
    const report = createOperationalReporter({
      enabled: true,
      sampleRate: 0.05,
      random,
      send,
    });

    expect(report(validEvent)).toBe(true);
    expect(report({ ...validEvent, durationMs: 520 })).toBe(true);

    expect(random).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual(validEvent);
  });

  it.each([
    { enabled: false, sampleRate: 1, draw: 0 },
    { enabled: true, sampleRate: 0.05, draw: 0.05 },
    { enabled: true, sampleRate: Number.NaN, draw: 0 },
    { enabled: true, sampleRate: 0.05, draw: Number.NaN },
  ])("keeps a disabled or unselected visit unsampled %#", (testCase) => {
    const send = vi.fn();
    const random = vi.fn(() => testCase.draw);
    const report = createOperationalReporter({
      enabled: testCase.enabled,
      sampleRate: testCase.sampleRate,
      random,
      send,
    });

    expect(report(validEvent)).toBe(false);
    expect(report({ ...validEvent, durationMs: 520 })).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(random).toHaveBeenCalledTimes(testCase.enabled ? 1 : 0);
  });

  it("rejects expanded data even on a selected visit", () => {
    const send = vi.fn();
    const report = createOperationalReporter({
      enabled: true,
      sampleRate: 1,
      random: () => 0,
      send,
    });

    expect(
      report({ ...validEvent, referrer: "https://example.com/private" }),
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("requires a production visit with no query, fragment, or inbound referrer", () => {
    const clean = {
      siteEnvironment: "production",
      search: "",
      hash: "",
      referrer: "",
    };
    expect(isOperationalVisitEligible(clean)).toBe(true);
    expect(
      isOperationalVisitEligible({ ...clean, search: "?email=private" }),
    ).toBe(false);
    expect(isOperationalVisitEligible({ ...clean, hash: "#private" })).toBe(
      false,
    );
    expect(
      isOperationalVisitEligible({
        ...clean,
        referrer: "https://search.invalid/?q=private",
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:unit -- tests/observability/report-operational.test.ts
```

Expected: FAIL because `reportOperationalEvent` is not defined.

- [ ] **Step 3: Implement sampling and the same-origin transport**

Create `app/observability/report-operational.ts`:

```ts
import {
  parseOperationalEvent,
  type OperationalEvent,
} from "../../lib/observability/operational-event";

export interface ReporterConfiguration {
  enabled: boolean;
  sampleRate: number;
  random: () => number;
  send: (body: string) => void;
}

export type OperationalReporter = (
  candidate: OperationalEvent | unknown,
) => boolean;

interface OperationalVisitInput {
  siteEnvironment: string | undefined;
  search: string;
  hash: string;
  referrer: string;
}

export function isOperationalVisitEligible({
  siteEnvironment,
  search,
  hash,
  referrer,
}: OperationalVisitInput): boolean {
  return (
    siteEnvironment === "production" &&
    search === "" &&
    hash === "" &&
    referrer === ""
  );
}

function sendBody(body: string): void {
  void fetch("/__ops", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    credentials: "omit",
    keepalive: true,
  }).catch(() => {});
}

export function createOperationalReporter({
  enabled,
  sampleRate,
  random,
  send,
}: ReporterConfiguration): OperationalReporter {
  const draw = enabled ? random() : Number.NaN;
  const validRate =
    Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 1;
  const selected =
    enabled &&
    validRate &&
    Number.isFinite(draw) &&
    draw >= 0 &&
    draw < sampleRate;

  return (candidate) => {
    const event = parseOperationalEvent(candidate);
    if (!selected || !event) {
      return false;
    }

    send(JSON.stringify(event));
    return true;
  };
}

let configuredReporter: OperationalReporter | undefined;

export function reportOperationalEvent(
  candidate: OperationalEvent | unknown,
): boolean {
  configuredReporter ??= createOperationalReporter({
    enabled: isOperationalVisitEligible({
      siteEnvironment: process.env.NEXT_PUBLIC_SITE_ENV,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
    }),
    sampleRate: 0.05,
    random: Math.random,
    send: sendBody,
  });
  return configuredReporter(candidate);
}
```

- [ ] **Step 4: Run the sender tests and verify GREEN**

Run:

```bash
npm run test:unit -- tests/observability/report-operational.test.ts
```

Expected: PASS; the injectable random source is called once per reporter, all events in that page visit share the same selection, and disabled, unselected, or key-expanded inputs make no transport call.

- [ ] **Step 5: Commit the sender**

```bash
git add app/observability/report-operational.ts tests/observability/report-operational.test.ts
git commit -m "feat: add sampled operational reporter"
```

## Task 3: Bridge runtime events and initialize error-only browser Sentry

**Files:**

- Create: `app/observability/OperationalTelemetry.client.tsx`
- Create: `app/observability/sentry-options.ts`
- Create: `app/observability/init-browser-sentry.ts`
- Create: `instrumentation-client.ts`
- Create: `tests/observability/OperationalTelemetry.test.tsx`
- Create: `tests/observability/sentry-options.test.ts`
- Create: `tests/observability/init-browser-sentry.test.ts`

- [ ] **Step 1: Install the exact browser and Worker error SDKs**

Run:

```bash
npm install --save-exact @sentry/browser@10.64.0 @sentry/cloudflare@10.64.0
```

Expected: both packages appear under `dependencies` in `package.json` and are locked exactly in `package-lock.json`.

- [ ] **Step 2: Write the failing runtime-bridge test**

Create `tests/observability/OperationalTelemetry.test.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalTelemetry } from "../../app/observability/OperationalTelemetry.client";
import { reportOperationalEvent } from "../../app/observability/report-operational";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
}));

vi.mock("../../app/observability/report-operational", () => ({
  reportOperationalEvent: vi.fn(),
}));

describe("OperationalTelemetry", () => {
  beforeEach(() => {
    vi.mocked(reportOperationalEvent).mockReset();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("maps scene lifecycle details to the strict operational contract", () => {
    render(<OperationalTelemetry />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("site:scene-runtime", {
          detail: {
            status: "ready",
            sceneId: "projects-hero",
            durationMs: 499.6,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("site:scene-runtime", {
          detail: {
            status: "rotation-health",
            sceneId: "projects-hero",
            fps: 42.2,
          },
        }),
      );
    });

    expect(reportOperationalEvent).toHaveBeenCalledWith({
      name: "scene_load",
      route: "/projects",
      sceneId: "projects-hero",
      durationMs: 499.6,
    });
    expect(reportOperationalEvent).toHaveBeenCalledWith({
      name: "rotation_health",
      route: "/projects",
      sceneId: "projects-hero",
      fps: 42.2,
    });
  });

  it("does not report preference or ordinary pointer events", () => {
    render(<OperationalTelemetry />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("site:scene-runtime", {
          detail: { status: "disabled", sceneId: "projects-hero" },
        }),
      );
      window.dispatchEvent(new PointerEvent("pointermove"));
    });

    expect(reportOperationalEvent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Write the failing Sentry-options test**

Create `tests/observability/sentry-options.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createBrowserSentryOptions } from "../../app/observability/sentry-options";

describe("createBrowserSentryOptions", () => {
  it("keeps error grouping while stripping identity, interaction, and URL data", async () => {
    const options = createBrowserSentryOptions({
      dsn: "https://public@example.invalid/1",
      environment: "production",
      release: "a".repeat(40),
    });
    const event = await options.beforeSend?.(
      {
        message: "Failed for person@example.com at https://site.invalid/contact?email=person",
        user: { email: "person@example.com" },
        request: {
          url: "https://site.invalid/contact?email=person@example.com",
          headers: { referer: "https://search.invalid" },
        },
        breadcrumbs: [
          {
            category: "ui.click",
            message: "mailto:person@example.com",
            data: { from: "/contact?email=person@example.com" },
          },
        ],
        extra: { email: "person@example.com" },
        contexts: { private: { phone: "281-777-6437" } },
        tags: { contact: "person@example.com" },
        exception: {
          values: [
            {
              type: "Error",
              value: "person@example.com failed",
              stacktrace: {
                frames: [
                  {
                    filename:
                      "https://site.invalid/app.js?email=person@example.com",
                  },
                ],
              },
            },
          ],
        },
      },
      {},
    );

    expect(options.sendDefaultPii).toBe(false);
    expect(options.release).toBe("a".repeat(40));
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sampleRate).toBe(0.1);
    expect(options.sendClientReports).toBe(false);
    expect(event?.user).toBeUndefined();
    expect(event?.request).toBeUndefined();
    expect(event?.breadcrumbs).toBeUndefined();
    expect(event?.extra).toBeUndefined();
    expect(event?.contexts).toBeUndefined();
    expect(event?.tags).toBeUndefined();
    expect(event?.message).toBe(
      "Failed for [redacted-email] at https://site.invalid/contact",
    );
    expect(event?.exception?.values?.[0]?.value).toBe(
      "[redacted-email] failed",
    );
    expect(
      event?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename,
    ).toBe("https://site.invalid/app.js");

    const integrations = (
      options.integrations as (defaults: { name: string }[]) => {
        name: string;
      }[]
    )([
      { name: "Breadcrumbs" },
      { name: "BrowserSession" },
      { name: "BrowserTracing" },
      { name: "Replay" },
      { name: "GlobalHandlers" },
    ]);
    expect(integrations.map(({ name }) => name)).toEqual(["GlobalHandlers"]);
  });
});
```

Create `tests/observability/init-browser-sentry.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createBrowserSentryInitializer } from "../../app/observability/init-browser-sentry";

describe("createBrowserSentryInitializer", () => {
  it("initializes once only for a production environment with a DSN", () => {
    const initialize = vi.fn();
    const initializeBrowserSentry =
      createBrowserSentryInitializer(initialize);
    const production = {
      NEXT_PUBLIC_SITE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
      NEXT_PUBLIC_RELEASE_ID: "a".repeat(40),
    };

    expect(initializeBrowserSentry({ NEXT_PUBLIC_SITE_ENV: "preview" })).toBe(
      false,
    );
    expect(initializeBrowserSentry(production)).toBe(true);
    expect(initializeBrowserSentry(production)).toBe(false);
    expect(initialize).toHaveBeenCalledOnce();
    expect(initialize.mock.calls[0][0]).toMatchObject({
      dsn: "https://public@example.invalid/1",
      environment: "production",
      release: "a".repeat(40),
      tracesSampleRate: 0,
    });
  });

  it("refuses production Sentry without the exact lowercase Git release ID", () => {
    const initialize = vi.fn();
    const initializeBrowserSentry =
      createBrowserSentryInitializer(initialize);
    const base = {
      NEXT_PUBLIC_SITE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
    };

    expect(initializeBrowserSentry(base)).toBe(false);
    expect(
      initializeBrowserSentry({
        ...base,
        NEXT_PUBLIC_RELEASE_ID: "release-abc",
      }),
    ).toBe(false);
    expect(
      initializeBrowserSentry({
        ...base,
        NEXT_PUBLIC_RELEASE_ID: "A".repeat(40),
      }),
    ).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });

  it("runs from the framework client instrumentation entry before hydration", async () => {
    const source = await readFile("instrumentation-client.ts", "utf8");
    expect(source).toContain(
      'import { initializeConfiguredBrowserSentry } from "./app/observability/init-browser-sentry"',
    );
    expect(source).toMatch(/initializeConfiguredBrowserSentry\(\);\s*$/);
  });
});
```

- [ ] **Step 4: Run the three focused files and verify RED**

Run:

```bash
npm run test:unit -- tests/observability/OperationalTelemetry.test.tsx tests/observability/sentry-options.test.ts tests/observability/init-browser-sentry.test.ts
```

Expected: FAIL because the bridge and options factory do not exist.

- [ ] **Step 5: Implement the runtime bridge**

Create `app/observability/OperationalTelemetry.client.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { SiteRoute } from "../../lib/observability/operational-event";
import type { SceneRuntimeEventDetail } from "../three/runtime-events";
import { reportOperationalEvent } from "./report-operational";

const routes = new Set<SiteRoute>([
  "/",
  "/experience",
  "/projects",
  "/contact",
]);

export function OperationalTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    if (!routes.has(pathname as SiteRoute)) {
      return;
    }

    const route = pathname as SiteRoute;
    const startedAt = performance.now();
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        reportOperationalEvent({
          name: "route_load",
          route,
          durationMs: performance.now() - startedAt,
        });
      });
    });

    const onSceneRuntime = (event: Event) => {
      const detail = (event as CustomEvent<SceneRuntimeEventDetail>).detail;
      if (!detail || typeof detail.sceneId !== "string") {
        return;
      }

      if (detail.status === "ready") {
        reportOperationalEvent({
          name: "scene_load",
          route,
          sceneId: detail.sceneId,
          durationMs: detail.durationMs,
        });
      } else if (detail.status === "failure") {
        reportOperationalEvent({
          name: "scene_failure",
          route,
          sceneId: detail.sceneId,
          reason: detail.reason,
        });
      } else if (detail.status === "context-lost") {
        reportOperationalEvent({
          name: "webgl_context_lost",
          route,
          sceneId: detail.sceneId,
        });
      } else if (detail.status === "rotation-health") {
        reportOperationalEvent({
          name: "rotation_health",
          route,
          sceneId: detail.sceneId,
          fps: detail.fps,
        });
      }
    };

    window.addEventListener("site:scene-runtime", onSceneRuntime);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener("site:scene-runtime", onSceneRuntime);
    };
  }, [pathname]);

  return null;
}
```

- [ ] **Step 6: Implement sanitized browser SDK options and initialization**

Create `app/observability/sentry-options.ts`:

```ts
import type { BrowserOptions, Event } from "@sentry/browser";

interface PublicSentryEnvironment {
  dsn: string;
  environment: string;
  release: string;
}

function sanitizeEvent(event: Event): Event {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.contexts;
  delete event.tags;
  if (event.message) {
    event.message = redactSensitiveText(event.message);
  }
  event.exception?.values?.forEach((exception) => {
    if (exception.value) {
      exception.value = redactSensitiveText(exception.value);
    }
    exception.stacktrace?.frames?.forEach((frame) => {
      if (frame.filename) {
        frame.filename = frame.filename.replace(/[?#].*$/, "");
      }
    });
  });
  return event;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    )
    .replace(/\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, "[redacted-phone]")
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, "$1");
}

export function createBrowserSentryOptions(
  environment: PublicSentryEnvironment,
): BrowserOptions {
  return {
    dsn: environment.dsn,
    environment: environment.environment,
    release: environment.release,
    sendDefaultPii: false,
    sendClientReports: false,
    sampleRate: 0.1,
    tracesSampleRate: 0,
    beforeSend: sanitizeEvent,
    integrations(defaultIntegrations) {
      return defaultIntegrations.filter(
        (integration) =>
          integration.name !== "BrowserTracing" &&
          integration.name !== "Replay" &&
          integration.name !== "Breadcrumbs" &&
          integration.name !== "BrowserSession",
      );
    },
  };
}
```

Create `app/observability/init-browser-sentry.ts`:

```ts
import * as Sentry from "@sentry/browser";
import { createBrowserSentryOptions } from "./sentry-options";

interface PublicSentryRuntimeEnvironment {
  NEXT_PUBLIC_SITE_ENV?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_RELEASE_ID?: string;
}

type Initialize = (options: Parameters<typeof Sentry.init>[0]) => void;

export function createBrowserSentryInitializer(initialize: Initialize) {
  let initialized = false;

  return (environment: PublicSentryRuntimeEnvironment): boolean => {
    const dsn = environment.NEXT_PUBLIC_SENTRY_DSN;
    const release = environment.NEXT_PUBLIC_RELEASE_ID;
    if (
      initialized ||
      environment.NEXT_PUBLIC_SITE_ENV !== "production" ||
      !dsn ||
      !release ||
      !/^[0-9a-f]{40}$/.test(release)
    ) {
      return false;
    }

    initialize(
      createBrowserSentryOptions({
        dsn,
        environment: "production",
        release,
      }),
    );
    initialized = true;
    return true;
  };
}

export const initializeBrowserSentry =
  createBrowserSentryInitializer(Sentry.init);

export function initializeConfiguredBrowserSentry(): boolean {
  return initializeBrowserSentry({
    NEXT_PUBLIC_SITE_ENV: process.env.NEXT_PUBLIC_SITE_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_RELEASE_ID: process.env.NEXT_PUBLIC_RELEASE_ID,
  });
}
```

Create the root `instrumentation-client.ts` entry. Vinext's Next-compatible client instrumentation transform loads this module before hydration, so render or hydration failures cannot prevent SDK setup; the initializer itself still keeps preview and missing-DSN builds disabled:

```ts
import { initializeConfiguredBrowserSentry } from "./app/observability/init-browser-sentry";

initializeConfiguredBrowserSentry();
```

- [ ] **Step 7: Run the three focused files and verify GREEN**

Run:

```bash
npm run test:unit -- tests/observability/OperationalTelemetry.test.tsx tests/observability/sentry-options.test.ts tests/observability/init-browser-sentry.test.ts
```

Expected: PASS; the bridge maps only the four scene lifecycle statuses, and the browser SDK options remove request/user data with tracing at zero.

- [ ] **Step 8: Commit the browser diagnostics boundary**

```bash
git add app/observability instrumentation-client.ts tests/observability package.json package-lock.json
git commit -m "feat: bridge scene diagnostics without identity tracking"
```

## Task 4: Validate diagnostics at the Worker and alert on uncaught failures

**Files:**

- Create: `worker/observability.ts`
- Modify: `worker/index.ts`
- Create: `tests/worker/observability.test.ts`

- [ ] **Step 1: Write failing endpoint and sanitization tests**

Create `tests/worker/observability.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { siteWorker } from "../../worker/index";
import {
  createWorkerSentryOptions,
  readBoundedUtf8,
  withSiteSecurityHeaders,
} from "../../worker/observability";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://richardphong.dev/__ops", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "https://richardphong.dev",
      ...headers,
    },
  });
}

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

describe("POST /__ops", () => {
  it("logs only a validated event plus the server release", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await siteWorker.fetch(
      request({
        name: "scene_failure",
        route: "/projects",
        sceneId: "league-ban",
        reason: "fetch",
      }),
      { RELEASE_ID: "release-abc" } as never,
      context,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(info).toHaveBeenCalledWith({
      kind: "site_operational",
      release: "release-abc",
      name: "scene_failure",
      route: "/projects",
      sceneId: "league-ban",
      reason: "fetch",
    });
    info.mockRestore();
  });

  it.each([
    request({ name: "contact_click", route: "/" }),
    request({
      name: "route_load",
      route: "/",
      durationMs: 2,
      email: "person@example.com",
    }),
    request(
      { name: "route_load", route: "/", durationMs: 2 },
      { origin: "https://attacker.invalid" },
    ),
    new Request("https://richardphong.dev/__ops", {
      method: "POST",
      body: JSON.stringify({
        name: "route_load",
        route: "/",
        durationMs: 2,
      }),
      headers: { "content-type": "application/json" },
    }),
  ])("rejects unapproved, expanded, or cross-origin input", async (input) => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await siteWorker.fetch(
      input,
      { RELEASE_ID: "release-abc" } as never,
      context,
    );

    expect([400, 403]).toContain(response.status);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("bounds the UTF-8 request body rather than JavaScript characters", async () => {
    const input = new Request("https://richardphong.dev/__ops", {
      method: "POST",
      body: "é".repeat(600),
    });
    await expect(readBoundedUtf8(input, 1_024)).resolves.toBeNull();
  });
});

describe("sitewide response policy", () => {
  it("sets a no-referrer policy on every wrapped response", async () => {
    const response = withSiteSecurityHeaders(
      new Response("ok", { headers: { "x-existing": "kept" } }),
    );

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-existing")).toBe("kept");
    await expect(response.text()).resolves.toBe("ok");
  });
});

describe("createWorkerSentryOptions", () => {
  it("removes request and user data and disables traces", () => {
    const options = createWorkerSentryOptions({
      SENTRY_DSN: "https://public@example.invalid/1",
      RELEASE_ID: "a".repeat(40),
      SITE_ENV: "production",
    });
    const event = options.beforeSend?.(
      {
        user: { ip_address: "127.0.0.1" },
        request: {
          url: "https://richardphong.dev/contact?email=person@example.com",
          headers: { cookie: "private" },
        },
        breadcrumbs: [
          { category: "ui.click", message: "mailto:person@example.com" },
        ],
      },
    );

    expect(options.sendDefaultPii).toBe(false);
    expect(options.release).toBe("a".repeat(40));
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sampleRate).toBe(0.1);
    expect(event?.user).toBeUndefined();
    expect(event?.request).toBeUndefined();
    expect(event?.breadcrumbs).toBeUndefined();
  });

  it("cannot send from preview even when a DSN is present", () => {
    const options = createWorkerSentryOptions({
      SENTRY_DSN: "https://public@example.invalid/1",
      RELEASE_ID: "preview-release",
      SITE_ENV: "preview",
    });

    expect(options.enabled).toBe(false);
    expect(options.dsn).toBeUndefined();
  });

  it("cannot send from production without an exact lowercase Git release ID", () => {
    for (const RELEASE_ID of [undefined, "release-abc", "A".repeat(40)]) {
      const options = createWorkerSentryOptions({
        SENTRY_DSN: "https://public@example.invalid/1",
        RELEASE_ID,
        SITE_ENV: "production",
      });
      expect(options.enabled).toBe(false);
      expect(options.dsn).toBeUndefined();
      expect(options.release).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the Worker test and verify RED**

Run:

```bash
npm run test:unit -- tests/worker/observability.test.ts
```

Expected: FAIL because `siteWorker` and `worker/observability.ts` do not exist.

- [ ] **Step 3: Implement the endpoint and Worker Sentry options**

Create `worker/observability.ts`:

```ts
import type { Event } from "@sentry/cloudflare";
import { parseOperationalEvent } from "../lib/observability/operational-event";

export interface WorkerObservabilityEnv {
  RELEASE_ID?: string;
  SENTRY_DSN?: string;
  SITE_ENV?: string;
}

function sanitizeEvent(event: Event): Event {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.contexts;
  delete event.tags;
  if (event.message) {
    event.message = redactSensitiveText(event.message);
  }
  event.exception?.values?.forEach((exception) => {
    if (exception.value) {
      exception.value = redactSensitiveText(exception.value);
    }
    exception.stacktrace?.frames?.forEach((frame) => {
      if (frame.filename) {
        frame.filename = frame.filename.replace(/[?#].*$/, "");
      }
    });
  });
  return event;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    )
    .replace(/\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, "[redacted-phone]")
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, "$1");
}

export function createWorkerSentryOptions(env: WorkerObservabilityEnv) {
  const enabled =
    env.SITE_ENV === "production" &&
    Boolean(env.SENTRY_DSN) &&
    /^[0-9a-f]{40}$/.test(env.RELEASE_ID ?? "");
  return {
    enabled,
    dsn: enabled ? env.SENTRY_DSN : undefined,
    environment: env.SITE_ENV ?? "preview",
    release: enabled ? env.RELEASE_ID : undefined,
    sendDefaultPii: false,
    sendClientReports: false,
    sampleRate: 0.1,
    tracesSampleRate: 0,
    beforeSend: sanitizeEvent,
  };
}

export async function readBoundedUtf8(
  request: Request,
  maximumBytes: number,
): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export async function handleOperationalRequest(
  request: Request,
  env: WorkerObservabilityEnv,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }
  if (origin !== requestUrl.origin) {
    return new Response("Forbidden", { status: 403 });
  }
  if (
    contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json" ||
    (contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > 1_024))
  ) {
    return new Response("Invalid request", { status: 400 });
  }

  const body = await readBoundedUtf8(request, 1_024);
  if (body === null) {
    return new Response("Invalid request", { status: 400 });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const event = parseOperationalEvent(decoded);
  if (!event) {
    return new Response("Invalid request", { status: 400 });
  }

  console.info({
    kind: "site_operational",
    release: env.RELEASE_ID ?? "unversioned",
    ...event,
  });

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

export function withSiteSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

- [ ] **Step 4: Route diagnostics before the application handler and wrap the Worker**

Replace `worker/index.ts` with:

```ts
import * as Sentry from "@sentry/cloudflare";
import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  createWorkerSentryOptions,
  handleOperationalRequest,
  withSiteSecurityHeaders,
  type WorkerObservabilityEnv,
} from "./observability";

interface Env extends WorkerObservabilityEnv {
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

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export const siteWorker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: WorkerExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;

    if (url.pathname === "/__ops") {
      response = await handleOperationalRequest(request, env);
    } else if (url.pathname === "/_vinext/image") {
      const allowedWidths = [
        ...DEFAULT_DEVICE_SIZES,
        ...DEFAULT_IMAGE_SIZES,
      ];
      response = await handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    } else {
      response = await handler.fetch(request, env, ctx);
    }

    return withSiteSecurityHeaders(response);
  },
};

export default Sentry.withSentry(
  (env: Env) => createWorkerSentryOptions(env),
  siteWorker,
);
```

- [ ] **Step 5: Run the Worker test and verify GREEN**

Run:

```bash
npm run test:unit -- tests/worker/observability.test.ts
```

Expected: PASS; valid bodies return 204, invalid/cross-origin bodies never log, Worker exception options contain no request or user data, and the response wrapper preserves bodies while applying `Referrer-Policy: no-referrer` sitewide.

- [ ] **Step 6: Commit the Worker boundary**

```bash
git add worker/index.ts worker/observability.ts tests/worker/observability.test.ts
git commit -m "feat: add privacy-bounded worker diagnostics"
```

## Task 5: Pin free-tier diagnostics and mount transparent disclosure

**Files:**

- Create: `build/sentry-config.ts`
- Create: `app/observability/CloudflareWebAnalytics.tsx`
- Create: `components/telemetry-disclosure.tsx`
- Modify: `content/site-content.ts`
- Modify: `vite.config.ts`
- Modify: `app/layout.tsx`
- Modify: `components/site-footer.tsx`
- Modify: `app/contact/page.tsx`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/observability/build-config.test.ts`
- Create: `tests/observability/disclosure.test.tsx`
- Modify: `tests/site-shell.test.tsx`
- Modify: `tests/contact-page.test.tsx`

- [ ] **Step 1: Install the exact diagnostics and quality dependencies**

Run:

```bash
npm install --save-dev --save-exact @sentry/cli@3.6.0 @axe-core/playwright@4.10.2 start-server-and-test@2.1.2
```

Expected: `package.json` and `package-lock.json` update; npm reports no vulnerabilities that block the build. Keep `sharp@0.35.3` from the asset plan and `@playwright/test@1.61.1` from the runtime plan rather than installing alternate versions.

- [ ] **Step 2: Write failing build-config and disclosure tests**

Create `tests/observability/build-config.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getSentryBuildConfig } from "../../build/sentry-config";

const complete = {
  SITE_ENV: "production",
  SENTRY_AUTH_TOKEN: "private-token",
  SENTRY_ORG: "richard-phong",
  SENTRY_ORG_ID: "123",
  SENTRY_BROWSER_PROJECT: "personal-site-browser",
  SENTRY_BROWSER_PROJECT_ID: "456",
  SENTRY_WORKER_PROJECT: "personal-site-worker",
  SENTRY_WORKER_PROJECT_ID: "789",
  RELEASE_ID: "a".repeat(40),
};

describe("getSentryBuildConfig", () => {
  it("enables hidden source-map generation only with every private build value", () => {
    const config = getSentryBuildConfig(complete);

    expect(config.enabled).toBe(true);
    if (!config.enabled) throw new Error("Expected complete Sentry config");
    expect(config.sourcemap).toBe("hidden");
  });

  it.each(Object.keys(complete))("stays disabled without %s", (missing) => {
    const environment: Partial<typeof complete> = { ...complete };
    delete environment[missing as keyof typeof environment];

    expect(getSentryBuildConfig(environment).enabled).toBe(false);
    expect(getSentryBuildConfig(environment).sourcemap).toBe(false);
  });

  it("enables structured logs but disables invocation logs and generic traces", async () => {
    const source = await readFile("vite.config.ts", "utf8");
    expect(source).not.toMatch(/sentryVitePlugin/);
    expect(source).toMatch(/observability:\s*\{\s*enabled:\s*true/);
    expect(source).toMatch(/invocation_logs:\s*false/);
    expect(source).toMatch(/traces:\s*\{\s*enabled:\s*false/);
  });
});
```

Create `tests/observability/disclosure.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CompactTelemetryDisclosure,
  ExpandedTelemetryDisclosure,
} from "../../components/telemetry-disclosure";
import { telemetryDisclosure } from "../../content/site-content";
import {
  shouldLoadCloudflareWebAnalytics,
} from "../../app/observability/CloudflareWebAnalytics";

describe("telemetry disclosure", () => {
  it("names processors and rejects engagement tracking in the footer", () => {
    render(<CompactTelemetryDisclosure />);

    expect(screen.getByText(telemetryDisclosure.compact)).toBeVisible();
    expect(telemetryDisclosure.compact).toMatch(/Cloudflare field performance/i);
    expect(telemetryDisclosure.compact).toMatch(/Sentry errors/i);
    expect(telemetryDisclosure.compact).toMatch(
      /no replay or contact-action tracking/i,
    );
  });

  it("explains sampling, contact-data isolation, and local preference storage", () => {
    render(<ExpandedTelemetryDisclosure />);

    expect(
      screen.getByRole("heading", { name: telemetryDisclosure.heading }),
    ).toBeVisible();
    for (const paragraph of telemetryDisclosure.paragraphs) {
      expect(screen.getByText(paragraph)).toBeVisible();
    }
    expect(telemetryDisclosure.paragraphs.join(" ")).toMatch(
      /independent five-percent samples/i,
    );
    expect(telemetryDisclosure.paragraphs.join(" ")).toMatch(
      /ten-percent sample/i,
    );
    expect(telemetryDisclosure.paragraphs.join(" ")).toMatch(
      /contact information is never attached/i,
    );
    expect(telemetryDisclosure.paragraphs.join(" ")).toMatch(
      /3D preference stays on this device/i,
    );
  });

  it("loads Cloudflare field metrics for only five percent of query-free production visits", () => {
    expect(
      shouldLoadCloudflareWebAnalytics({
        siteEnvironment: "production",
        token: "public-token",
        randomValue: 0.049,
        hasQuery: false,
        hasHash: false,
        hasReferrer: false,
      }),
    ).toBe(true);
    expect(
      shouldLoadCloudflareWebAnalytics({
        siteEnvironment: "production",
        token: "public-token",
        randomValue: 0.05,
        hasQuery: false,
        hasHash: false,
        hasReferrer: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadCloudflareWebAnalytics({
        siteEnvironment: "preview",
        token: "public-token",
        randomValue: 0,
        hasQuery: false,
        hasHash: false,
        hasReferrer: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadCloudflareWebAnalytics({
        siteEnvironment: "production",
        token: "public-token",
        randomValue: 0,
        hasQuery: false,
        hasHash: false,
        hasReferrer: true,
      }),
    ).toBe(false);
    expect(
      shouldLoadCloudflareWebAnalytics({
        siteEnvironment: "production",
        token: "public-token",
        randomValue: 0,
        hasQuery: false,
        hasHash: true,
        hasReferrer: false,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run both files and verify RED**

Run:

```bash
npm run test:unit -- tests/observability/build-config.test.ts tests/observability/disclosure.test.tsx
```

Expected: FAIL because the build helper and disclosure components do not exist.

- [ ] **Step 4: Implement deterministic Sentry build configuration**

Create `build/sentry-config.ts`:

```ts
interface SentryBuildEnvironment {
  SITE_ENV?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_ORG_ID?: string;
  SENTRY_BROWSER_PROJECT?: string;
  SENTRY_BROWSER_PROJECT_ID?: string;
  SENTRY_WORKER_PROJECT?: string;
  SENTRY_WORKER_PROJECT_ID?: string;
  RELEASE_ID?: string;
}

type SentryBuildConfig =
  | {
      enabled: false;
      sourcemap: false;
    }
  | {
      enabled: true;
      sourcemap: "hidden";
    };

export function getSentryBuildConfig(
  environment: SentryBuildEnvironment,
): SentryBuildConfig {
  const {
    SITE_ENV,
    SENTRY_AUTH_TOKEN,
    SENTRY_ORG,
    SENTRY_ORG_ID,
    SENTRY_BROWSER_PROJECT,
    SENTRY_BROWSER_PROJECT_ID,
    SENTRY_WORKER_PROJECT,
    SENTRY_WORKER_PROJECT_ID,
    RELEASE_ID,
  } = environment;
  if (
    SITE_ENV !== "production" ||
    !SENTRY_AUTH_TOKEN ||
    !SENTRY_ORG ||
    !/^\d+$/.test(SENTRY_ORG_ID ?? "") ||
    !SENTRY_BROWSER_PROJECT ||
    !/^\d+$/.test(SENTRY_BROWSER_PROJECT_ID ?? "") ||
    !SENTRY_WORKER_PROJECT ||
    !/^\d+$/.test(SENTRY_WORKER_PROJECT_ID ?? "") ||
    !RELEASE_ID
  ) {
    return { enabled: false, sourcemap: false };
  }

  return {
    enabled: true,
    sourcemap: "hidden",
  };
}
```

Replace `vite.config.ts` with:

```ts
import vinext from "vinext";
import { defineConfig } from "vite";
import { getSentryBuildConfig } from "./build/sentry-config";
import { sites } from "./build/sites-vite-plugin";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  observability: {
    enabled: true,
    logs: {
      enabled: true,
      head_sampling_rate: 1,
      invocation_logs: false,
    },
    traces: {
      enabled: false,
    },
  },
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const sentry = getSentryBuildConfig(process.env);

  return {
    build: { sourcemap: sentry.sourcemap },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
```

- [ ] **Step 5: Implement production-only Cloudflare Web Analytics**

Create `app/observability/CloudflareWebAnalytics.tsx`:

```tsx
"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

interface CloudflareSamplingInput {
  siteEnvironment: string | undefined;
  token: string | undefined;
  randomValue: number;
  hasQuery: boolean;
  hasHash: boolean;
  hasReferrer: boolean;
}

export function shouldLoadCloudflareWebAnalytics({
  siteEnvironment,
  token,
  randomValue,
  hasQuery,
  hasHash,
  hasReferrer,
}: CloudflareSamplingInput): boolean {
  return (
    siteEnvironment === "production" &&
    Boolean(token) &&
    !hasQuery &&
    !hasHash &&
    !hasReferrer &&
    Number.isFinite(randomValue) &&
    randomValue >= 0 &&
    randomValue < 0.05
  );
}

export function CloudflareWebAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  const siteEnvironment = process.env.NEXT_PUBLIC_SITE_ENV;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      shouldLoadCloudflareWebAnalytics({
        siteEnvironment,
        token,
        randomValue: Math.random(),
        hasQuery: window.location.search !== "",
        hasHash: window.location.hash !== "",
        hasReferrer: document.referrer !== "",
      }),
    );
  }, [siteEnvironment, token]);

  if (!enabled || !token) {
    return null;
  }

  return (
    <Script
      id="cloudflare-web-analytics"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token, spa: false })}
    />
  );
}
```

- [ ] **Step 6: Put disclosure copy in the typed content authority and render it**

Add this export immediately before `contact` in `content/site-content.ts`, then point the existing `contact.privacy` and `footer.disclosure` fields at it so there is one source of truth:

```ts
export const telemetryDisclosure = {
  compact:
    "This site uses independent five-percent samples for Cloudflare field performance and route and scene health, plus a ten-percent sample of sanitized Sentry errors, with no replay or contact-action tracking.",
  heading: "Site diagnostics",
  paragraphs: [
    "Cloudflare Web Analytics and this site's route and scene diagnostics use independent five-percent samples of query-free, fragment-free, referrer-free production visits. Cloudflare measures field Web Vitals; the site sends only an allow-listed route or scene health event. Sentry receives a separate ten-percent sample of sanitized uncaught errors so I can find broken scenes and pages.",
    "Contact information is never attached to diagnostics. Referrer-Policy is set to no-referrer, and there is no session replay, contact-action tracking, model-engagement tracking, or visitor profile. Your 3D preference stays on this device.",
  ],
} as const;

export const footer = {
  disclosure: telemetryDisclosure.compact,
  privacyHref: "/contact#privacy",
} as const;
```

In the existing `contact` object, replace only its `privacy` value with `telemetryDisclosure.paragraphs.join(" ")`; retain the introduction, actions, and resume path byte-for-byte. Do not duplicate the disclosure sentences in a component or test fixture.

Create `components/telemetry-disclosure.tsx`:

```tsx
import { telemetryDisclosure } from "../content/site-content";

export function CompactTelemetryDisclosure() {
  return (
    <p className="telemetry-disclosure telemetry-disclosure--compact">
      {telemetryDisclosure.compact}
    </p>
  );
}

export function ExpandedTelemetryDisclosure() {
  return (
    <section
      className="privacy-panel prose telemetry-disclosure"
      id="privacy"
      aria-labelledby="diagnostics-title"
    >
      <p className="section-kicker">Operational telemetry</p>
      <h2 className="chapter-heading" id="diagnostics-title">
        {telemetryDisclosure.heading}
      </h2>
      {telemetryDisclosure.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}
```

Update the existing disclosure assertions rather than leaving foundation-era copy behind. In `tests/site-shell.test.tsx`, import `telemetryDisclosure` and replace the old footer text assertion with:

```tsx
expect(screen.getByText(telemetryDisclosure.compact)).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Privacy details." })).toHaveAttribute(
  "href",
  "/contact#privacy",
);
```

In `tests/contact-page.test.tsx`, import `telemetryDisclosure` and replace the old privacy assertion with:

```tsx
expect(
  screen.getByRole("heading", { name: telemetryDisclosure.heading }),
).toBeInTheDocument();
for (const paragraph of telemetryDisclosure.paragraphs) {
  expect(screen.getByText(paragraph)).toBeInTheDocument();
}
```

- [ ] **Step 7: Document the deployment environment contract**

Replace `.env.example` with:

```dotenv
# Deployment identity. Keep the public and Worker values equal.
SITE_ENV=preview
NEXT_PUBLIC_SITE_ENV=preview
SITE_URL=http://localhost:3000
RELEASE_ID=local
NEXT_PUBLIC_RELEASE_ID=local

# Browser error grouping and Cloudflare field Web Vitals.
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_CF_BEACON_TOKEN=

# Worker error grouping and controlled post-build source-map upload.
SENTRY_DSN=
SENTRY_ORG=
SENTRY_ORG_ID=
SENTRY_BROWSER_PROJECT=
SENTRY_BROWSER_PROJECT_ID=
SENTRY_WORKER_PROJECT=
SENTRY_WORKER_PROJECT_ID=
SENTRY_AUTH_TOKEN=

# Exact Sites packaging tools used only by the controlled release runner.
SITES_PLUGIN_ROOT=
SITES_BASH_BIN=
```

- [ ] **Step 8: Mount the components in the shared shell**

Replace `app/layout.tsx` with this post-runtime layout:

```tsx
import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { CloudflareWebAnalytics } from "./observability/CloudflareWebAnalytics";
import { OperationalTelemetry } from "./observability/OperationalTelemetry.client";
import { SceneProvider } from "./three/scene-provider";
import { SiteShell } from "../components/site-shell";
import { createPageMetadata } from "../lib/site-metadata";
import "./globals.css";
import "./three/scene-runtime.css";

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

export function generateMetadata(): Metadata {
  return createPageMetadata("home");
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} ${fraunces.variable}`}>
        <OperationalTelemetry />
        <SceneProvider>
          <SiteShell>{children}</SiteShell>
        </SceneProvider>
        <CloudflareWebAnalytics />
      </body>
    </html>
  );
}
```

Replace `components/site-footer.tsx` with:

```tsx
import Link from "next/link";
import { footer } from "../content/site-content";
import { CompactTelemetryDisclosure } from "./telemetry-disclosure";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <CompactTelemetryDisclosure />
      <p>
        <Link href={footer.privacyHref}>Privacy details.</Link>
      </p>
    </footer>
  );
}
```

Replace `app/contact/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { PageHero } from "../../components/page-hero";
import { ExpandedTelemetryDisclosure } from "../../components/telemetry-disclosure";
import { contact, routeByKey } from "../../content/site-content";
import { createPageMetadata } from "../../lib/site-metadata";

const route = routeByKey.contact;

export function generateMetadata(): Metadata {
  return createPageMetadata("contact");
}

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
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

          <ExpandedTelemetryDisclosure />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 9: Run the build-config, disclosure, and HTML suites and verify GREEN**

Run:

```bash
npm run test:unit -- tests/observability/build-config.test.ts tests/observability/disclosure.test.tsx
npm run test:unit -- tests/site-shell.test.tsx tests/contact-page.test.tsx
npm run test:html
```

Expected: all four Vitest files PASS; rendered HTML contains the concise disclosure on every route and the expanded `Site diagnostics` section on `/contact`. Preview HTML contains no Cloudflare beacon script.

- [ ] **Step 10: Build without private credentials**

Run:

```bash
npm run build
```

Expected: PASS with hidden source-map generation and upload disabled; the log contains no Sentry authentication error and no private value appears in `dist/client`.

Because `app/layout.tsx` is part of the runtime poster `renderInputsSha256`, refresh the deterministic poster manifest after this layout change:

```bash
npm run posters:capture
git diff -- public/posters public/posters/poster-manifest.json
npm run posters:check
```

Expected: recapture completes and `posters:check` passes. Review every changed poster byte; accept only an intentional visual change. A manifest-only render-input hash refresh is expected when pixels remain identical.

- [ ] **Step 11: Commit diagnostics configuration and disclosure**

```bash
git add package.json package-lock.json build/sentry-config.ts vite.config.ts .env.example app/observability components/telemetry-disclosure.tsx components/site-footer.tsx app/contact/page.tsx app/layout.tsx content/site-content.ts tests/observability tests/site-shell.test.tsx tests/contact-page.test.tsx public/posters
git commit -m "feat: configure transparent free-tier observability"
```

## Task 6: Turn exact-color accessibility findings into an explicit gate

**Files:**

- Modify: `app/globals.css`
- Create: `config/contrast-checks.json`
- Create: `scripts/quality/contrast.mjs`
- Create: `tests/quality/contrast.test.mjs`
- Create: `tests/browser/accessibility.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create after the first report run: `reports/contrast.json`

- [ ] **Step 1: Write failing contrast-evaluator tests**

Create `tests/quality/contrast.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  EXPECTED_CONTRAST_IDS,
  bindChecksToCss,
  contrastRatio,
  evaluateChecks,
  nearestCompliantForeground,
  validateSelectorWiring,
} from "../../scripts/quality/contrast.mjs";

const root = resolve(import.meta.dirname, "../..");

test("computes the WCAG black-on-white ratio", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
});

test("blocks an unreviewed exact-color failure", () => {
  const report = evaluateChecks([
    {
      id: "large-heading",
      foreground: "#FFFFFF",
      background: "#9ECCC0",
      minimum: 3,
      decision: "pending",
      approvedForeground: null,
      reviewedBy: null,
      reviewedOn: null,
    },
  ]);

  assert.equal(report.results[0].passesRatio, false);
  assert.deepEqual(report.blockingIds, ["large-heading"]);
});

test("records explicit exact-color approval without hiding the ratio", () => {
  const report = evaluateChecks([
    {
      id: "large-heading",
      foreground: "#FFFFFF",
      background: "#9ECCC0",
      minimum: 3,
      decision: "approved-exact",
      approvedForeground: null,
      reviewedBy: "Richard Phong",
      reviewedOn: "2026-07-09",
    },
  ]);

  assert.equal(report.results[0].passesRatio, false);
  assert.deepEqual(report.blockingIds, []);
});

test("accepts only a compliant reviewed adjustment", () => {
  const report = evaluateChecks([
    {
      id: "large-heading",
      foreground: "#FFFFFF",
      background: "#9ECCC0",
      minimum: 3,
      decision: "approved-adjustment",
      approvedForeground: "#135946",
      reviewedBy: "Richard Phong",
      reviewedOn: "2026-07-09",
    },
  ]);

  assert.equal(report.results[0].effectiveForeground, "#135946");
  assert.equal(report.results[0].passesRatio, true);
  assert.deepEqual(report.blockingIds, []);
});

test("uses a raw ratio and reports a deterministic compliant candidate", () => {
  const report = evaluateChecks([
    {
      id: "raw-boundary",
      foreground: "#777777",
      background: "#FFFFFF",
      minimum: 4.5,
      decision: "pending",
      approvedForeground: null,
      reviewedBy: null,
      reviewedOn: null,
    },
  ]);
  assert.ok(report.results[0].ratio > 4.47);
  assert.ok(report.results[0].ratio < 4.49);
  assert.equal(report.results[0].ratioDisplay, 4.48);
  assert.equal(report.results[0].passesRatio, false);
  const candidate = nearestCompliantForeground("#777777", "#FFFFFF", 4.5);
  assert.deepEqual(
    candidate,
    nearestCompliantForeground("#777777", "#FFFFFF", 4.5),
  );
  assert.ok(candidate.ratio >= 4.5);
});

test("locks all CSS-bound pairings and rejects an unshipped adjustment", async () => {
  const [configuration, css] = await Promise.all([
    readFile(resolve(root, "config/contrast-checks.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(resolve(root, "app/globals.css"), "utf8"),
  ]);
  const bound = bindChecksToCss(configuration, css);
  assert.deepEqual(validateSelectorWiring(css), []);
  assert.deepEqual(
    bound.map(({ id }) => id).sort(),
    [...EXPECTED_CONTRAST_IDS].sort(),
  );
  assert.equal(new Set(bound.map(({ id }) => id)).size, 24);

  const adjusted = {
    ...bound[0],
    decision: "approved-adjustment",
    approvedForeground: "#010203",
    reviewedBy: "Richard Phong",
    reviewedOn: "2026-07-09",
  };
  assert.equal(evaluateChecks([adjusted]).results[0].sourceMatches, false);
});
```

- [ ] **Step 2: Run the focused Node test and verify RED**

Run:

```bash
node --test tests/quality/contrast.test.mjs
```

Expected: FAIL because `scripts/quality/contrast.mjs` does not exist.

- [ ] **Step 3: Implement the final CSS-bound configuration and evaluator**

The earlier flat example establishes the initial RED state. Before continuing, replace it completely with this final compact source map in `config/contrast-checks.json`:

```json
{
  "expectedIds": [
    "home-hero-heading", "home-accent-on-hero", "home-navigation-copy", "home-accent-on-surface",
    "experience-hero-heading", "experience-accent-on-hero", "experience-navigation-copy", "experience-accent-on-surface",
    "projects-hero-heading", "projects-accent-on-hero", "projects-navigation-copy", "projects-accent-on-surface",
    "contact-hero-heading", "contact-accent-on-hero", "contact-navigation-copy", "contact-accent-on-surface",
    "shared-body-on-surface", "shared-strong-on-surface",
    "home-owner-gate", "experience-owner-gate", "projects-owner-gate", "contact-owner-gate",
    "contact-card-accent", "contact-card-body"
  ],
  "routes": [
    {"key":"home","cssScope":".site-shell","background":"#9ECCC0","accent":"#135946","paleHeading":"#FFFFFF"},
    {"key":"experience","cssScope":".site-shell[data-route=\"experience\"]","background":"#DFA9B5","accent":"#722939","paleHeading":"#FBE5EA"},
    {"key":"projects","cssScope":".site-shell[data-route=\"projects\"]","background":"#AFD4E1","accent":"#285D71","paleHeading":"#EDF7FB"},
    {"key":"contact","cssScope":".site-shell[data-route=\"contact\"]","background":"#C9BAE4","accent":"#4B2E7E","paleHeading":"#EDE6FA"}
  ],
  "decisions": {}
}
```

An absent decision means `pending`. Richard records only reviewed failing IDs in `decisions`, using either:

```json
{
  "decision": "approved-exact",
  "approvedForeground": null,
  "reviewedBy": "Richard Phong",
  "reviewedOn": "2026-07-09"
}
```

or a CSS-shipped compliant `approved-adjustment` with the same reviewer/date fields.

Add the two flattened composite tokens to `:root` and bind the existing rules:

```css
:root {
  --owner-gate-background: #f7f7f7;
  --contact-card-background: #f6f6f6;
}

.content-surface {
  background: var(--surface);
}

.owner-gate {
  background: var(--owner-gate-background);
}

.contact-card {
  background: var(--contact-card-background);
}

.site-nav__link,
.prose,
.contact-card span {
  color: var(--text);
}
```

Retain every other declaration from those existing rules. Then replace `scripts/quality/contrast.mjs` completely:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const EXPECTED_CONTRAST_IDS = [
  "home-hero-heading", "home-accent-on-hero", "home-navigation-copy",
  "home-accent-on-surface", "experience-hero-heading",
  "experience-accent-on-hero", "experience-navigation-copy",
  "experience-accent-on-surface", "projects-hero-heading",
  "projects-accent-on-hero", "projects-navigation-copy",
  "projects-accent-on-surface", "contact-hero-heading",
  "contact-accent-on-hero", "contact-navigation-copy",
  "contact-accent-on-surface", "shared-body-on-surface",
  "shared-strong-on-surface", "home-owner-gate", "experience-owner-gate",
  "projects-owner-gate", "contact-owner-gate", "contact-card-accent",
  "contact-card-body",
];

function normalizeHex(value) {
  if (!/^#[0-9A-F]{6}$/i.test(value ?? "")) {
    throw new Error(`Invalid six-digit hex color: ${value}`);
  }
  return value.toUpperCase();
}

function toRgb(hex) {
  const value = normalizeHex(hex);
  return [1, 3, 5].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
}

function toHex(channels) {
  return `#${channels.map((channel) =>
    Math.round(channel).toString(16).padStart(2, "0"),
  ).join("").toUpperCase()}`;
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function readCssVariable(css, source) {
  const block = css.match(
    new RegExp(`${escapeRegExp(source.cssScope)}\\s*\\{([^}]*)\\}`, "s"),
  );
  if (!block) throw new Error(`Missing CSS scope: ${source.cssScope}`);
  const declaration = block[1].match(
    new RegExp(
      `${escapeRegExp(source.cssVariable)}\\s*:\\s*(#[0-9a-f]{6})\\s*;`,
      "i",
    ),
  );
  if (!declaration) {
    throw new Error(
      `Missing six-digit ${source.cssVariable} in ${source.cssScope}`,
    );
  }
  return normalizeHex(declaration[1]);
}

export function validateSelectorWiring(css) {
  const required = [
    ["page hero heading", /\.page-hero h1\s*\{[^}]*color:\s*var\(--route-pale-heading\)/s],
    ["navigation copy", /\.site-nav__link[\s\S]*?color:\s*var\(--text\)/],
    ["current navigation", /\.site-nav__link\[aria-current="page"\][^{]*\{[^}]*color:\s*var\(--route-accent\)/s],
    ["hero accent copy", /\.page-hero__summary\s*\{[^}]*color:\s*var\(--route-accent\)/s],
    ["surface", /\.content-surface\s*\{[^}]*background:\s*var\(--surface\)/s],
    ["strong headings", /\.section-heading,[\s\S]*?color:\s*var\(--text-strong\)/],
    ["prose", /\.prose,[\s\S]*?color:\s*var\(--text\)/],
    ["text links", /\.text-link\s*\{[^}]*color:\s*var\(--route-accent\)/s],
    ["owner gate", /\.owner-gate\s*\{[^}]*background:\s*var\(--owner-gate-background\)[^}]*color:\s*var\(--route-accent\)/s],
    ["contact card", /\.contact-card\s*\{[^}]*background:\s*var\(--contact-card-background\)/s],
    ["contact label", /\.contact-card strong\s*\{[^}]*color:\s*var\(--route-accent\)/s],
    ["footer", /\.site-footer\s*\{[^}]*color:\s*var\(--route-accent\)/s],
  ];
  return required
    .filter(([, pattern]) => !pattern.test(css))
    .map(([name]) => name);
}

function decisionFor(configuration, id) {
  return {
    decision: "pending",
    approvedForeground: null,
    reviewedBy: null,
    reviewedOn: null,
    ...(configuration.decisions[id] ?? {}),
  };
}

function source(cssScope, cssVariable, figma) {
  return { cssScope, cssVariable, figma };
}

export function expandContrastConfiguration(configuration) {
  if (
    [...configuration.expectedIds].sort().join("\n") !==
    [...EXPECTED_CONTRAST_IDS].sort().join("\n")
  ) {
    throw new Error("Configured contrast IDs do not match the locked inventory");
  }
  const surface = source(":root", "--surface", "#EEEEEE");
  const text = source(":root", "--text", "#505050");
  const strong = source(":root", "--text-strong", "#282828");
  const ownerBackground = source(
    ":root",
    "--owner-gate-background",
    "#F7F7F7",
  );
  const cardBackground = source(
    ":root",
    "--contact-card-background",
    "#F6F6F6",
  );
  const checks = [];

  for (const route of configuration.routes) {
    const background = source(
      route.cssScope,
      "--route-background",
      route.background,
    );
    const accent = source(route.cssScope, "--route-accent", route.accent);
    checks.push(
      {
        id: `${route.key}-hero-heading`,
        foreground: source(
          route.cssScope,
          "--route-pale-heading",
          route.paleHeading,
        ),
        background,
        minimum: 3,
      },
      {
        id: `${route.key}-accent-on-hero`,
        foreground: accent,
        background,
        minimum: 4.5,
      },
      {
        id: `${route.key}-navigation-copy`,
        foreground: text,
        background,
        minimum: 4.5,
      },
      {
        id: `${route.key}-accent-on-surface`,
        foreground: accent,
        background: surface,
        minimum: 4.5,
      },
    );
  }

  checks.push(
    {
      id: "shared-body-on-surface",
      foreground: text,
      background: surface,
      minimum: 4.5,
    },
    {
      id: "shared-strong-on-surface",
      foreground: strong,
      background: surface,
      minimum: 4.5,
    },
  );
  for (const route of configuration.routes) {
    checks.push({
      id: `${route.key}-owner-gate`,
      foreground: source(route.cssScope, "--route-accent", route.accent),
      background: ownerBackground,
      minimum: 4.5,
    });
  }
  const contact = configuration.routes.find(({ key }) => key === "contact");
  checks.push(
    {
      id: "contact-card-accent",
      foreground: source(
        contact.cssScope,
        "--route-accent",
        contact.accent,
      ),
      background: cardBackground,
      minimum: 4.5,
    },
    {
      id: "contact-card-body",
      foreground: text,
      background: cardBackground,
      minimum: 4.5,
    },
  );

  const ids = checks.map(({ id }) => id);
  if (
    ids.length !== EXPECTED_CONTRAST_IDS.length ||
    new Set(ids).size !== ids.length ||
    [...ids].sort().join("\n") !== [...EXPECTED_CONTRAST_IDS].sort().join("\n")
  ) {
    throw new Error("Expanded contrast inventory is incomplete");
  }
  return checks.map((check) => ({
    ...check,
    ...decisionFor(configuration, check.id),
  }));
}

export function bindChecksToCss(configurationOrChecks, css) {
  const checks = Array.isArray(configurationOrChecks)
    ? configurationOrChecks
    : expandContrastConfiguration(configurationOrChecks);
  return checks.map((check) => ({
    ...check,
    shippedForeground: readCssVariable(css, check.foreground),
    shippedBackground: readCssVariable(css, check.background),
  }));
}

function linear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [red, green, blue] = toRgb(hex);
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function nearestCompliantForeground(foreground, background, minimum) {
  const start = toRgb(foreground);
  const candidates = [];
  for (const target of [[0, 0, 0], [255, 255, 255]]) {
    for (let step = 0; step <= 255; step += 1) {
      const amount = step / 255;
      const channels = start.map(
        (channel, index) => channel + (target[index] - channel) * amount,
      );
      const candidate = toHex(channels);
      const ratio = contrastRatio(candidate, background);
      if (ratio >= minimum) {
        candidates.push({
          foreground: candidate,
          ratio,
          distance: channels.reduce(
            (sum, channel, index) =>
              sum + (channel - start[index]) ** 2,
            0,
          ),
        });
        break;
      }
    }
  }
  candidates.sort(
    (left, right) =>
      left.distance - right.distance ||
      left.foreground.localeCompare(right.foreground),
  );
  if (!candidates[0]) throw new Error("No compliant foreground candidate");
  return {
    foreground: candidates[0].foreground,
    ratio: candidates[0].ratio,
    ratioDisplay: Number(candidates[0].ratio.toFixed(2)),
    method: "nearest 1/255 linear-sRGB mix toward black or white",
  };
}

export function evaluateChecks(checks) {
  const results = checks.map((check) => {
    const flat = typeof check.foreground === "string";
    const figmaForeground = flat ? check.foreground : check.foreground.figma;
    const figmaBackground = flat ? check.background : check.background.figma;
    const shippedForeground =
      check.shippedForeground ??
      (check.decision === "approved-adjustment"
        ? check.approvedForeground
        : figmaForeground);
    const shippedBackground = check.shippedBackground ?? figmaBackground;
    const expectedForeground =
      check.decision === "approved-adjustment"
        ? check.approvedForeground
        : figmaForeground;
    const sourceMatches =
      typeof expectedForeground === "string" &&
      normalizeHex(shippedForeground) === normalizeHex(expectedForeground) &&
      normalizeHex(shippedBackground) === normalizeHex(figmaBackground);
    const ratio = contrastRatio(shippedForeground, shippedBackground);
    const passesRatio = ratio >= check.minimum;
    const reviewed =
      check.reviewedBy === "Richard Phong" &&
      /^\d{4}-\d{2}-\d{2}$/.test(check.reviewedOn ?? "");
    const approved =
      sourceMatches &&
      (check.decision === "approved-adjustment"
        ? reviewed && passesRatio
        : passesRatio ||
          (check.decision === "approved-exact" && reviewed));
    return {
      ...check,
      effectiveForeground: shippedForeground,
      sourceMatches,
      ratio,
      ratioDisplay: Number(ratio.toFixed(2)),
      passesRatio,
      nearestCompliantCandidate: passesRatio
        ? null
        : nearestCompliantForeground(
            shippedForeground,
            shippedBackground,
            check.minimum,
          ),
      reviewed,
      approved,
    };
  });
  return {
    results,
    blockingIds: results.filter(({ approved }) => !approved).map(({ id }) => id),
  };
}

async function main() {
  const root = resolve(import.meta.dirname, "../..");
  const [configuration, css] = await Promise.all([
    readFile(resolve(root, "config/contrast-checks.json"), "utf8").then(JSON.parse),
    readFile(resolve(root, "app/globals.css"), "utf8"),
  ]);
  const evaluated = evaluateChecks(bindChecksToCss(configuration, css));
  const selectorWiringFailures = validateSelectorWiring(css);
  const report = { ...evaluated, selectorWiringFailures };
  const output = resolve(root, "reports/contrast.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.table(report.results.map((result) => ({
    id: result.id,
    ratio: result.ratioDisplay,
    minimum: result.minimum,
    decision: result.decision,
    sourceMatches: result.sourceMatches,
    candidate: result.nearestCompliantCandidate?.foreground ?? "",
    approved: result.approved,
  })));
  if (
    process.argv.includes("--gate") &&
    (report.blockingIds.length > 0 || selectorWiringFailures.length > 0)
  ) {
    console.error(
      `Contrast approval required: ${[
        ...report.blockingIds,
        ...selectorWiringFailures.map((name) => `selector:${name}`),
      ].join(", ")}`,
    );
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) await main();
```

The candidate generator samples 1/255 linear-sRGB mixes toward black and white, then picks the lowest squared RGB distance with a deterministic hex tie-breaker. Every failing report keeps the raw original ratio and candidate side by side; only display fields are rounded. The accent-on-hero and accent-on-surface pairs also gate current-link underlines and focus outlines on those backgrounds at stricter text thresholds.


- [ ] **Step 4: Add non-color automated accessibility coverage**

Create `tests/browser/accessibility.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/experience", "/projects", "/contact"];

for (const route of routes) {
  test(`${route} has no automatically detectable non-color violations`, async ({
    page,
  }) => {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();

    expect(result.violations).toEqual([]);
  });
}
```

The color rule is disabled only in axe because `scripts/quality/contrast.mjs` reports the exact design-token pairs and requires an auditable owner decision.

- [ ] **Step 5: Expose the quality commands**

Run:

```bash
npm pkg set "scripts.quality:contrast=node scripts/quality/contrast.mjs"
npm pkg set "scripts.quality:contrast:gate=node scripts/quality/contrast.mjs --gate"
npm pkg set "scripts.test:accessibility=playwright test tests/browser/accessibility.spec.ts"
```

Expected: `package.json` contains the three scripts with the commands exactly as shown.

- [ ] **Step 6: Run the advisory accessibility checks**

Run:

```bash
npm run quality:contrast
npm run test:accessibility
```

Expected: contrast reporting exits 0; all four axe tests PASS with no non-color violations.

Because `app/globals.css` is a poster render input, recapture and review after the composite-token wiring and after every later approved contrast adjustment:

```bash
npm run posters:capture
git diff -- public/posters public/posters/poster-manifest.json
npm run posters:check
```

Expected: the render-input hash is current; any changed poster pixels are intentional and reviewed.

- [ ] **Step 7: Commit the accessibility gate**

```bash
git add app/globals.css config/contrast-checks.json scripts/quality/contrast.mjs tests/quality/contrast.test.mjs tests/browser/accessibility.spec.ts public/posters package.json package-lock.json .gitignore
git commit -m "test: gate accessibility and contrast review"
```

## Task 7: Measure every live scene on the repeatable mobile profile

**Files:**

- Create: `scripts/quality/performance-gate.mjs`
- Create: `tests/quality/performance-gate.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create after a successful run: `reports/performance.json`

- [ ] **Step 1: Write failing threshold tests**

Create `tests/quality/performance-gate.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRouteMeasurement,
  evaluateSceneMeasurement,
  performanceThresholds,
} from "../../scripts/quality/performance-gate.mjs";

const route = { route: "/", lcpMs: 2500, inpMs: 200, cls: 0.1 };
const scene = {
  route: "/",
  sceneId: "home-hero",
  sceneReadyMs: 4000,
  fps: 30,
};

test("accepts every metric exactly at the approved boundary", () => {
  assert.deepEqual(evaluateRouteMeasurement(route), []);
  assert.deepEqual(evaluateSceneMeasurement(scene), []);
  assert.deepEqual(performanceThresholds, {
    lcpMs: 2500,
    inpMs: 200,
    cls: 0.1,
    sceneReadyMs: 4000,
    fps: 30,
  });
});

test("names every exceeded metric", () => {
  assert.deepEqual(
    evaluateRouteMeasurement({
      ...route,
      lcpMs: 2500.01,
      inpMs: 200.01,
      cls: 0.10001,
    }),
    ["lcpMs", "inpMs", "cls"],
  );
  assert.deepEqual(
    evaluateSceneMeasurement({
      ...scene,
      sceneReadyMs: 4000.01,
      fps: 29.999,
    }),
    ["sceneReadyMs", "fps"],
  );
});

test("fails missing and non-finite measurements", () => {
  assert.deepEqual(
    evaluateRouteMeasurement({ route: "/", lcpMs: null, inpMs: NaN, cls: Infinity }),
    ["lcpMs", "inpMs", "cls"],
  );
  assert.deepEqual(
    evaluateSceneMeasurement({
      route: "/",
      sceneId: "home-hero",
      sceneReadyMs: 0,
      fps: null,
    }),
    ["sceneReadyMs", "fps"],
  );
});
```

- [ ] **Step 2: Run the focused Node test and verify RED**

Run:

```bash
node --test tests/quality/performance-gate.test.mjs
```

Expected: FAIL because `scripts/quality/performance-gate.mjs` does not exist.

- [ ] **Step 3: Implement the profile, collection, and evaluator**

Create `scripts/quality/performance-gate.mjs`:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

export const performanceThresholds = {
  lcpMs: 2_500,
  inpMs: 200,
  cls: 0.1,
  sceneReadyMs: 4_000,
  fps: 30,
};

function invalid(value, { positive = false } = {}) {
  return (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (positive && value <= 0)
  );
}

export function evaluateRouteMeasurement(measurement) {
  return [
    invalid(measurement.lcpMs, { positive: true }) ||
    measurement.lcpMs > performanceThresholds.lcpMs ? "lcpMs" : null,
    invalid(measurement.inpMs, { positive: true }) ||
    measurement.inpMs > performanceThresholds.inpMs ? "inpMs" : null,
    invalid(measurement.cls) ||
    measurement.cls > performanceThresholds.cls ? "cls" : null,
  ].filter(Boolean);
}

export function evaluateSceneMeasurement(measurement) {
  return [
    invalid(measurement.sceneReadyMs, { positive: true }) ||
    measurement.sceneReadyMs > performanceThresholds.sceneReadyMs
      ? "sceneReadyMs"
      : null,
    invalid(measurement.fps, { positive: true }) ||
    measurement.fps < performanceThresholds.fps ? "fps" : null,
  ].filter(Boolean);
}

const routeTargets = [
  { route: "/", heroSceneId: "home-hero" },
  { route: "/experience", heroSceneId: "experience-hero" },
  { route: "/projects", heroSceneId: "projects-hero" },
  { route: "/contact", heroSceneId: "contact-hero" },
];
const sceneTargets = [
  { route: "/", sceneId: "home-hero", hero: true },
  { route: "/experience", sceneId: "experience-hero", hero: true },
  { route: "/experience", sceneId: "experience-intro", hero: false },
  { route: "/experience", sceneId: "nasa-rocket", hero: false },
  { route: "/projects", sceneId: "projects-hero", hero: true },
  { route: "/projects", sceneId: "league-ban", hero: false },
  { route: "/projects", sceneId: "froggie-adventures", hero: false },
  { route: "/contact", sceneId: "contact-hero", hero: true },
];

async function installMetricObservers(page) {
  await page.addInitScript(() => {
    window.__siteQuality = {
      lcpMs: null,
      cls: 0,
      inpMs: null,
      eventTimingSupported: false,
      runtimeEvents: [],
    };

    try {
      window.__siteQuality.eventTimingSupported =
        PerformanceObserver.supportedEntryTypes?.includes("event") === true;
      if (!window.__siteQuality.eventTimingSupported) {
        throw new Error("Event Timing is unavailable");
      }
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) window.__siteQuality.lcpMs = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__siteQuality.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.interactionId > 0) {
            window.__siteQuality.inpMs = Math.max(
              window.__siteQuality.inpMs ?? 0,
              entry.duration,
            );
          }
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch {
      window.__siteQuality.observerFailure = true;
    }

    window.addEventListener("site:scene-runtime", (event) => {
      window.__siteQuality.runtimeEvents.push({
        at: performance.now(),
        detail: event.detail,
      });
    });
  });
}

async function applyMobileProfile(page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 165,
    downloadThroughput: 1_012_500,
    uploadThroughput: 168_750,
    connectionType: "cellular4g",
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

async function dragRotation(page, hitArea) {
  const box = await hitArea.boundingBox();
  if (!box) {
    throw new Error("The active rotation area has no visible bounding box");
  }

  const startX = box.x + box.width * 0.35;
  const endX = box.x + box.width * 0.65;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let step = 1; step <= 30; step += 1) {
    const x = startX + ((endX - startX) * step) / 30;
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function createProfilePage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1.5,
    isMobile: true,
    hasTouch: true,
  });
  const blockedTelemetry = [];
  await context.route("**/__ops", (route) => {
    blockedTelemetry.push(route.request().url());
    return route.abort();
  });
  await context.route("https://static.cloudflareinsights.com/**", (route) => {
    blockedTelemetry.push(route.request().url());
    return route.abort();
  });
  await context.route(/sentry/i, (route) => {
    blockedTelemetry.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  await installMetricObservers(page);
  await applyMobileProfile(page);
  return { context, page, blockedTelemetry };
}

async function assertWebGl2SwiftShader(page) {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) throw new Error("WebGL2 preflight failed");
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = extension
      ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    if (!/swiftshader/i.test(String(renderer))) {
      throw new Error(`Expected SwiftShader renderer, received ${renderer}`);
    }
    return String(renderer);
  });
}

async function measureRoute(browser, baseUrl, target) {
  const stability = await createProfilePage(browser);
  const interaction = await createProfilePage(browser);
  try {
    const url = new URL(target.route, baseUrl);
    url.searchParams.set("__lab", "1");
    const stabilityResponse = await stability.page.goto(url.href, {
      waitUntil: "domcontentloaded",
    });
    if (!stabilityResponse?.ok()) {
      throw new Error(`Route returned ${stabilityResponse?.status()}`);
    }
    const renderer = await assertWebGl2SwiftShader(stability.page);
    const stabilitySignal = await waitForSceneSignal(
      stability.page,
      target.heroSceneId,
      0,
    );
    await stability.page.waitForLoadState("networkidle");
    await stability.page.waitForTimeout(1000);
    const stableMetrics = await stability.page.evaluate(() => ({
      lcpMs: window.__siteQuality.lcpMs,
      cls: window.__siteQuality.cls,
      observerFailure: Boolean(window.__siteQuality.observerFailure),
    }));

    const interactionResponse = await interaction.page.goto(url.href, {
      waitUntil: "domcontentloaded",
    });
    if (!interactionResponse?.ok()) {
      throw new Error(`Route returned ${interactionResponse?.status()}`);
    }
    await assertWebGl2SwiftShader(interaction.page);
    const interactionSignal = await waitForSceneSignal(
      interaction.page,
      target.heroSceneId,
      0,
    );
    const preference = interaction.page.getByRole("button", {
      name: "3D on",
    });
    await preference.waitFor({ state: "visible", timeout: 11000 });
    await preference.click();
    await interaction.page.waitForFunction(() =>
      document
        .querySelector('button[aria-label="3D off"]')
        ?.getAttribute("aria-pressed") === "false",
    );
    await interaction.page.waitForTimeout(750);
    const interactionMetrics = await interaction.page.evaluate(() => ({
      inpMs:
        window.__siteQuality.inpMs ??
        (window.__siteQuality.eventTimingSupported ? 16 : null),
      inpBelowObserverThreshold:
        window.__siteQuality.inpMs === null &&
        window.__siteQuality.eventTimingSupported,
      observerFailure: Boolean(window.__siteQuality.observerFailure),
    }));
    return {
      route: target.route,
      renderer,
      lcpMs: stableMetrics.lcpMs,
      inpMs: interactionMetrics.inpMs,
      inpBelowObserverThreshold:
        interactionMetrics.inpBelowObserverThreshold,
      cls: stableMetrics.cls,
      observerFailure:
        stableMetrics.observerFailure || interactionMetrics.observerFailure,
      runtimeFailure:
        stabilitySignal.failure ?? interactionSignal.failure ?? null,
      collectionFailure:
        stabilitySignal.collectionFailure ??
        interactionSignal.collectionFailure ??
        null,
      blockedTelemetry: [
        ...stability.blockedTelemetry,
        ...interaction.blockedTelemetry,
      ],
    };
  } finally {
    await Promise.all([
      stability.context.close(),
      interaction.context.close(),
    ]);
  }
}

async function readSceneSignal(page, sceneId, activationAt) {
  return page.evaluate(
    ({ id, activated }) => {
      const mark = performance.getEntriesByName(`scene-ready:${id}`).at(-1);
      const relevant = window.__siteQuality.runtimeEvents.filter(
        ({ detail }) => detail?.sceneId === id,
      );
      const failure = relevant.find(({ detail }) =>
        detail.status === "failure" || detail.status === "context-lost",
      );
      return {
        sceneReadyMs: mark ? mark.startTime - activated : null,
        failure: failure?.detail ?? null,
      };
    },
    { id: sceneId, activated: activationAt },
  );
}

async function waitForSceneSignal(page, sceneId, activationAt) {
  const deadline = Date.now() + 11000;
  let signal = { sceneReadyMs: null, failure: null };
  while (Date.now() < deadline) {
    signal = await readSceneSignal(page, sceneId, activationAt);
    if (signal.sceneReadyMs !== null || signal.failure) return signal;
    await page.waitForTimeout(100);
  }
  return { ...signal, collectionFailure: "scene-ready-timeout-after-11000ms" };
}

async function measureScene(browser, baseUrl, target) {
  const profile = await createProfilePage(browser);
  try {
    const url = new URL(target.route, baseUrl);
    url.searchParams.set("__lab", "1");
    const response = await profile.page.goto(url.href, {
      waitUntil: "domcontentloaded",
    });
    if (!response?.ok()) throw new Error(`Route returned ${response?.status()}`);
    const renderer = await assertWebGl2SwiftShader(profile.page);
    const activationAt = target.hero
      ? 0
      : await profile.page.evaluate((sceneId) => {
          performance.clearMarks(`scene-ready:${sceneId}`);
          return performance.now();
        }, target.sceneId);
    if (!target.hero) {
      const section = profile.page.locator(
        `[data-scene-id="${target.sceneId}"]`,
      );
      await section.evaluate((element) =>
        element.scrollIntoView({ block: "center", inline: "nearest" }),
      );
      await profile.page
        .locator(`[data-active-scene-id="${target.sceneId}"]`)
        .waitFor({ state: "attached", timeout: 11000 });
    }
    const signal = await waitForSceneSignal(
      profile.page,
      target.sceneId,
      activationAt,
    );
    let fps = null;
    if (signal.sceneReadyMs !== null && !signal.failure) {
      await profile.page.evaluate((sceneId) => {
        window.__siteQuality.runtimeEvents =
          window.__siteQuality.runtimeEvents.filter(
            ({ detail }) =>
              !(detail?.sceneId === sceneId &&
                detail?.status === "rotation-health"),
          );
      }, target.sceneId);
      const hitArea = profile.page.getByTestId("scene-rotation-area");
      await hitArea.waitFor({ state: "visible", timeout: 11000 });
      await dragRotation(profile.page, hitArea);
      await profile.page.waitForTimeout(2500);
      fps = await profile.page.evaluate((sceneId) => {
        const event = window.__siteQuality.runtimeEvents.findLast(
          ({ detail }) =>
            detail?.sceneId === sceneId &&
            detail?.status === "rotation-health",
        );
        return event?.detail?.fps ?? null;
      }, target.sceneId);
    }

    return {
      route: target.route,
      sceneId: target.sceneId,
      renderer,
      sceneReadyMs: signal.sceneReadyMs,
      fps,
      runtimeFailure: signal.failure,
      collectionFailure: signal.collectionFailure ?? null,
      blockedTelemetry: profile.blockedTelemetry,
    };
  } finally {
    await profile.context.close();
  }
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });

  const routeMeasurements = [];
  const sceneMeasurements = [];
  const collectionFailures = [];
  try {
    for (const target of routeTargets) {
      try {
        routeMeasurements.push(await measureRoute(browser, baseUrl, target));
      } catch (error) {
        routeMeasurements.push({
          route: target.route,
          lcpMs: null,
          inpMs: null,
          cls: null,
        });
        collectionFailures.push({ route: target.route, error: String(error) });
      }
    }
    for (const target of sceneTargets) {
      try {
        sceneMeasurements.push(await measureScene(browser, baseUrl, target));
      } catch (error) {
        sceneMeasurements.push({
          route: target.route,
          sceneId: target.sceneId,
          sceneReadyMs: null,
          fps: null,
        });
        collectionFailures.push({ ...target, error: String(error) });
      }
    }
  } finally {
    await browser.close();
  }

  const failures = [
    ...routeMeasurements.flatMap((measurement) =>
      evaluateRouteMeasurement(measurement).map((metric) => ({
        route: measurement.route,
        metric,
        actual: measurement[metric],
        required: performanceThresholds[metric],
      })),
    ),
    ...sceneMeasurements.flatMap((measurement) =>
      evaluateSceneMeasurement(measurement).map((metric) => ({
        route: measurement.route,
        sceneId: measurement.sceneId,
        metric,
        actual: measurement[metric],
        required: performanceThresholds[metric],
      })),
    ),
    ...collectionFailures.map((failure) => ({
      metric: "collection",
      ...failure,
    })),
  ];
  for (const measurement of [...routeMeasurements, ...sceneMeasurements]) {
    if (measurement.observerFailure) {
      failures.push({
        route: measurement.route,
        sceneId: measurement.sceneId,
        metric: "performance-observer",
        actual: "observer initialization failed",
        required: "LCP, CLS, and Event Timing observers available",
      });
    }
    if ((measurement.blockedTelemetry ?? []).length > 0) {
      failures.push({
        route: measurement.route,
        sceneId: measurement.sceneId,
        metric: "telemetry-attempted-during-lab",
        actual: measurement.blockedTelemetry,
        required: [],
      });
    }
    if (measurement.runtimeFailure || measurement.collectionFailure) {
      failures.push({
        route: measurement.route,
        sceneId: measurement.sceneId,
        metric: "runtime-signal",
        actual: measurement.runtimeFailure ?? measurement.collectionFailure,
        required: "ready and rotation-health",
      });
    }
  }

  const round = (value, digits) =>
    typeof value === "number" && Number.isFinite(value)
      ? Number(value.toFixed(digits))
      : value;
  const report = {
    profile: {
      name: "mobile-fast-4g-cpu-4x-swiftshader-webgl2",
      viewport: { width: 390, height: 844, deviceScaleFactor: 1.5 },
      network: {
        preset: "Chromium Fast 4G CDP-adjusted",
        latencyMs: 165,
        downloadBps: 1012500,
        uploadBps: 168750,
      },
      cpuThrottlingRate: 4,
      reducedMotion: false,
      telemetry: "preview-disabled-and-network-blocked",
    },
    routeMeasurements: routeMeasurements.map((measurement) => ({
      ...measurement,
      lcpMs: round(measurement.lcpMs, 2),
      inpMs: round(measurement.inpMs, 2),
      cls: round(measurement.cls, 5),
    })),
    sceneMeasurements: sceneMeasurements.map((measurement) => ({
      ...measurement,
      sceneReadyMs: round(measurement.sceneReadyMs, 2),
      fps: round(measurement.fps, 2),
    })),
    failures,
  };
  const reportPath = resolve(
    import.meta.dirname,
    "../../reports/performance.json",
  );
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entryPath) {
  await main();
}
```

The `window.__siteQuality` object exists only inside isolated Playwright pages. Each route uses a no-input stability page through hero-ready, network idle, and a one-second quiet window for LCP/CLS, plus a separate fresh interaction page for INP; input can never terminate LCP collection on the stability page. INP is driven by one deterministic, state-verified click on the persistent `3D on` preference control. If Chromium's supported Event Timing observer produces no entry at its minimum 16 ms threshold, the report records 16 ms plus `inpBelowObserverThreshold: true` rather than treating a responsive click as missing; an unavailable observer still fails. Drag input is reserved for each scene's separate runtime-emitted rotation-FPS measurement. Activation time is captured before scrolling. Hero time is navigation-relative; every result uses the runtime's `scene-ready:<id>` mark. The collector waits 11 seconds so the runtime's 10-second timeout can surface, records rather than throws on failure, and uses only `rotation-health` for FPS. Threshold decisions use raw values; rounding happens only while serializing the report. The profile does not force reduced motion. WebGL2 and a SwiftShader renderer are hard preconditions. Preview environment values disable diagnostics, network routes provide a second safety barrier, and any attempted Cloudflare, Sentry, or custom telemetry request fails the lab gate.

- [ ] **Step 4: Run the evaluator test and verify GREEN**

Run:

```bash
node --test tests/quality/performance-gate.test.mjs
```

Expected: PASS with all three threshold tests.

- [ ] **Step 5: Expose cross-platform performance commands**

Run:

```bash
npm pkg set "scripts.quality:performance:run=node scripts/quality/performance-gate.mjs"
npm pkg set "scripts.quality:performance=start-server-and-test start http://127.0.0.1:3000 quality:performance:run"
```

Expected: both scripts appear in `package.json` exactly once. The aggregate starts an already-built preview; Task 9 owns the single sanitized preview build.

- [ ] **Step 6: Install the browser and defer the full profile to the sanitized Task 9 build**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium installs successfully. Do not run `quality:performance` against whatever stale `dist/` happens to exist at this task boundary. Task 9 first creates one sanitized preview build, then runs the full profile against that exact externally served artifact. That run must produce four route measurements combining no-input stability-page LCP/CLS with fresh toggle-click INP at the approved thresholds, plus eight live-scene readiness/rotation-FPS measurements, SwiftShader/WebGL 2 proof, no missing signal or telemetry attempt, and zero failures.

- [ ] **Step 7: Re-run the runtime-owned initial-waterfall contract**

Run:

```bash
npm run test:browser
```

Expected: PASS for every route case explicitly covered by `three-runtime.spec.ts`; do not infer untested routes from a single request assertion. Add a route case to that owning runtime spec before claiming broader waterfall coverage.

- [ ] **Step 8: Commit the repeatable performance gate**

Add these volatile lab/release outputs to `.gitignore`; they are generated on each run and must not change the approval-target digest or dirty a release checkout:

```gitignore
reports/*.json
reports/*.tmp
reports/*.tar.gz
```

```bash
git add scripts/quality/performance-gate.mjs tests/quality/performance-gate.test.mjs package.json package-lock.json .gitignore
git commit -m "test: gate web vitals and scene frame health"
```

## Task 8: Implement deferred, deterministic public-artifact generation

**Files:**

- Create: `tests/fixtures/social-card-outlined.svg`
- Create: `scripts/quality/generate-social-card.mjs`
- Create: `scripts/quality/validate-public-artifacts.mjs`
- Create: `tests/quality/public-artifacts.test.mjs`
- Create: `config/public-artifacts.json`
- Modify: `lib/site-metadata.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create only after owner copy and motifs are final: `assets/social-card.svg`
- Create only after final generation: `public/social-card.png` and `reports/public-artifacts.json`

The first pass implements and tests the renderer with an outlined fixture. It does not fabricate a final card while Richard's Home paragraphs and visual approval are pending.

- [ ] **Step 1: Write failing deterministic-render and pending-state tests**

Create `tests/fixtures/social-card-outlined.svg` with no `<text>` element and only deterministic vector geometry:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <title>Richard Phong</title>
  <desc>Personal home and interactive work</desc>
  <rect width="1200" height="630" fill="#EEEEEE"/>
  <path d="M0 0H600V315H0Z" fill="#9ECCC0"/>
  <path d="M600 0H1200V315H600Z" fill="#DFA9B5"/>
  <path d="M0 315H600V630H0Z" fill="#AFD4E1"/>
  <path d="M600 315H1200V630H600Z" fill="#C9BAE4"/>
  <path d="M110 170H210C290 170 330 205 330 270C330 320 305 350 260 362L342 470H265L195 372H178V470H110ZM178 230V318H208C243 318 260 304 260 274C260 244 243 230 208 230Z" fill="#135946"/>
  <path d="M390 170H505C585 170 625 208 625 282C625 356 585 394 505 394H458V470H390ZM458 230V334H499C537 334 556 317 556 282C556 247 537 230 499 230Z" fill="#4B2E7E"/>
  <path d="M720 205L865 120L835 238L720 300Z" fill="#285D71"/>
  <path d="M865 120L1020 222L835 238Z" fill="#722939"/>
  <path d="M720 300L835 238L960 390L795 438Z" fill="#9ECCC0"/>
</svg>
```

Create `tests/quality/public-artifacts.test.mjs`:

```js
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  assertOwnerContentFinal,
  renderOutlinedSocialCard,
} from "../../scripts/quality/generate-social-card.mjs";
import {
  validatePublicArtifacts,
  validateRendererRecord,
  validateSocialCardState,
} from "../../scripts/quality/validate-public-artifacts.mjs";

const root = resolve(import.meta.dirname, "../..");
const digest = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

test("renders an outlined SVG byte-for-byte deterministically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "social-card-"));
  try {
    const source = resolve(root, "tests/fixtures/social-card-outlined.svg");
    const first = join(directory, "first.png");
    const second = join(directory, "second.png");
    await renderOutlinedSocialCard(source, first);
    await renderOutlinedSocialCard(source, second);
    const [firstBytes, secondBytes, metadata] = await Promise.all([
      readFile(first),
      readFile(second),
      sharp(first).metadata(),
    ]);
    assert.equal(digest(firstBytes), digest(secondBytes));
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      { width: 1200, height: 630 },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("allows an explicit pending card in preview but blocks production", () => {
  assert.deepEqual(
    validateSocialCardState({ status: "pending" }, false),
    [],
  );
  assert.deepEqual(
    validateSocialCardState({ status: "pending" }, true),
    ["social-card-pending"],
  );
});

test("requires both owner fields to be literal, nonempty final prose", () => {
  assert.throws(
    () =>
      assertOwnerContentFinal(`
        const home = {
          nonWorkInterest: \`${"${OWNER_INPUT_SENTINEL}"} home.nonWorkInterest\`,
          technicalCuriosity: "",
        };
      `),
    /home\.nonWorkInterest, home\.technicalCuriosity/,
  );
  assert.throws(
    () =>
      assertOwnerContentFinal(`
        const home = {
          nonWorkInterest: "Games.",
          technicalCuriosity: "Three.js.",
        };
      `),
    /home\.nonWorkInterest, home\.technicalCuriosity/,
  );
  assert.doesNotThrow(() =>
    assertOwnerContentFinal(`
      const home = {
        nonWorkInterest: "I spend time making things away from a screen.",
        technicalCuriosity: "I keep exploring how 3D tools reach the web.",
      };
    `),
  );
});

test("binds renderer provenance to the installed Sharp version", () => {
  assert.deepEqual(
    validateRendererRecord({
      sharp: sharp.versions.sharp,
      textMode: "outlined-paths-only",
    }),
    [],
  );
  assert.deepEqual(
    validateRendererRecord({
      sharp: "0.0.0",
      textMode: "host-font-text",
    }),
    ["social-sharp-version", "social-text-mode"],
  );
});

test("always validates the immutable resume", async () => {
  const report = await validatePublicArtifacts(root, {
    requireSocialCard: false,
  });
  assert.equal(report.resume.bytes, 133744);
  assert.equal(
    report.resume.sha256,
    "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e",
  );
  assert.deepEqual(report.failures, []);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `node --test tests/quality/public-artifacts.test.mjs`.

Expected: FAIL because the renderer, validator, and explicit pending manifest do not exist.

- [ ] **Step 3: Record the immutable resume and explicit deferred card state**

Create `config/public-artifacts.json`:

```json
{
  "resume": {
    "path": "public/Richard-Phong-Resume.pdf",
    "bytes": 133744,
    "sha256": "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e"
  },
  "socialCard": {
    "status": "pending"
  }
}
```

This is an explicit pending state, never a guessed digest. Preview validation accepts it; production does not.

- [ ] **Step 4: Implement the outlined renderer and guarded final generator**

Create `scripts/quality/generate-social-card.mjs`:

```js
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function assertOwnerContentFinal(source) {
  const file = ts.createSourceFile(
    "site-content.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const required = new Set(["nonWorkInterest", "technicalCuriosity"]);
  const resolved = new Map();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === "home" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name.getText(file).replace(/["']/g, "");
        if (!required.has(name)) continue;
        const value =
          ts.isStringLiteral(property.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(property.initializer)
            ? property.initializer.text.trim()
            : "";
        resolved.set(name, value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const unresolved = [...required].filter((name) => {
    const value = resolved.get(name) ?? "";
    return value.length < 40 || value.includes("OWNER_INPUT_REQUIRED:");
  });
  if (unresolved.length > 0) {
    throw new Error(
      `Final social-card generation requires ${unresolved
        .map((name) => `home.${name}`)
        .join(", ")}`,
    );
  }
}

export async function renderOutlinedSocialCard(source, output) {
  const svg = await readFile(source, "utf8");
  if (
    /<(?:text|image|script|foreignObject)\b/i.test(svg) ||
    /\b(?:href|xlink:href)\s*=|url\s*\(/i.test(svg) ||
    !/<path\b/i.test(svg) ||
    !/<title>Richard Phong<\/title>/i.test(svg) ||
    !/<desc>Personal home and interactive work<\/desc>/i.test(svg)
  ) {
    throw new Error(
      "Social-card SVG must be self-contained outlined paths with approved title and description",
    );
  }
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg), { density: 144 })
    .resize(1200, 630, { fit: "fill" })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: false,
      palette: false,
      effort: 10,
    })
    .toFile(output);
}

async function fileDigest(root, path) {
  const bytes = await readFile(resolve(root, path));
  return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
}

export async function computeMotifInputs(root) {
  const paths = [
    "app/three/scene-registry.ts",
    "app/globals.css",
    "assets/blender/source-provenance.json",
    "content/site-content.ts",
    "public/models/assets-manifest.json",
    "public/posters/poster-manifest.json",
  ];
  const entries = await Promise.all(paths.map((path) => fileDigest(root, path)));
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    entries,
    sha256: sha256(
      Buffer.from(
        entries.map(({ path, sha256: digest }) => `${path}\0${digest}`).join("\n"),
      ),
    ),
  };
}

export async function generateFinalSocialCard(
  root = resolve(import.meta.dirname, "../.."),
) {
  const content = await readFile(resolve(root, "content/site-content.ts"), "utf8");
  assertOwnerContentFinal(content);

  const sourcePath = resolve(root, "assets/social-card.svg");
  const outputPath = resolve(root, "public/social-card.png");
  await mkdir(dirname(sourcePath), { recursive: true });
  await copyFile(
    resolve(root, "tests/fixtures/social-card-outlined.svg"),
    sourcePath,
  );
  await renderOutlinedSocialCard(sourcePath, outputPath);
  const [source, output, metadata, motifInputs, configuration] =
    await Promise.all([
      readFile(sourcePath),
      readFile(outputPath),
      sharp(outputPath).metadata(),
      computeMotifInputs(root),
      readFile(resolve(root, "config/public-artifacts.json"), "utf8").then(
        JSON.parse,
      ),
    ]);
  configuration.socialCard = {
    status: "generated",
    source: "assets/social-card.svg",
    path: "public/social-card.png",
    width: 1200,
    height: 630,
    sourceBytes: source.byteLength,
    sourceSha256: sha256(source),
    pngBytes: output.byteLength,
    pngSha256: sha256(output),
    motifInputsSha256: motifInputs.sha256,
    motifInputs: motifInputs.entries,
    renderer: {
      sharp: sharp.versions.sharp,
      textMode: "outlined-paths-only"
    },
    title: "Richard Phong",
    description: "Personal home and interactive work"
  };
  if (metadata.width !== 1200 || metadata.height !== 630) {
    throw new Error("Generated social card has incorrect dimensions");
  }
  await writeFile(
    resolve(root, "config/public-artifacts.json"),
    `${JSON.stringify(configuration, null, 2)}\n`,
  );
  return configuration.socialCard;
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  console.log(await generateFinalSocialCard());
}
```

The TypeScript AST guard requires both owner fields to be literal prose of at least 40 trimmed characters and rejects the foundation sentinel. The command deterministically promotes the complete reviewed fixture to `assets/social-card.svg`; it does not wait for an unspecified design step. The SVG contains the exact accessible title/description, outlined RP geometry, no host-font text, images, scripts, foreign objects, external references, or CSS URLs. The final manifest records all hashes and the installed Sharp version after generation, so it never contains guessed values.

- [ ] **Step 5: Implement resume validation and byte-for-byte social regeneration**

Create `scripts/quality/validate-public-artifacts.mjs`:

```js
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  computeMotifInputs,
  renderOutlinedSocialCard,
} from "./generate-social-card.mjs";

const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function validateSocialCardState(card, requireSocialCard) {
  if (card.status === "pending") {
    return requireSocialCard ? ["social-card-pending"] : [];
  }
  return card.status === "generated" ? [] : ["social-card-status"];
}

export function validateRendererRecord(renderer) {
  return [
    renderer?.sharp === sharp.versions.sharp
      ? null
      : "social-sharp-version",
    renderer?.textMode === "outlined-paths-only"
      ? null
      : "social-text-mode",
  ].filter(Boolean);
}

export async function validatePublicArtifacts(
  root = resolve(import.meta.dirname, "../.."),
  { requireSocialCard = false } = {},
) {
  const configuration = JSON.parse(
    await readFile(resolve(root, "config/public-artifacts.json"), "utf8"),
  );
  const resumePath = resolve(root, configuration.resume.path);
  const resume = await readFile(resumePath);
  const resumeStat = await stat(resumePath);
  const failures = [
    resumeStat.size === configuration.resume.bytes ? null : "resume-bytes",
    sha256(resume) === configuration.resume.sha256 ? null : "resume-sha256",
    ...validateSocialCardState(configuration.socialCard, requireSocialCard),
  ].filter(Boolean);
  const report = {
    resume: { bytes: resumeStat.size, sha256: sha256(resume) },
    socialCard: { status: configuration.socialCard.status },
    failures,
  };

  if (configuration.socialCard.status === "generated") {
    const card = configuration.socialCard;
    const [source, png, metadata, motifInputs] = await Promise.all([
      readFile(resolve(root, card.source)),
      readFile(resolve(root, card.path)),
      sharp(resolve(root, card.path)).metadata(),
      computeMotifInputs(root),
    ]);
    const directory = await mkdtemp(join(tmpdir(), "social-verify-"));
    try {
      const regenerated = join(directory, "social-card.png");
      await renderOutlinedSocialCard(resolve(root, card.source), regenerated);
      const regeneratedBytes = await readFile(regenerated);
      const checks = [
        source.byteLength === card.sourceBytes ? null : "social-source-bytes",
        sha256(source) === card.sourceSha256 ? null : "social-source-sha256",
        png.byteLength === card.pngBytes ? null : "social-png-bytes",
        sha256(png) === card.pngSha256 ? null : "social-png-sha256",
        sha256(regeneratedBytes) === card.pngSha256
          ? null
          : "social-regeneration-sha256",
        metadata.width === card.width ? null : "social-width",
        metadata.height === card.height ? null : "social-height",
        card.title === "Richard Phong" ? null : "social-title",
        card.description === "Personal home and interactive work"
          ? null
          : "social-description",
        ...validateRendererRecord(card.renderer),
        motifInputs.sha256 === card.motifInputsSha256
          ? null
          : "social-motif-inputs",
      ].filter(Boolean);
      report.socialCard = {
        status: card.status,
        sourceSha256: sha256(source),
        pngSha256: sha256(png),
        motifInputsSha256: motifInputs.sha256,
        width: metadata.width,
        height: metadata.height,
      };
      report.failures.push(...checks);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  return report;
}

async function main() {
  const root = resolve(import.meta.dirname, "../..");
  const report = await validatePublicArtifacts(root, {
    requireSocialCard: process.argv.includes("--require-social"),
  });
  const output = resolve(root, "reports/public-artifacts.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  if (report.failures.length > 0) {
    console.error(JSON.stringify(report.failures, null, 2));
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) await main();
```

- [ ] **Step 6: Keep preview metadata safe and add the no-referrer metadata fallback**

In `createPageMetadata` in `lib/site-metadata.ts`, add `referrer: "no-referrer"` to the shared `base` metadata object. Keep preview free of canonical and social URLs. In the existing production branch, point both Open Graph and Twitter image metadata to `/social-card.png` at exactly 1200x630. The Worker header remains the authoritative sitewide policy; the metadata value is a document-level fallback.

- [ ] **Step 7: Expose preview-safe and production artifact commands**

Run:

```bash
npm pkg set "scripts.generate:social-card=node scripts/quality/generate-social-card.mjs"
npm pkg set "scripts.quality:public=node scripts/quality/validate-public-artifacts.mjs"
npm pkg set "scripts.quality:public:gate=node scripts/quality/validate-public-artifacts.mjs --require-social"
node --test tests/quality/public-artifacts.test.mjs
npm run quality:public
```

Expected now: tests and preview-safe validation pass using the immutable resume and explicit pending social state. Do not run `generate:social-card` yet.

- [ ] **Step 8: Generate only after owner copy and motifs are stable**

After Richard supplies both paragraphs and approves the final visual motif:

```bash
npm run posters:check
npm run generate:social-card
npm run quality:public:gate
```

Expected: the outlined final SVG, PNG, source/output hashes, poster/model/provenance input hashes, dimensions, and Sharp version are recorded and regeneration is byte-identical. The release-approval record in Task 9 must bind to `pngSha256` and `motifInputsSha256`.

- [ ] **Step 9: Commit the implementation now; commit final artwork only when approved**

First-pass commit:

```bash
git add tests/fixtures/social-card-outlined.svg scripts/quality/generate-social-card.mjs scripts/quality/validate-public-artifacts.mjs tests/quality/public-artifacts.test.mjs config/public-artifacts.json lib/site-metadata.ts package.json package-lock.json
git commit -m "test: add deferred deterministic public artifact gate"
```

Later, after final generation:

```bash
git add assets/social-card.svg public/social-card.png config/public-artifacts.json
git commit -m "feat: finalize approved social preview artifact"
```


## Task 9: Assemble branch-safe acceptance, approval, and release gates

**Files:**

- Create: `tests/browser/site-acceptance.spec.ts`
- Create: `tests/browser/visual-regression.spec.ts`
- Create after owner copy is final: `tests/browser/visual-regression.spec.ts-snapshots/`
- Replace: `tests/rendered-html.test.mjs`
- Create: `config/release-approval.json`
- Create: `scripts/quality/release-approval.mjs`
- Create: `tests/quality/release-approval.test.mjs`
- Create after final review: `docs/release-evidence/` hashed notes and screenshots
- Create: `scripts/quality/validate-release.mjs`
- Create: `scripts/quality/run-preview-browser.mjs`
- Create: `scripts/quality/upload-sentry-sourcemaps.mjs`
- Create: `scripts/quality/package-validated-sites.mjs`
- Create: `scripts/quality/verify-sites-handoff.mjs`
- Replace: `tests/quality/release-environment.test.mjs`
- Create: `tests/quality/sentry-upload.test.mjs`
- Create: `tests/quality/sites-package.test.mjs`
- Create: `docs/release-checklist.md`
- Modify before approval: `.openai/hosting.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Generate but do not commit: `reports/release.json`, `reports/sentry-uploads.json`, `reports/sites-package.json`, and `reports/sites-package.tar.gz`

The release runner uses a clean Git index as its approval target, runs every lab/browser gate against a stripped, noindex, telemetry-disabled preview artifact, then performs exactly one production build. It injects and uploads non-overlapping client/Worker source-map scopes with identity-bound receipts, computes a deterministic post-upload production `dist/` manifest, hash-binds the configured Sites root wrapper plus its inner hosting helper, and invokes the root wrapper without rebuilding. The production-baked archive is saved only as a protected private Sites version before hostname promotion; it is never mislabeled as the sanitized preview artifact. Lifecycle reports and archives remain volatile and never become approval inputs.


- [ ] **Step 1: Add preview-safe semantic acceptance and deferred visual regression**

Create `tests/browser/site-acceptance.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const routes = ["/", "/experience", "/projects", "/contact"];
const profiles = [
  { name: "desktop", viewport: { width: 1920, height: 1080 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
];

for (const profile of profiles) {
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("personal-site:three-enabled", "off");
      });
    });

    for (const route of routes) {
      test(`${route} has a stable semantic shell`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("main h1")).toBeVisible();
        const navigation = page.getByRole("navigation", {
          name: "Primary navigation",
        });
        await expect(navigation).toBeVisible();
        await expect(navigation).toHaveCSS("position", "fixed");
        for (const href of routes) {
          const link = navigation.locator(`a[href="${href}"]`);
          await expect(link).toBeVisible();
          expect(
            await link.evaluate((element) => {
              const box = element.getBoundingClientRect();
              return (
                box.left >= 0 &&
                box.top >= 0 &&
                box.right <= window.innerWidth &&
                box.bottom <= window.innerHeight
              );
            }),
          ).toBe(true);
        }
        await expect(
          navigation.locator('[aria-current="page"]'),
        ).toHaveAttribute("href", route);
        await expect(page.locator("[data-scene-id]").first()).toBeVisible();
        await expect(
          page.locator('[data-scene-id] img').first(),
        ).toBeVisible();
        await expect(page.locator("canvas")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
          "content",
          /noindex/i,
        );
        await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      });
    }
  });
}

test("publishes exact contact and resume destinations", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator('a[href="mailto:richard.phong424@gmail.com"]')).toBeVisible();
  await expect(page.locator('a[href="https://linkedin.com/in/richard-phong/"]')).toBeVisible();
  await expect(page.locator('a[href="https://github.com/rphong"]')).toBeVisible();
  await expect(page.locator('a[href="tel:+12817776437"]')).toBeVisible();
  const resume = await page.request.get("/Richard-Phong-Resume.pdf");
  expect(resume.status()).toBe(200);
  expect(resume.headers()["content-type"]).toMatch(/application\/pdf/i);
});

test("publishes the Home and project repository destinations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href="https://github.com/rphong"]')).toBeVisible();
  await page.goto("/projects");
  await expect(
    page.locator('a[href="https://github.com/rphong/LeagueBanSite"]'),
  ).toBeVisible();
  await expect(
    page.locator('a[href="https://github.com/rphong/Froggie"]'),
  ).toBeVisible();
});
```

Create `tests/browser/visual-regression.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const routes = [
  { name: "home", path: "/" },
  { name: "experience", path: "/experience" },
  { name: "projects", path: "/projects" },
  { name: "contact", path: "/contact" },
];
const profiles = [
  { name: "desktop", viewport: { width: 1920, height: 1080 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
];

for (const profile of profiles) {
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });

    for (const route of routes) {
      test(`${route.name} matches the approved poster-first baseline`, async ({
        page,
      }) => {
        await page.addInitScript(() => {
          localStorage.setItem("personal-site:three-enabled", "off");
        });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText(
          "OWNER_INPUT_REQUIRED:",
        );
        await expect(page).toHaveScreenshot(
          `${route.name}-${profile.name}.png`,
          {
            fullPage: true,
            animations: "disabled",
            caret: "hide",
            scale: "css",
          },
        );
      });
    }
  });
}
```

`site-acceptance.spec.ts` is preview-safe and runs now. Do not create or approve visual baselines until both Home owner fields and final poster inputs are stable. Then make one sanitized preview build and run `test:visual:update`; its wrapper starts that built output and sets external-server mode, so baseline generation and strict comparison use identical server semantics. Inspect all eight images beside the four `ReferenceImages` exports, inspect mobile composition independently, and record each committed baseline hash in `config/release-approval.json`.


- [ ] **Step 2: Replace rendered HTML tests with a complete preview/production branch contract**

Replace `tests/rendered-html.test.mjs` completely:

```js
import assert from "node:assert/strict";
import test from "node:test";

const production = process.env.SITE_ENV === "production";
const siteUrl = process.env.SITE_URL;
const routes = [
  { path: "/", title: "Richard Phong" },
  { path: "/experience", title: "Experience | Richard Phong" },
  { path: "/projects", title: "Projects | Richard Phong" },
  { path: "/contact", title: "Contact | Richard Phong" },
];

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
      RELEASE_ID: process.env.RELEASE_ID,
      SITE_ENV: process.env.SITE_ENV,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function assertOrdered(haystack, values) {
  let previous = -1;
  for (const value of values) {
    const index = haystack.indexOf(value);
    assert.ok(index > previous, `${value} should appear in order`);
    previous = index;
  }
}

function assertSharedDocument(response, html, route) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(html, new RegExp(`<title>${escapeRegExp(route.title)}</title>`, "i"));
  assert.match(
    html,
    /<meta(?=[^>]*name=["']referrer["'])(?=[^>]*content=["']no-referrer["'])[^>]*>/i,
  );
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

  if (production) {
    assert.ok(siteUrl, "SITE_URL is required for production HTML tests");
    const robotsMeta = html.match(
      /<meta(?=[^>]*name=["']robots["'])[^>]*content=["']([^"']*)["'][^>]*>/i,
    );
    assert.ok(robotsMeta, "Production robots metadata is required");
    const robotsTokens = robotsMeta[1]
      .toLowerCase()
      .split(",")
      .map((token) => token.trim());
    assert.ok(robotsTokens.includes("index"));
    assert.ok(robotsTokens.includes("follow"));
    assert.ok(!robotsTokens.includes("noindex"));
    assert.ok(!robotsTokens.includes("nofollow"));
    const canonical = new URL(route.path, siteUrl).toString();
    assert.match(
      html,
      new RegExp(
        `<link(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']${escapeRegExp(canonical)}["'])[^>]*>`,
        "i",
      ),
    );
    assert.match(html, /social-card\.png/i);
    assert.doesNotMatch(html, /OWNER_INPUT_REQUIRED:/);
  } else {
    assert.match(
      html,
      /<meta(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex[^"']*nofollow)[^>]*>/i,
    );
    assert.doesNotMatch(html, /<link[^>]+rel=["']canonical["']/i);
    assert.doesNotMatch(html, /social-card\.png/i);
  }
}

for (const route of routes) {
  test(`server-renders ${route.path} for the active deployment branch`, async () => {
    const response = await render(route.path);
    const html = await response.text();
    assertSharedDocument(response, html, route);

    if (route.path === "/") {
      assert.match(html, /Welcome to my corner/i);
      assert.match(html, /Currently building software at EOG Resources/i);
    } else if (route.path === "/experience") {
      assertOrdered(html, ["NASA", "EOG Resources", "Paycom"]);
      assert.match(html, /href="\/Richard-Phong-Resume\.pdf"/);
    } else if (route.path === "/projects") {
      assertOrdered(html, ["League Ban Site", "Froggie Adventures"]);
      assert.match(html, /github\.com\/rphong\/LeagueBanSite/);
      assert.match(html, /github\.com\/rphong\/Froggie/);
      assert.doesNotMatch(html, /<iframe\b/i);
    } else {
      assert.match(html, /mailto:richard\.phong424@gmail\.com/);
      assert.match(html, /linkedin\.com\/in\/richard-phong/);
      assert.match(html, /github\.com\/rphong/);
      assert.match(html, /tel:\+12817776437/);
      assert.match(html, /Site diagnostics/i);
      assert.match(html, /independent five-percent samples/i);
      assert.match(html, /ten-percent sample/i);
    }
  });
}

test("robots matches the active deployment branch", async () => {
  const response = await render("/robots.txt");
  const body = await response.text();
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  if (production) {
    assert.match(body, /Allow:\s*\//i);
    assert.match(
      body,
      new RegExp(
        `Sitemap:\\s*${escapeRegExp(new URL("/sitemap.xml", siteUrl).toString())}`,
        "i",
      ),
    );
    assert.doesNotMatch(body, /Disallow:\s*\//i);
  } else {
    assert.match(body, /Disallow:\s*\//i);
    assert.doesNotMatch(body, /Sitemap:/i);
  }
});

test("sitemap exposes all routes only in production", async () => {
  const response = await render("/sitemap.xml");
  const body = await response.text();
  if (production) {
    for (const route of routes) {
      assert.match(
        body,
        new RegExp(escapeRegExp(new URL(route.path, siteUrl).toString())),
      );
    }
  } else {
    assert.doesNotMatch(body, /<url>/i);
  }
});
```

This test contains no draft-warning assertion. Production owner completeness is enforced by `validate:production` and the explicit absence of the sentinel; preview remains runnable before Richard supplies the paragraphs.


- [ ] **Step 3: Create a source/artifact-bound release approval record**

Create `config/release-approval.json`:

```json
{
  "status": "pending",
  "approvalTargetSha256": null,
  "bindings": {
    "resumeSha256": "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e",
    "socialCardSha256": null,
    "socialMotifInputsSha256": null,
    "rocketCanonicalSha256": null,
    "craneOnLeagueCanonicalSha256": null,
    "brandApprovalsSha256": null,
    "sitesHostingSha256": null,
    "sitesProjectId": null
  },
  "approvals": {
    "ownerContent": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "contrastReview": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "socialCardTextAndVisual": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "nasaRocketNoOfficialLogo": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "leagueRiotNoOfficialArtOrLogo": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "desktopFigmaComparison": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "mobileComposition": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "resumeSiteConsistency": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "sitesProjectProvisioning": {"status":"pending","reviewedBy":null,"reviewedOn":null,"evidence":[]},
    "monitoringConfiguration": {
      "status": "pending",
      "reviewedBy": null,
      "reviewedOn": null,
      "evidence": [],
      "settings": {
        "finalHostname": null,
        "cloudflareInstall": null,
        "cloudflareVisitSampleRate": null,
        "automaticInjection": null,
        "workerObservabilityTier": null,
        "workerLogsEnabled": null,
        "workerInvocationLogsEnabled": null,
        "sentryOrg": null,
        "sentryOrgId": null,
        "browserSentryProject": null,
        "browserSentryProjectId": null,
        "workerSentryProject": null,
        "workerSentryProjectId": null,
        "browserAlertTest": null,
        "workerAlertTest": null,
        "alertRecipient": null,
        "replayEnabled": null,
        "tracingEnabled": null,
        "paidOverageEnabled": null
      }
    },
    "androidSmoke": {
      "status": "pending",
      "outcome": null,
      "device": null,
      "unavailableReason": null,
      "reviewedBy": null,
      "reviewedOn": null,
      "evidence": []
    }
  }
}
```

Every evidence entry later has `{"path":"...","sha256":"..."}` and points either to a committed note under `docs/release-evidence/` or one of the eight exact Playwright baseline paths. Ignored `reports/*`, including the Sites tarball, ad-hoc local screenshots, and external-only links are not approval evidence. The desktop and mobile approvals bind directly to all eight committed baseline hashes. The social approval binds to the generated PNG and motif-input hashes. NASA binds to the canonical `rocket` source hash; League binds to `crane-on-league` plus `assets/brand-approvals.json`, which in turn binds the exact owned textures. Sites provisioning binds the committed `.openai/hosting.json` hash and persisted `project_id`; it must happen before the final evidence/approval target is computed. Android must be either `passed` with a device name or `unavailable` with a concrete reason; it cannot be silently skipped.

When approved, `monitoringConfiguration.settings` records the exact final hostname, `javascript-snippet-only`, a `0.05` Cloudflare clean/direct visit sample, automatic injection off, free Worker observability with invocation logs off, the exact Sentry organization slug/numeric ID and two distinct project slug/numeric-ID pairs, passed browser/Worker alert tests delivered to Richard, and replay/tracing/paid overage off. The strict runner parses each DSN and rejects any hostname, organization, project slug, organization ID, or project ID that differs from the approved release environment; swapping browser and Worker DSNs must fail.

- [ ] **Step 4: Write failing approval-target, binding, evidence, and Git-failure tests**

Create `tests/quality/release-approval.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGitCommandResult,
  evaluateReleaseApproval,
  hashApprovalTargetEntries,
  REQUIRED_EVIDENCE_PATHS,
} from "../../scripts/quality/release-approval.mjs";

const h = (letter) => letter.repeat(64);
const actual = {
  approvalTargetSha256: h("a"),
  resumeSha256: h("b"),
  socialCardSha256: h("c"),
  socialMotifInputsSha256: h("d"),
  rocketCanonicalSha256: h("e"),
  craneOnLeagueCanonicalSha256: h("f"),
  brandApprovalsSha256: h("1"),
  sitesHostingSha256: h("3"),
  sitesProjectId: "sites-project-123",
  trackedEvidencePaths: Object.values(REQUIRED_EVIDENCE_PATHS).flat(),
};

function approvedRecord() {
  const approval = {
    status: "approved",
    approvalTargetSha256: actual.approvalTargetSha256,
    bindings: {
      resumeSha256: actual.resumeSha256,
      socialCardSha256: actual.socialCardSha256,
      socialMotifInputsSha256: actual.socialMotifInputsSha256,
      rocketCanonicalSha256: actual.rocketCanonicalSha256,
      craneOnLeagueCanonicalSha256: actual.craneOnLeagueCanonicalSha256,
      brandApprovalsSha256: actual.brandApprovalsSha256,
      sitesHostingSha256: actual.sitesHostingSha256,
      sitesProjectId: actual.sitesProjectId,
    },
    approvals: {},
  };
  for (const key of [
    "ownerContent",
    "contrastReview",
    "socialCardTextAndVisual",
    "nasaRocketNoOfficialLogo",
    "leagueRiotNoOfficialArtOrLogo",
    "desktopFigmaComparison",
    "mobileComposition",
    "resumeSiteConsistency",
    "sitesProjectProvisioning",
    "monitoringConfiguration",
  ]) {
    approval.approvals[key] = {
      status: "approved",
      reviewedBy: "Richard Phong",
      reviewedOn: "2026-07-09",
      evidence: REQUIRED_EVIDENCE_PATHS[key].map((path) => ({
        path,
        sha256: h("2"),
      })),
    };
  }
  approval.approvals.monitoringConfiguration.settings = {
    finalHostname: "portfolio.example",
    cloudflareInstall: "javascript-snippet-only",
    cloudflareVisitSampleRate: 0.05,
    automaticInjection: false,
    workerObservabilityTier: "free",
    workerLogsEnabled: true,
    workerInvocationLogsEnabled: false,
    sentryOrg: "richard-phong",
    sentryOrgId: "123",
    browserSentryProject: "personal-site-browser",
    browserSentryProjectId: "456",
    workerSentryProject: "personal-site-worker",
    workerSentryProjectId: "789",
    browserAlertTest: "passed",
    workerAlertTest: "passed",
    alertRecipient: "Richard Phong",
    replayEnabled: false,
    tracingEnabled: false,
    paidOverageEnabled: false,
  };
  approval.approvals.androidSmoke = {
    status: "approved",
    outcome: "unavailable",
    device: null,
    unavailableReason: "No physical Android device was available before release.",
    reviewedBy: "Richard Phong",
    reviewedOn: "2026-07-09",
    evidence: REQUIRED_EVIDENCE_PATHS.androidSmoke.map((path) => ({
      path,
      sha256: h("2"),
    })),
  };
  return approval;
}

test("approval target ignores only its own blob and is order-stable", () => {
  const first = [
    { mode: "100644", blob: h("a"), path: "app/page.tsx" },
    { mode: "100644", blob: h("b"), path: "config/release-approval.json" },
  ];
  const second = [
    { mode: "100644", blob: h("c"), path: "config/release-approval.json" },
    first[0],
  ];
  assert.equal(hashApprovalTargetEntries(first), hashApprovalTargetEntries(second));
});

test("accepts complete hash-bound approval evidence", async () => {
  const failures = await evaluateReleaseApproval(
    approvedRecord(),
    actual,
    async () => h("2"),
  );
  assert.deepEqual(failures, []);
});

test("rejects a changed source binding and an unreviewed Android result", async () => {
  const approval = approvedRecord();
  approval.bindings.rocketCanonicalSha256 = h("9");
  approval.approvals.androidSmoke = {
    ...approval.approvals.androidSmoke,
    status: "pending",
    outcome: null,
    unavailableReason: null,
  };
  const failures = await evaluateReleaseApproval(
    approval,
    actual,
    async () => h("2"),
  );
  assert.ok(failures.includes("binding:rocketCanonicalSha256"));
  assert.ok(failures.includes("approval:androidSmoke"));
});

test("rejects ignored or non-committable evidence paths", async () => {
  const approval = approvedRecord();
  approval.approvals.contrastReview.evidence = [
    { path: "reports/contrast.json", sha256: h("2") },
  ];
  const failures = await evaluateReleaseApproval(
    approval,
    actual,
    async () => h("2"),
  );
  assert.ok(
    failures.includes("evidence:contrastReview:reports/contrast.json"),
  );
});

test("requires all four desktop and all four mobile evidence images", async () => {
  const approval = approvedRecord();
  approval.approvals.mobileComposition.evidence.pop();
  const failures = await evaluateReleaseApproval(
    approval,
    actual,
    async () => h("2"),
  );
  assert.ok(
    failures.includes(
      "evidence-required:mobileComposition:tests/browser/visual-regression.spec.ts-snapshots/contact-mobile.png",
    ),
  );
});

test("rejects a monitoring approval that enables automatic injection", async () => {
  const approval = approvedRecord();
  approval.approvals.monitoringConfiguration.settings.automaticInjection = true;
  const failures = await evaluateReleaseApproval(
    approval,
    actual,
    async () => h("2"),
    {
      hostname: "portfolio.example",
      sentryOrg: "richard-phong",
      sentryOrgId: "123",
      browserSentryProject: "personal-site-browser",
      browserSentryProjectId: "456",
      workerSentryProject: "personal-site-worker",
      workerSentryProjectId: "789",
    },
  );
  assert.ok(
    failures.includes(
      "approval:monitoringConfiguration:automatic-injection",
    ),
  );
});

test("reports a missing Git executable instead of skipping commit checks", () => {
  assert.throws(
    () =>
      assertGitCommandResult(
        { error: { code: "ENOENT", message: "spawn git ENOENT" } },
        ["rev-parse", "HEAD"],
      ),
    /git unavailable/i,
  );
});
```

- [ ] **Step 5: Implement stable index targeting and approval validation**

Create `scripts/quality/release-approval.mjs`:

```js
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APPROVAL_KEYS = [
  "ownerContent",
  "contrastReview",
  "socialCardTextAndVisual",
  "nasaRocketNoOfficialLogo",
  "leagueRiotNoOfficialArtOrLogo",
  "desktopFigmaComparison",
  "mobileComposition",
  "resumeSiteConsistency",
  "sitesProjectProvisioning",
  "monitoringConfiguration",
  "androidSmoke",
];
export const REQUIRED_EVIDENCE_PATHS = Object.freeze({
  ownerContent: ["docs/release-evidence/owner-content.md"],
  contrastReview: ["docs/release-evidence/contrast-review.md"],
  socialCardTextAndVisual: ["docs/release-evidence/social-card-review.md"],
  nasaRocketNoOfficialLogo: ["docs/release-evidence/nasa-rocket-review.md"],
  leagueRiotNoOfficialArtOrLogo: ["docs/release-evidence/league-brand-review.md"],
  desktopFigmaComparison: [
    "tests/browser/visual-regression.spec.ts-snapshots/home-desktop.png",
    "tests/browser/visual-regression.spec.ts-snapshots/experience-desktop.png",
    "tests/browser/visual-regression.spec.ts-snapshots/projects-desktop.png",
    "tests/browser/visual-regression.spec.ts-snapshots/contact-desktop.png",
  ],
  mobileComposition: [
    "tests/browser/visual-regression.spec.ts-snapshots/home-mobile.png",
    "tests/browser/visual-regression.spec.ts-snapshots/experience-mobile.png",
    "tests/browser/visual-regression.spec.ts-snapshots/projects-mobile.png",
    "tests/browser/visual-regression.spec.ts-snapshots/contact-mobile.png",
  ],
  resumeSiteConsistency: [
    "docs/release-evidence/resume-site-consistency.md",
  ],
  sitesProjectProvisioning: [
    "docs/release-evidence/sites-project.md",
  ],
  monitoringConfiguration: [
    "docs/release-evidence/monitoring-configuration.md",
  ],
  androidSmoke: ["docs/release-evidence/android-smoke.md"],
});
const BINDING_KEYS = [
  "resumeSha256",
  "socialCardSha256",
  "socialMotifInputsSha256",
  "rocketCanonicalSha256",
  "craneOnLeagueCanonicalSha256",
  "brandApprovalsSha256",
  "sitesHostingSha256",
  "sitesProjectId",
];
const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function hashApprovalTargetEntries(entries) {
  const canonical = entries
    .filter(({ path }) => path !== "config/release-approval.json")
    .map(({ mode, blob, path }) => `${mode} ${blob} ${path}\0`)
    .sort()
    .join("");
  return sha256(Buffer.from(canonical));
}

export function assertGitCommandResult(result, args) {
  if (result.error) {
    throw new Error(
      `git unavailable while running "git ${args.join(" ")}": ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `git command failed ("git ${args.join(" ")}"): ${String(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}

function runGit(root, args, encoding = "utf8") {
  return assertGitCommandResult(
    spawnSync(process.env.GIT_EXECUTABLE ?? "git", args, {
      cwd: root,
      encoding,
    }),
    args,
  );
}

export function readGitState(root) {
  const headCommit = runGit(root, ["rev-parse", "HEAD"]).stdout.trim();
  const status = runGit(root, ["status", "--porcelain"]).stdout;
  const rawIndex = runGit(root, ["ls-files", "--stage", "-z"], null).stdout;
  const entries = rawIndex
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(\d+) ([0-9a-f]+) \d+\t([\s\S]+)$/);
      if (!match) throw new Error(`Unparseable git index entry: ${entry}`);
      return { mode: match[1], blob: match[2], path: match[3] };
    });
  return {
    headCommit,
    clean: status === "",
    status,
    approvalTargetSha256: hashApprovalTargetEntries(entries),
    trackedPaths: entries.map(({ path }) => path),
  };
}

async function fileSha256(root, path) {
  return sha256(await readFile(resolve(root, path)));
}

export function validateSitesHostingConfiguration(hosting) {
  const failures = [];
  if (!hosting || typeof hosting !== "object" || Array.isArray(hosting)) {
    return ["hosting-object"];
  }
  const allowed = new Set(["project_id", "d1", "r2"]);
  for (const key of Object.keys(hosting)) {
    if (!allowed.has(key)) failures.push(`unexpected-key:${key}`);
  }
  if (
    typeof hosting.project_id !== "string" ||
    hosting.project_id.length === 0 ||
    hosting.project_id.trim() !== hosting.project_id ||
    /[\u0000-\u001f\u007f]/.test(hosting.project_id)
  ) {
    failures.push("project_id");
  }
  for (const key of ["d1", "r2"]) {
    const value = hosting[key];
    const empty =
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0);
    if (!empty) failures.push(`${key}-must-be-empty-for-v1`);
  }
  return failures.sort();
}

export async function readActualApprovalBindings(root, gitState) {
  const [publicArtifacts, provenance, hosting] = await Promise.all([
    readFile(resolve(root, "config/public-artifacts.json"), "utf8").then(JSON.parse),
    readFile(resolve(root, "assets/blender/source-provenance.json"), "utf8").then(JSON.parse),
    readFile(resolve(root, ".openai/hosting.json"), "utf8").then(JSON.parse),
  ]);
  const hostingFailures = validateSitesHostingConfiguration(hosting);
  if (hostingFailures.length > 0) {
    throw new Error(
      `Invalid .openai/hosting.json: ${hostingFailures.join(", ")}`,
    );
  }
  return {
    approvalTargetSha256: gitState.approvalTargetSha256,
    resumeSha256: publicArtifacts.resume.sha256,
    socialCardSha256: publicArtifacts.socialCard.pngSha256 ?? null,
    socialMotifInputsSha256:
      publicArtifacts.socialCard.motifInputsSha256 ?? null,
    rocketCanonicalSha256:
      provenance.models.rocket?.canonicalSha256 ?? null,
    craneOnLeagueCanonicalSha256:
      provenance.models["crane-on-league"]?.canonicalSha256 ?? null,
    brandApprovalsSha256: await fileSha256(
      root,
      "assets/brand-approvals.json",
    ),
    sitesHostingSha256: await fileSha256(root, ".openai/hosting.json"),
    sitesProjectId: hosting.project_id,
    trackedEvidencePaths: gitState.trackedPaths.filter((path) =>
      isReleaseEvidencePath(path),
    ),
  };
}

function reviewed(record) {
  return (
    record?.status === "approved" &&
    record.reviewedBy === "Richard Phong" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.reviewedOn ?? "") &&
    Array.isArray(record.evidence) &&
    record.evidence.length > 0
  );
}

function isReleaseEvidencePath(path) {
  return (
    typeof path === "string" &&
    (
      /^docs\/release-evidence\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) ||
      /^tests\/browser\/visual-regression\.spec\.ts-snapshots\/(?:home|experience|projects|contact)-(?:desktop|mobile)\.png$/.test(path)
    ) &&
    !path.split("/").includes("..")
  );
}

export function validateMonitoringConfiguration(record, expected = {}) {
  const settings = record?.settings ?? {};
  const failures = [];
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(settings.finalHostname ?? "")) {
    failures.push("final-hostname");
  }
  if (expected.hostname && settings.finalHostname !== expected.hostname) {
    failures.push("hostname-mismatch");
  }
  const exact = {
    cloudflareInstall: "javascript-snippet-only",
    cloudflareVisitSampleRate: 0.05,
    automaticInjection: false,
    workerObservabilityTier: "free",
    workerLogsEnabled: true,
    workerInvocationLogsEnabled: false,
    browserAlertTest: "passed",
    workerAlertTest: "passed",
    alertRecipient: "Richard Phong",
    replayEnabled: false,
    tracingEnabled: false,
    paidOverageEnabled: false,
  };
  for (const [key, expected] of Object.entries(exact)) {
    if (settings[key] !== expected) {
      failures.push(
        key === "automaticInjection"
          ? "automatic-injection"
          : `setting:${key}`,
      );
    }
  }
  if (
    !settings.sentryOrg?.trim() ||
    !/^\d+$/.test(settings.sentryOrgId ?? "") ||
    !settings.browserSentryProject?.trim() ||
    !/^\d+$/.test(settings.browserSentryProjectId ?? "") ||
    !settings.workerSentryProject?.trim() ||
    !/^\d+$/.test(settings.workerSentryProjectId ?? "") ||
    settings.browserSentryProjectId === settings.workerSentryProjectId ||
    settings.browserSentryProject === settings.workerSentryProject
  ) {
    failures.push("separate-sentry-projects");
  }
  if (
    expected.sentryOrg &&
    settings.sentryOrg !== expected.sentryOrg
  ) {
    failures.push("sentry-org-mismatch");
  }
  if (
    expected.sentryOrgId &&
    settings.sentryOrgId !== expected.sentryOrgId
  ) {
    failures.push("sentry-org-id-mismatch");
  }
  if (
    expected.browserSentryProject &&
    settings.browserSentryProject !== expected.browserSentryProject
  ) {
    failures.push("browser-sentry-project-mismatch");
  }
  if (
    expected.browserSentryProjectId &&
    settings.browserSentryProjectId !== expected.browserSentryProjectId
  ) {
    failures.push("browser-sentry-project-id-mismatch");
  }
  if (
    expected.workerSentryProject &&
    settings.workerSentryProject !== expected.workerSentryProject
  ) {
    failures.push("worker-sentry-project-mismatch");
  }
  if (
    expected.workerSentryProjectId &&
    settings.workerSentryProjectId !== expected.workerSentryProjectId
  ) {
    failures.push("worker-sentry-project-id-mismatch");
  }
  return failures;
}

export async function evaluateReleaseApproval(
  approval,
  actual,
  readEvidenceSha256,
  expectedMonitoring,
) {
  const failures = [];
  if (approval.status !== "approved") failures.push("status");
  if (approval.approvalTargetSha256 !== actual.approvalTargetSha256) {
    failures.push("approvalTargetSha256");
  }
  for (const key of BINDING_KEYS) {
    if (!actual[key] || approval.bindings?.[key] !== actual[key]) {
      failures.push(`binding:${key}`);
    }
  }
  if (
    [...Object.keys(approval.approvals ?? {})].sort().join("\n") !==
    [...APPROVAL_KEYS].sort().join("\n")
  ) {
    failures.push("approval-keys");
  }

  for (const key of APPROVAL_KEYS) {
    const record = approval.approvals?.[key];
    if (!reviewed(record)) {
      failures.push(`approval:${key}`);
      continue;
    }
    if (key === "androidSmoke") {
      const validOutcome =
        record.outcome === "passed" || record.outcome === "unavailable";
      if (
        !validOutcome ||
        (record.outcome === "passed" && !record.device?.trim()) ||
        (record.outcome === "unavailable" &&
          !record.unavailableReason?.trim())
      ) {
        failures.push("approval:androidSmoke-outcome");
      }
    }
    if (key === "monitoringConfiguration") {
      failures.push(
        ...validateMonitoringConfiguration(record, expectedMonitoring).map(
          (failure) => `approval:monitoringConfiguration:${failure}`,
        ),
      );
    }
    for (const requiredPath of REQUIRED_EVIDENCE_PATHS[key]) {
      if (!record.evidence.some(({ path }) => path === requiredPath)) {
        failures.push(`evidence-required:${key}:${requiredPath}`);
      }
    }
    for (const evidence of record.evidence) {
      if (
        !isReleaseEvidencePath(evidence?.path) ||
        !actual.trackedEvidencePaths.includes(evidence.path) ||
        !/^[0-9a-f]{64}$/.test(evidence.sha256 ?? "") ||
        (await readEvidenceSha256(evidence.path)) !== evidence.sha256
      ) {
        failures.push(`evidence:${key}:${evidence?.path ?? "missing"}`);
      }
    }
  }
  return failures;
}

export async function validateReleaseApproval(
  root,
  gitState,
  {
    expectedHostname,
    expectedSentryOrg,
    expectedSentryOrgId,
    expectedBrowserSentryProject,
    expectedBrowserSentryProjectId,
    expectedWorkerSentryProject,
    expectedWorkerSentryProjectId,
  } = {},
) {
  const [approval, actual] = await Promise.all([
    readFile(resolve(root, "config/release-approval.json"), "utf8").then(JSON.parse),
    readActualApprovalBindings(root, gitState),
  ]);
  return evaluateReleaseApproval(
    approval,
    actual,
    (path) => fileSha256(root, path),
    {
      hostname: expectedHostname,
      sentryOrg: expectedSentryOrg,
      sentryOrgId: expectedSentryOrgId,
      browserSentryProject: expectedBrowserSentryProject,
      browserSentryProjectId: expectedBrowserSentryProjectId,
      workerSentryProject: expectedWorkerSentryProject,
      workerSentryProjectId: expectedWorkerSentryProjectId,
    },
  );
}

async function main() {
  const root = resolve(import.meta.dirname, "../..");
  const gitState = readGitState(root);
  const actual = await readActualApprovalBindings(root, gitState);
  if (process.argv.includes("--print-bindings")) {
    console.log(JSON.stringify(actual, null, 2));
    return;
  }
  const expectedHostname = process.env.SITE_URL
    ? new URL(process.env.SITE_URL).hostname
    : undefined;
  const failures = await validateReleaseApproval(root, gitState, {
    expectedHostname,
    expectedSentryOrg: process.env.SENTRY_ORG,
    expectedSentryOrgId: process.env.SENTRY_ORG_ID,
    expectedBrowserSentryProject: process.env.SENTRY_BROWSER_PROJECT,
    expectedBrowserSentryProjectId: process.env.SENTRY_BROWSER_PROJECT_ID,
    expectedWorkerSentryProject: process.env.SENTRY_WORKER_PROJECT,
    expectedWorkerSentryProjectId: process.env.SENTRY_WORKER_PROJECT_ID,
  });
  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) await main();
```

The target digest uses sorted `mode blob path` Git-index entries and excludes only `config/release-approval.json`. Committing just the filled approval record leaves the target stable; any other tracked source, content, poster, baseline, or artifact change invalidates it. The strict runner separately requires `RELEASE_ID === git rev-parse HEAD` and a clean index/worktree.


- [ ] **Step 6: Write failing environment, preview-sanitization, and upload-state tests**

Replace `tests/quality/release-environment.test.mjs` completely:

```js
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  browserSuiteScript,
  createBrowserSuiteEnvironment,
} from "../../scripts/quality/run-preview-browser.mjs";
import {
  createSanitizedPreviewEnvironment,
  findLocalEnvironmentFiles,
  validateReleaseEnvironment,
} from "../../scripts/quality/validate-release.mjs";

const complete = {
  SITE_ENV: "production",
  NEXT_PUBLIC_SITE_ENV: "production",
  SITE_URL: "https://portfolio.example",
  RELEASE_ID: "a".repeat(40),
  NEXT_PUBLIC_RELEASE_ID: "a".repeat(40),
  NEXT_PUBLIC_SENTRY_DSN:
    "https://browser-key@o123.ingest.sentry.io/456",
  NEXT_PUBLIC_CF_BEACON_TOKEN: "cloudflare-token",
  SENTRY_DSN: "https://worker-key@o123.ingest.sentry.io/789",
  SENTRY_ORG: "richard-phong",
  SENTRY_ORG_ID: "123",
  SENTRY_BROWSER_PROJECT: "personal-site-browser",
  SENTRY_BROWSER_PROJECT_ID: "456",
  SENTRY_WORKER_PROJECT: "personal-site-worker",
  SENTRY_WORKER_PROJECT_ID: "789",
  SENTRY_AUTH_TOKEN: "private-token",
  SENTRY_ALIAS_DSN: "https://public@example.invalid/3",
  CLOUDFLARE_API_TOKEN: "must-not-reach-preview",
  SITES_PLUGIN_ROOT: resolve("/sites-plugin"),
  SITES_BASH_BIN: resolve("/bin/bash"),
};

test("accepts a complete production environment for the exact clean HEAD", () => {
  assert.deepEqual(
    validateReleaseEnvironment(complete, {
      headCommit: "a".repeat(40),
      clean: true,
    }),
    [],
  );
});

test("rejects preview mode, URL paths, divergent releases, dirty state, and non-HEAD IDs", () => {
  assert.deepEqual(
    validateReleaseEnvironment(
      {
        ...complete,
        SITE_ENV: "preview",
        NEXT_PUBLIC_RELEASE_ID: "b".repeat(40),
        SITE_URL: "https://portfolio.example/private",
      },
      { headCommit: "c".repeat(40), clean: false },
    ),
    [
      "SITE_ENV must equal production",
      "SITE_URL must be an HTTPS origin with no path, query, or fragment",
      "RELEASE_ID and NEXT_PUBLIC_RELEASE_ID must match",
      "RELEASE_ID must equal git rev-parse HEAD",
      "Git index and worktree must be clean",
    ],
  );
});

test("requires distinct browser and Worker Sentry destinations", () => {
  const failures = validateReleaseEnvironment(
    {
      ...complete,
      SENTRY_WORKER_PROJECT: complete.SENTRY_BROWSER_PROJECT,
      SENTRY_WORKER_PROJECT_ID: complete.SENTRY_BROWSER_PROJECT_ID,
      NEXT_PUBLIC_SENTRY_DSN:
        "https://browser-key@o123.ingest.sentry.io/456",
      SENTRY_DSN: "https://worker-key@o123.ingest.sentry.io/456",
    },
    { headCommit: "a".repeat(40), clean: true },
  );
  assert.ok(failures.includes("Sentry project names must be distinct"));
  assert.ok(failures.includes("Sentry project IDs must be distinct"));
  assert.ok(failures.includes("Sentry DSNs must target distinct projects"));
});

test("rejects swapped browser and Worker DSNs", () => {
  const failures = validateReleaseEnvironment(
    {
      ...complete,
      NEXT_PUBLIC_SENTRY_DSN: complete.SENTRY_DSN,
      SENTRY_DSN: complete.NEXT_PUBLIC_SENTRY_DSN,
    },
    { headCommit: "a".repeat(40), clean: true },
  );
  assert.ok(
    failures.includes(
      "NEXT_PUBLIC_SENTRY_DSN must match browser Sentry org/project IDs",
    ),
  );
  assert.ok(
    failures.includes(
      "SENTRY_DSN must match Worker Sentry org/project IDs",
    ),
  );
});

test("strips every production monitoring value from preview gates", () => {
  const preview = createSanitizedPreviewEnvironment(complete);
  assert.equal(preview.SITE_ENV, "preview");
  assert.equal(preview.NEXT_PUBLIC_SITE_ENV, "preview");
  assert.equal(preview.SITE_URL, "http://127.0.0.1:3000");
  assert.equal(preview.CI, "1");
  for (const key of [
    "NEXT_PUBLIC_SENTRY_DSN",
    "NEXT_PUBLIC_CF_BEACON_TOKEN",
    "SENTRY_DSN",
    "SENTRY_ORG",
    "SENTRY_ORG_ID",
    "SENTRY_BROWSER_PROJECT",
    "SENTRY_BROWSER_PROJECT_ID",
    "SENTRY_WORKER_PROJECT",
    "SENTRY_WORKER_PROJECT_ID",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ALIAS_DSN",
    "CLOUDFLARE_API_TOKEN",
  ]) {
    assert.equal(preview[key], "");
  }
});

test("rejects ignored dotenv files while allowing the tracked example", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-env-"));
  try {
    await writeFile(join(directory, ".env.example"), "SAFE=\n");
    await writeFile(
      join(directory, ".env.local"),
      "SENTRY_AUTH_TOKEN=secret\n",
    );
    await writeFile(join(directory, ".dev.vars"), "SENTRY_DSN=secret\n");
    assert.deepEqual(await findLocalEnvironmentFiles(directory), [
      ".dev.vars",
      ".env.local",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runs browser suites against one externally managed preview server", () => {
  const browser = createBrowserSuiteEnvironment(complete);
  assert.equal(browser.SITE_ENV, "preview");
  assert.equal(browser.NEXT_PUBLIC_SITE_ENV, "preview");
  assert.equal(browser.SCENE_CAPTURE, "1");
  assert.equal(browser.PLAYWRIGHT_EXTERNAL_SERVER, "1");
  assert.equal(browser.SENTRY_DSN, "");
  assert.equal(browser.CLOUDFLARE_API_TOKEN, "");
  assert.equal(browserSuiteScript("visual-update"), "test:visual:update:run");
});
```

Create `tests/quality/sentry-upload.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUploadTargets,
  evaluateUploadReceipts,
  matchesPriorReport,
  nextUploadAction,
  uploadTargetIdentitySha256,
} from "../../scripts/quality/upload-sentry-sourcemaps.mjs";

const environment = {
  SITE_ENV: "production",
  RELEASE_ID: "a".repeat(40),
  SENTRY_AUTH_TOKEN: "private-token",
  SENTRY_ORG: "richard-phong",
  SENTRY_ORG_ID: "123",
  SENTRY_BROWSER_PROJECT: "personal-site-browser",
  SENTRY_BROWSER_PROJECT_ID: "456",
  SENTRY_WORKER_PROJECT: "personal-site-worker",
  SENTRY_WORKER_PROJECT_ID: "789",
};
const hash = (letter) => letter.repeat(64);

test("builds two non-overlapping project upload targets", () => {
  assert.deepEqual(buildUploadTargets(environment), [
    {
      kind: "browser",
      organization: "richard-phong",
      organizationId: "123",
      project: "personal-site-browser",
      projectId: "456",
      release: environment.RELEASE_ID,
      directory: "dist/client",
    },
    {
      kind: "worker",
      organization: "richard-phong",
      organizationId: "123",
      project: "personal-site-worker",
      projectId: "789",
      release: environment.RELEASE_ID,
      directory: "dist/server",
    },
  ]);
});

test("rejects direct uploads without exact release and numeric identities", () => {
  assert.throws(
    () => buildUploadTargets({ ...environment, RELEASE_ID: "release-abc" }),
    /40-hex/i,
  );
  assert.throws(
    () => buildUploadTargets({ ...environment, SENTRY_ORG_ID: "org-123" }),
    /numeric/i,
  );
});

test("requires one successful counted receipt per exact project and scope", () => {
  const targets = buildUploadTargets(environment);
  const receipts = targets.map((target, index) => ({
    ...target,
    release: environment.RELEASE_ID,
    state: "uploaded",
    sourceMapCount: index + 1,
    javascriptCount: index + 2,
    manifestSha256: hash(index ? "b" : "a"),
    cliOutputSha256: hash(index ? "d" : "c"),
  }));
  assert.deepEqual(evaluateUploadReceipts(receipts, targets), []);
  assert.deepEqual(
    evaluateUploadReceipts(receipts.slice(0, 1), targets),
    ["receipt-count", "missing:worker"],
  );
  assert.deepEqual(
    evaluateUploadReceipts(
      [{ ...receipts[0], organization: "wrong-org" }, receipts[1]],
      targets,
    ),
    ["invalid:browser"],
  );
});

test("never retries uncertain or changed bytes for the same release scope", () => {
  const target = buildUploadTargets(environment)[0];
  assert.equal(nextUploadAction(undefined, target, hash("a")), "upload");
  assert.equal(
    nextUploadAction(
      { ...target, manifestSha256: hash("a"), state: "uploaded" },
      target,
      hash("a"),
    ),
    "reuse",
  );
  assert.equal(
    nextUploadAction(
      { ...target, manifestSha256: hash("a"), state: "uploading" },
      target,
      hash("a"),
    ),
    "reconcile",
  );
  assert.equal(
    nextUploadAction(
      { ...target, manifestSha256: hash("b"), state: "ambiguous" },
      target,
      hash("a"),
    ),
    "reconcile",
  );
  assert.equal(
    nextUploadAction(
      { ...target, manifestSha256: hash("b"), state: "uploaded" },
      target,
      hash("a"),
    ),
    "reconcile",
  );
  assert.equal(
    nextUploadAction(
      {
        ...target,
        organization: "wrong-org",
        manifestSha256: hash("a"),
        state: "uploaded",
      },
      target,
      hash("a"),
    ),
    "upload",
  );
  assert.equal(
    nextUploadAction(
      {
        ...target,
        release: "b".repeat(40),
        manifestSha256: hash("a"),
        state: "uploaded",
      },
      target,
      hash("a"),
    ),
    "upload",
  );
});

test("prior reports match the entire organization, release, and target identity", () => {
  const targets = buildUploadTargets(environment);
  const targetIdentitySha256 = uploadTargetIdentitySha256(targets);
  const report = {
    release: environment.RELEASE_ID,
    organization: environment.SENTRY_ORG,
    organizationId: environment.SENTRY_ORG_ID,
    targetIdentitySha256,
  };
  assert.equal(matchesPriorReport(report, targets), true);
  assert.equal(
    matchesPriorReport(
      { ...report, organization: "wrong-org" },
      targets,
    ),
    false,
  );
  assert.equal(
    matchesPriorReport(
      { ...report, release: "b".repeat(40) },
      targets,
    ),
    false,
  );
});
```

Create `tests/quality/sites-package.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  compareFileManifests,
  createSitesChildEnvironment,
  createExpectedArchiveManifest,
  hashFileManifest,
  resolveSitesPackageCommand,
  validateSitesHostingConfiguration,
  validateSitesPackagingPrerequisites,
} from "../../scripts/quality/package-validated-sites.mjs";
import { evaluateSitesHandoff } from "../../scripts/quality/verify-sites-handoff.mjs";

const h = (letter) => letter.repeat(64);

test("hashes a sorted path, byte-count, and content manifest", () => {
  const first = [
    { path: "server/index.js", bytes: 3, sha256: h("a") },
    { path: "client/app.js", bytes: 4, sha256: h("b") },
  ];
  assert.equal(hashFileManifest(first), hashFileManifest([...first].reverse()));
  assert.notEqual(
    hashFileManifest(first),
    hashFileManifest([{ ...first[0], bytes: 5 }, first[1]]),
  );
});

test("passes no monitoring credentials or release identity to the helper", () => {
  const child = createSitesChildEnvironment({
    PATH: "/usr/bin",
    TEMP: "/tmp",
    RELEASE_ID: "a".repeat(40),
    SENTRY_AUTH_TOKEN: "private-token",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
    NEXT_PUBLIC_CF_BEACON_TOKEN: "private-beacon",
  });
  assert.deepEqual(child, { PATH: "/usr/bin", TEMP: "/tmp" });
});

test("allows only project_id plus empty v1 logical bindings", () => {
  assert.deepEqual(
    validateSitesHostingConfiguration({
      project_id: "sites-project-123",
      d1: null,
      r2: null,
    }),
    [],
  );
  assert.deepEqual(
    validateSitesHostingConfiguration({
      project_id: "sites-project-123",
      d1: null,
      r2: null,
      source_write_credential: "must-never-be-tracked",
    }),
    ["unexpected-key:source_write_credential"],
  );
});

test("models the helper's hosting overlay and optional migrations exactly", () => {
  const production = [
    { path: ".openai/hosting.json", bytes: 1, sha256: h("a") },
    { path: "server/index.js", bytes: 2, sha256: h("b") },
  ];
  const hosting = {
    path: ".openai/hosting.json",
    bytes: 3,
    sha256: h("c"),
  };
  const migrations = [{ path: "0001.sql", bytes: 4, sha256: h("d") }];
  const expected = createExpectedArchiveManifest(
    production,
    hosting,
    migrations,
  );

  assert.deepEqual(expected, [
    { path: "dist/.openai/drizzle/0001.sql", bytes: 4, sha256: h("d") },
    { path: "dist/.openai/hosting.json", bytes: 3, sha256: h("c") },
    { path: "dist/server/index.js", bytes: 2, sha256: h("b") },
  ]);
  assert.deepEqual(compareFileManifests(expected, expected), []);
  assert.deepEqual(
    compareFileManifests(
      expected,
      expected.filter(({ path }) => path !== "dist/.openai/hosting.json"),
    ),
    ["missing:dist/.openai/hosting.json"],
  );
  assert.deepEqual(
    compareFileManifests(expected, [
      ...expected,
      { path: "unexpected-top-level.txt", bytes: 5, sha256: h("9") },
    ]),
    ["unexpected:unexpected-top-level.txt"],
  );
});

test("invokes only the configured root-level Sites helper through configured Bash", () => {
  const pluginRoot = resolve("/configured/sites-plugin");
  const bash = resolve("/configured/bash");
  const project = resolve("/workspace/personal-site");
  const archive = resolve("/workspace/personal-site/reports/sites-package.tar.gz");
  assert.deepEqual(
    resolveSitesPackageCommand(
      { SITES_PLUGIN_ROOT: pluginRoot, SITES_BASH_BIN: bash },
      project,
      archive,
    ),
    {
      command: bash,
      args: [
        resolve(pluginRoot, "scripts/package-site.sh"),
        project,
        archive,
      ],
    },
  );
});

test("preflights the actual helper, Bash, hosting bytes, and project ID", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sites-preflight-"));
  try {
    const project = resolve(directory, "project");
    const pluginRoot = resolve(directory, "plugin");
    const bash = resolve(directory, "bash");
    await mkdir(resolve(project, ".openai"), { recursive: true });
    await mkdir(resolve(pluginRoot, "scripts"), { recursive: true });
    await mkdir(
      resolve(pluginRoot, "skills/sites-hosting/scripts"),
      { recursive: true },
    );
    await writeFile(bash, "bash fixture\n");
    await writeFile(
      resolve(pluginRoot, "scripts/package-site.sh"),
      "package fixture\n",
    );
    await writeFile(
      resolve(pluginRoot, "skills/sites-hosting/scripts/package-site.sh"),
      "inner package fixture\n",
    );
    await writeFile(
      resolve(project, ".openai/hosting.json"),
      '{"project_id":"sites-project-123","d1":null,"r2":null}\n',
    );
    const result = await validateSitesPackagingPrerequisites(
      { SITES_PLUGIN_ROOT: pluginRoot, SITES_BASH_BIN: bash },
      project,
    );
    assert.equal(result.hosting.project_id, "sites-project-123");
    assert.match(result.hostingSha256, /^[0-9a-f]{64}$/);
    assert.match(result.packageScriptSha256, /^[0-9a-f]{64}$/);
    assert.match(result.innerPackageScriptSha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires the current clean HEAD, dist, archive, helper, and hosting binding", () => {
  const input = {
    gitState: {
      clean: true,
      headCommit: "a".repeat(40),
      approvalTargetSha256: h("b"),
    },
    releaseReport: {
      status: "passed",
      release: "a".repeat(40),
      siteUrl: "https://portfolio.example",
      approvalTargetSha256: h("b"),
      productionDistSha256: h("c"),
      sitesArchiveSha256: h("d"),
      sitesProjectId: "sites-project-123",
      sitesPackageScriptSha256: h("f"),
      sitesInnerPackageScriptSha256: h("1"),
    },
    packageReport: {
      status: "passed",
      commitSha: "a".repeat(40),
      productionDistSha256: h("c"),
      archiveSha256: h("d"),
      sitesProjectId: "sites-project-123",
      hostingSha256: h("e"),
      packageScriptSha256: h("f"),
      innerPackageScriptSha256: h("1"),
    },
    currentDistSha256: h("c"),
    currentArchiveSha256: h("d"),
    prerequisites: {
      hosting: { project_id: "sites-project-123" },
      hostingSha256: h("e"),
      packageScriptSha256: h("f"),
      innerPackageScriptSha256: h("1"),
    },
    expectedSiteUrl: "https://portfolio.example",
  };
  assert.deepEqual(evaluateSitesHandoff(input), []);
  assert.deepEqual(
    evaluateSitesHandoff({
      ...input,
      currentArchiveSha256: h("9"),
    }),
    ["archive-current"],
  );
  assert.deepEqual(
    evaluateSitesHandoff({
      ...input,
      packageReport: {
        ...input.packageReport,
        innerPackageScriptSha256: h("9"),
      },
    }),
    ["package-inner-helper-current"],
  );
});
```

- [ ] **Step 7: Implement the lifecycle-safe, two-environment release runner**

Create `scripts/quality/validate-release.mjs`:

```js
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  readGitState,
  validateReleaseApproval,
} from "./release-approval.mjs";
import {
  buildFileManifest,
  hashFileManifest,
  validateSitesPackagingPrerequisites,
} from "./package-validated-sites.mjs";

const root = resolve(import.meta.dirname, "../..");
const reportPath = resolve(root, "reports/release.json");
const monitoringKeys = [
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_CF_BEACON_TOKEN",
  "SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_ORG_ID",
  "SENTRY_BROWSER_PROJECT",
  "SENTRY_BROWSER_PROJECT_ID",
  "SENTRY_WORKER_PROJECT",
  "SENTRY_WORKER_PROJECT_ID",
  "SENTRY_AUTH_TOKEN",
];

export function parseSentryDsnIdentity(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.match(
      /^o(\d+)\.ingest(?:\.[a-z0-9-]+)*\.sentry\.io$/i,
    );
    const project = url.pathname.match(/^\/(\d+)\/?$/);
    if (
      url.protocol !== "https:" ||
      url.port !== "" ||
      !url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !host ||
      !project
    ) {
      return null;
    }
    return { orgId: host[1], projectId: project[1] };
  } catch {
    return null;
  }
}

export function validateReleaseEnvironment(environment, gitState) {
  const failures = [];
  if (environment.SITE_ENV !== "production") {
    failures.push("SITE_ENV must equal production");
  }
  if (environment.NEXT_PUBLIC_SITE_ENV !== "production") {
    failures.push("NEXT_PUBLIC_SITE_ENV must equal production");
  }
  try {
    const url = new URL(environment.SITE_URL ?? "");
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("origin-only");
    }
  } catch {
    failures.push(
      "SITE_URL must be an HTTPS origin with no path, query, or fragment",
    );
  }
  if (!environment.RELEASE_ID) {
    failures.push("RELEASE_ID is required");
  } else {
    if (!/^[0-9a-f]{40}$/.test(environment.RELEASE_ID)) {
      failures.push("RELEASE_ID must be an exact lowercase 40-hex Git ID");
    }
    if (environment.RELEASE_ID !== environment.NEXT_PUBLIC_RELEASE_ID) {
      failures.push("RELEASE_ID and NEXT_PUBLIC_RELEASE_ID must match");
    }
    if (environment.RELEASE_ID !== gitState.headCommit) {
      failures.push("RELEASE_ID must equal git rev-parse HEAD");
    }
  }
  if (!gitState.clean) {
    failures.push("Git index and worktree must be clean");
  }
  for (const key of monitoringKeys) {
    if (!environment[key]) failures.push(`${key} is required`);
  }
  if (
    environment.SENTRY_BROWSER_PROJECT &&
    environment.SENTRY_BROWSER_PROJECT === environment.SENTRY_WORKER_PROJECT
  ) {
    failures.push("Sentry project names must be distinct");
  }
  if (
    environment.SENTRY_BROWSER_PROJECT_ID &&
    environment.SENTRY_BROWSER_PROJECT_ID ===
      environment.SENTRY_WORKER_PROJECT_ID
  ) {
    failures.push("Sentry project IDs must be distinct");
  }
  const browserSentry = parseSentryDsnIdentity(
    environment.NEXT_PUBLIC_SENTRY_DSN,
  );
  const workerSentry = parseSentryDsnIdentity(environment.SENTRY_DSN);
  if (!browserSentry) failures.push("NEXT_PUBLIC_SENTRY_DSN is invalid");
  if (!workerSentry) failures.push("SENTRY_DSN is invalid");
  if (
    browserSentry &&
    (browserSentry.orgId !== environment.SENTRY_ORG_ID ||
      browserSentry.projectId !== environment.SENTRY_BROWSER_PROJECT_ID)
  ) {
    failures.push(
      "NEXT_PUBLIC_SENTRY_DSN must match browser Sentry org/project IDs",
    );
  }
  if (
    workerSentry &&
    (workerSentry.orgId !== environment.SENTRY_ORG_ID ||
      workerSentry.projectId !== environment.SENTRY_WORKER_PROJECT_ID)
  ) {
    failures.push(
      "SENTRY_DSN must match Worker Sentry org/project IDs",
    );
  }
  if (
    browserSentry &&
    workerSentry &&
    browserSentry.orgId === workerSentry.orgId &&
    browserSentry.projectId === workerSentry.projectId
  ) {
    failures.push("Sentry DSNs must target distinct projects");
  }
  for (const key of ["SITES_PLUGIN_ROOT", "SITES_BASH_BIN"]) {
    if (!environment[key] || !isAbsolute(environment[key])) {
      failures.push(`${key} must be an absolute configured path`);
    }
  }
  return failures;
}

export async function findLocalEnvironmentFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (/^\.env(?:\.|$)/.test(entry.name) ||
          /^\.dev\.vars(?:\.|$)/.test(entry.name)) &&
        entry.name !== ".env.example",
    )
    .map(({ name }) => name)
    .sort();
}

export function createSanitizedPreviewEnvironment(environment) {
  const preview = {
    ...environment,
    SITE_ENV: "preview",
    NEXT_PUBLIC_SITE_ENV: "preview",
    SITE_URL: "http://127.0.0.1:3000",
    RELEASE_ID: "preview-lab",
    NEXT_PUBLIC_RELEASE_ID: "preview-lab",
    CI: "1",
  };
  for (const key of monitoringKeys) preview[key] = "";
  for (const key of Object.keys(preview)) {
    if (
      /^(?:SENTRY|NEXT_PUBLIC_SENTRY|CLOUDFLARE|NEXT_PUBLIC_CF|CF_(?:API|ACCOUNT|ZONE|BEACON))/i.test(
        key,
      ) ||
      /(?:^|_)(?:TOKEN|DSN|SECRET|PASSWORD|API_KEY)$/i.test(key)
    ) {
      preview[key] = "";
    }
  }
  return preview;
}

async function writeReport(report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function run(label, command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Release gate failed: ${label}`);
  }
}

function npm(label, script, environment) {
  run(
    label,
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    environment,
  );
}

async function main() {
  const startedAt = new Date().toISOString();
  await writeReport({
    status: "running",
    release: process.env.RELEASE_ID ?? null,
    siteUrl: process.env.SITE_URL ?? null,
    startedAt,
    activeGate: "invalidate-stale-sites-artifacts",
  });
  await Promise.all([
    rm(resolve(root, "reports/sites-package.json"), { force: true }),
    rm(resolve(root, "reports/sites-package.tar.gz"), { force: true }),
  ]);
  let gitState;
  try {
    gitState = readGitState(root);
  } catch (error) {
    await writeReport({
      status: "failed",
      release: process.env.RELEASE_ID ?? null,
      siteUrl: process.env.SITE_URL ?? null,
      startedAt,
      finishedAt: new Date().toISOString(),
      failedGate: "git-state",
      error: String(error),
    });
    console.error(String(error));
    process.exitCode = 1;
    return;
  }
  const environmentFailures = validateReleaseEnvironment(
    process.env,
    gitState,
  );
  const localEnvironmentFiles = await findLocalEnvironmentFiles(root);
  if (localEnvironmentFiles.length > 0) {
    environmentFailures.push(
      `Local dotenv files are forbidden during release: ${localEnvironmentFiles.join(", ")}`,
    );
  }
  if (environmentFailures.length > 0) {
    await writeReport({
      status: "failed",
      release: process.env.RELEASE_ID ?? null,
      siteUrl: process.env.SITE_URL ?? null,
      startedAt,
      finishedAt: new Date().toISOString(),
      failedGate: "release-environment",
      error: environmentFailures.join("; "),
    });
    console.error(environmentFailures.join("\n"));
    process.exitCode = 1;
    return;
  }

  let activeGate = "release-approval";
  await writeReport({
    status: "running",
    release: process.env.RELEASE_ID,
    siteUrl: process.env.SITE_URL,
    startedAt,
    activeGate,
  });

  try {
    const approvalFailures = await validateReleaseApproval(root, gitState, {
      expectedHostname: new URL(process.env.SITE_URL).hostname,
      expectedSentryOrg: process.env.SENTRY_ORG,
      expectedSentryOrgId: process.env.SENTRY_ORG_ID,
      expectedBrowserSentryProject: process.env.SENTRY_BROWSER_PROJECT,
      expectedBrowserSentryProjectId:
        process.env.SENTRY_BROWSER_PROJECT_ID,
      expectedWorkerSentryProject: process.env.SENTRY_WORKER_PROJECT,
      expectedWorkerSentryProjectId:
        process.env.SENTRY_WORKER_PROJECT_ID,
    });
    if (approvalFailures.length > 0) {
      throw new Error(
        `Release approval failed: ${approvalFailures.join(", ")}`,
      );
    }

    const preview = createSanitizedPreviewEnvironment(process.env);
    const previewNpmGates = [
      ["typecheck", "typecheck"],
      ["unit tests", "test:unit"],
      ["quality unit tests", "test:quality"],
      ["lint", "lint"],
      ["pinned Blender preflight", "assets:preflight"],
      ["release asset validation", "assets:validate:release"],
      ["asset tests", "test:assets"],
      ["poster contract tests", "test:posters"],
      ["deterministic poster check", "posters:check"],
      ["contrast gate", "quality:contrast:gate"],
      ["public artifact gate", "quality:public:gate"],
      ["single preview build", "build"],
    ];
    for (const [label, script] of previewNpmGates) {
      activeGate = label;
      npm(label, script, preview);
    }

    activeGate = "preview rendered HTML";
    run(
      activeGate,
      process.execPath,
      ["--test", "tests/rendered-html.test.mjs"],
      preview,
    );
    activeGate = "preview browser, accessibility, visual, and performance";
    npm(activeGate, "test:preview-browser", preview);
    const previewManifest = await buildFileManifest(resolve(root, "dist"));
    const previewDistSha256 = hashFileManifest(previewManifest);

    activeGate = "Sites packaging prerequisite preflight";
    const sitesPrerequisites =
      await validateSitesPackagingPrerequisites(process.env, root);
    activeGate = "production content validation";
    npm(activeGate, "validate:production", process.env);
    activeGate = "single production build with hidden source maps";
    npm(activeGate, "build", process.env);
    activeGate = "one scoped source-map upload per Sentry project";
    npm(activeGate, "upload:sentry", process.env);
    const sentryUploads = JSON.parse(
      await readFile(resolve(root, "reports/sentry-uploads.json"), "utf8"),
    );
    if (
      sentryUploads.status !== "passed" ||
      sentryUploads.receipts?.length !== 2
    ) {
      throw new Error("Sentry upload receipts are incomplete");
    }
    activeGate = "production rendered HTML";
    run(
      activeGate,
      process.execPath,
      ["--test", "tests/rendered-html.test.mjs"],
      process.env,
    );
    activeGate = "exact Sites production package";
    npm(activeGate, "package:sites:validated", process.env);
    const sitesPackage = JSON.parse(
      await readFile(resolve(root, "reports/sites-package.json"), "utf8"),
    );
    if (
      sitesPackage.status !== "passed" ||
      sitesPackage.commitSha !== gitState.headCommit ||
      sitesPackage.productionDistSha256 === previewDistSha256 ||
      sitesPackage.sitesProjectId !==
        sitesPrerequisites.hosting.project_id ||
      sitesPackage.hostingSha256 !==
        sitesPrerequisites.hostingSha256 ||
      sitesPackage.packageScriptSha256 !==
        sitesPrerequisites.packageScriptSha256 ||
      sitesPackage.innerPackageScriptSha256 !==
        sitesPrerequisites.innerPackageScriptSha256 ||
      !/^[0-9a-f]{64}$/.test(sitesPackage.productionDistSha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(sitesPackage.archiveSha256 ?? "")
    ) {
      throw new Error("Sites package is not bound to exact validated HEAD");
    }

    activeGate = "final clean Git identity";
    const finalGitState = readGitState(root);
    if (
      !finalGitState.clean ||
      finalGitState.headCommit !== gitState.headCommit ||
      finalGitState.approvalTargetSha256 !==
        gitState.approvalTargetSha256
    ) {
      throw new Error(
        "Git HEAD, worktree, or approval target changed during release validation",
      );
    }

    await writeReport({
      status: "passed",
      release: gitState.headCommit,
      siteUrl: process.env.SITE_URL,
      approvalTargetSha256: gitState.approvalTargetSha256,
      previewDistSha256,
      productionDistSha256: sitesPackage.productionDistSha256,
      sitesArchiveSha256: sitesPackage.archiveSha256,
      sitesProjectId: sitesPackage.sitesProjectId,
      sitesPackageScriptSha256: sitesPackage.packageScriptSha256,
      sitesInnerPackageScriptSha256:
        sitesPackage.innerPackageScriptSha256,
      sentryUploads: sentryUploads.receipts,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    await writeReport({
      status: "failed",
      release: gitState.headCommit,
      siteUrl: process.env.SITE_URL,
      approvalTargetSha256: gitState.approvalTargetSha256,
      startedAt,
      finishedAt: new Date().toISOString(),
      failedGate: activeGate,
      error: String(error),
    });
    throw error;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  main().catch((error) => {
    console.error(String(error));
    process.exitCode = 1;
  });
}
```

Create `scripts/quality/run-preview-browser.mjs` so an already-built preview owns the only server and inner Playwright commands reuse it instead of attempting a second `npm run dev` on port 3000:

```js
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSanitizedPreviewEnvironment } from "./validate-release.mjs";

const root = resolve(import.meta.dirname, "../..");

export function createBrowserSuiteEnvironment(environment) {
  return {
    ...createSanitizedPreviewEnvironment(environment),
    SCENE_CAPTURE: "1",
    PLAYWRIGHT_EXTERNAL_SERVER: "1",
  };
}

export function browserSuiteScript(mode) {
  if (mode === "preview-safe") return "test:preview-safe-browser:run";
  if (mode === "strict") return "test:preview-browser:run";
  if (mode === "visual-update") return "test:visual:update:run";
  throw new Error(`Unknown preview browser suite: ${mode}`);
}

export function runPreviewBrowserSuite(mode, environment = process.env) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npx,
    [
      "start-server-and-test",
      "start",
      "http://127.0.0.1:3000",
      `npm run ${browserSuiteScript(mode)}`,
    ],
    {
      cwd: root,
      env: createBrowserSuiteEnvironment(environment),
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  process.exitCode = runPreviewBrowserSuite(process.argv[2]);
}
```

Create `scripts/quality/upload-sentry-sourcemaps.mjs`. It injects debug IDs, requires at least one JavaScript file and source map in each non-overlapping output scope, records state before each network attempt, and permits at most one upload for an organization/project/release/scope identity. An uploading/ambiguous receipt or an already-uploaded receipt whose manifest changed always requires manual reconciliation. Maps are removed only after both project uploads succeed:

```js
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const reportPath = resolve(root, "reports/sentry-uploads.json");
const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function buildUploadTargets(environment) {
  const required = [
    "RELEASE_ID",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_ORG_ID",
    "SENTRY_BROWSER_PROJECT",
    "SENTRY_BROWSER_PROJECT_ID",
    "SENTRY_WORKER_PROJECT",
    "SENTRY_WORKER_PROJECT_ID",
  ];
  if (environment.SITE_ENV !== "production") {
    throw new Error("Sentry upload requires SITE_ENV=production");
  }
  for (const key of required) {
    if (!environment[key]) throw new Error(`${key} is required`);
  }
  if (!/^[0-9a-f]{40}$/.test(environment.RELEASE_ID)) {
    throw new Error("Sentry upload RELEASE_ID must be exact lowercase 40-hex");
  }
  for (const key of [
    "SENTRY_ORG_ID",
    "SENTRY_BROWSER_PROJECT_ID",
    "SENTRY_WORKER_PROJECT_ID",
  ]) {
    if (!/^\d+$/.test(environment[key])) {
      throw new Error(`${key} must be numeric`);
    }
  }
  if (
    environment.SENTRY_BROWSER_PROJECT ===
    environment.SENTRY_WORKER_PROJECT
  ) {
    throw new Error("Sentry upload projects must be distinct");
  }
  if (
    environment.SENTRY_BROWSER_PROJECT_ID ===
    environment.SENTRY_WORKER_PROJECT_ID
  ) {
    throw new Error("Sentry upload project IDs must be distinct");
  }
  return [
    {
      kind: "browser",
      organization: environment.SENTRY_ORG,
      organizationId: environment.SENTRY_ORG_ID,
      project: environment.SENTRY_BROWSER_PROJECT,
      projectId: environment.SENTRY_BROWSER_PROJECT_ID,
      release: environment.RELEASE_ID,
      directory: "dist/client",
    },
    {
      kind: "worker",
      organization: environment.SENTRY_ORG,
      organizationId: environment.SENTRY_ORG_ID,
      project: environment.SENTRY_WORKER_PROJECT,
      projectId: environment.SENTRY_WORKER_PROJECT_ID,
      release: environment.RELEASE_ID,
      directory: "dist/server",
    },
  ];
}

export function nextUploadAction(existing, target, manifestSha256) {
  if (!existing) return "upload";
  if (
    existing.organization !== target.organization ||
    existing.organizationId !== target.organizationId ||
    existing.project !== target.project ||
    existing.projectId !== target.projectId ||
    existing.release !== target.release ||
    existing.directory !== target.directory
  ) {
    return "upload";
  }
  if (existing.state === "uploading" || existing.state === "ambiguous") {
    return "reconcile";
  }
  if (existing.state === "uploaded") {
    return existing.manifestSha256 === manifestSha256
      ? "reuse"
      : "reconcile";
  }
  return "reconcile";
}

export function evaluateUploadReceipts(receipts, targets) {
  const failures = [];
  if (receipts.length !== targets.length) failures.push("receipt-count");
  for (const target of targets) {
    const receipt = receipts.find(({ kind }) => kind === target.kind);
    if (!receipt) {
      failures.push(`missing:${target.kind}`);
      continue;
    }
    if (
      receipt.organization !== target.organization ||
      receipt.organizationId !== target.organizationId ||
      receipt.project !== target.project ||
      receipt.projectId !== target.projectId ||
      receipt.release !== target.release ||
      receipt.directory !== target.directory ||
      receipt.state !== "uploaded" ||
      !Number.isInteger(receipt.sourceMapCount) ||
      receipt.sourceMapCount < 1 ||
      !Number.isInteger(receipt.javascriptCount) ||
      receipt.javascriptCount < 1 ||
      !/^[0-9a-f]{64}$/.test(receipt.manifestSha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(receipt.cliOutputSha256 ?? "")
    ) {
      failures.push(`invalid:${target.kind}`);
    }
  }
  return failures;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function sourceManifest(target) {
  const directory = resolve(root, target.directory);
  const files = await walk(directory);
  const sourceMaps = files.filter((path) => path.endsWith(".map")).sort();
  const javascript = files
    .filter((path) => /\.(?:c|m)?js$/.test(path))
    .sort();
  if (sourceMaps.length < 1 || javascript.length < 1) {
    throw new Error(
      `${target.kind} output requires JavaScript and hidden source maps`,
    );
  }
  const hashed = [];
  for (const path of [...javascript, ...sourceMaps].sort()) {
    hashed.push(`${relative(root, path)}\0${sha256(await readFile(path))}`);
  }
  return {
    javascript,
    sourceMaps,
    sha256: sha256(Buffer.from(hashed.join("\n"))),
  };
}

export function uploadTargetIdentitySha256(targets) {
  const identity = targets.map(
    ({
      kind,
      organization,
      organizationId,
      project,
      projectId,
      release,
      directory,
    }) => ({
      kind,
      organization,
      organizationId,
      project,
      projectId,
      release,
      directory,
    }),
  );
  return sha256(Buffer.from(JSON.stringify(identity)));
}

export function matchesPriorReport(report, targets) {
  const [first] = targets;
  return Boolean(
    first &&
      report &&
      report.release === first.release &&
      report.organization === first.organization &&
      report.organizationId === first.organizationId &&
      report.targetIdentitySha256 === uploadTargetIdentitySha256(targets),
  );
}

async function readPriorReport(targets) {
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return matchesPriorReport(report, targets) ? report : null;
  } catch {
    return null;
  }
}

async function writeReport(report) {
  await mkdir(dirname(reportPath), { recursive: true });
  const temporary = `${reportPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
  await rename(temporary, reportPath);
}

function runCli(args, environment) {
  const binary = resolve(
    root,
    "node_modules/.bin",
    process.platform === "win32" ? "sentry-cli.cmd" : "sentry-cli",
  );
  const result = spawnSync(binary, args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const redactedOutput = environment.SENTRY_AUTH_TOKEN
    ? output.replaceAll(environment.SENTRY_AUTH_TOKEN, "[redacted-token]")
    : output;
  if (result.error || result.status !== 0) {
    throw new Error(
      result.error?.message ??
        `sentry-cli failed (${result.status}): ${redactedOutput}`,
    );
  }
  return redactedOutput;
}

function replaceReceipt(report, receipt) {
  report.receipts = [
    ...report.receipts.filter(({ kind }) => kind !== receipt.kind),
    receipt,
  ].sort((left, right) => left.kind.localeCompare(right.kind));
}

export async function uploadSentrySourceMaps(environment = process.env) {
  const targets = buildUploadTargets(environment);
  const targetIdentitySha256 = uploadTargetIdentitySha256(targets);
  const prior = await readPriorReport(targets);
  const report = prior ?? {
    status: "running",
    release: environment.RELEASE_ID,
    organization: environment.SENTRY_ORG,
    organizationId: environment.SENTRY_ORG_ID,
    targetIdentitySha256,
    receipts: [],
  };
  report.status = "running";
  await writeReport(report);
  const manifests = [];

  try {
    for (const target of targets) {
      runCli(["sourcemaps", "inject", target.directory], environment);
      const manifest = await sourceManifest(target);
      manifests.push(manifest);
      const existing = report.receipts.find(
        ({ kind }) => kind === target.kind,
      );
      const action = nextUploadAction(existing, target, manifest.sha256);
      if (action === "reconcile") {
        throw new Error(
          `${target.kind} already has uncertain state or different bytes for this organization/project/release/scope; inspect Sentry and reconcile reports/sentry-uploads.json before any retry`,
        );
      }
      if (action === "reuse") continue;

      const receipt = {
        ...target,
        state: "uploading",
        sourceMapCount: manifest.sourceMaps.length,
        javascriptCount: manifest.javascript.length,
        manifestSha256: manifest.sha256,
        cliOutputSha256: null,
      };
      replaceReceipt(report, receipt);
      await writeReport(report);
      try {
        const output = runCli(
          [
            "sourcemaps",
            "upload",
            "--org",
            target.organization,
            "--project",
            target.project,
            "--release",
            target.release,
            "--validate",
            target.directory,
          ],
          environment,
        );
        receipt.state = "uploaded";
        receipt.cliOutputSha256 = sha256(Buffer.from(output));
      } catch (error) {
        receipt.state = "ambiguous";
        await writeReport(report);
        throw error;
      }
      await writeReport(report);
    }

    const failures = evaluateUploadReceipts(report.receipts, targets);
    if (failures.length > 0) {
      throw new Error(`Invalid Sentry upload receipts: ${failures.join(", ")}`);
    }
    for (const manifest of manifests) {
      for (const path of manifest.sourceMaps) {
        await rm(path, { force: true });
      }
    }
    report.status = "passed";
    report.finishedAt = new Date().toISOString();
    await writeReport(report);
    return report;
  } catch (error) {
    report.status = "failed";
    report.finishedAt = new Date().toISOString();
    await writeReport(report);
    throw error;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  uploadSentrySourceMaps().catch((error) => {
    console.error(String(error));
    process.exitCode = 1;
  });
}
```

Create `scripts/quality/package-validated-sites.mjs`. This script never builds. It snapshots the post-upload production `dist/`, rejects residual source maps, and preflights/hashes both the configured root wrapper at `scripts/package-site.sh` and the inner helper it executes at `skills/sites-hosting/scripts/package-site.sh`. It invokes only the root wrapper through configured Bash, extracts the archive, manifests the entire extraction root with `dist/`-prefixed expected paths, rejects symlinks anywhere and any file outside the exact `dist/` package, and proves every archived file matches the expected production bytes plus the documented hosting/migration overlay:

```js
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateSitesHostingConfiguration } from "./release-approval.mjs";
export { validateSitesHostingConfiguration } from "./release-approval.mjs";

const root = resolve(import.meta.dirname, "../..");
const reportPath = resolve(root, "reports/sites-package.json");
const archivePath = resolve(root, "reports/sites-package.tar.gz");
const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const comparePath = (left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0;

export async function buildFileManifest(directory) {
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symlinks are forbidden in Sites artifacts: ${absolute}`);
      }
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        files.push({
          path: relative(directory, absolute).replaceAll("\\", "/"),
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
        });
      }
    }
  }
  await walk(directory);
  return files.sort(comparePath);
}

export function hashFileManifest(manifest) {
  const canonical = [...manifest]
    .sort(comparePath)
    .map(({ path, bytes, sha256 }) => `${path}\0${bytes}\0${sha256}\n`)
    .join("");
  return sha256(Buffer.from(canonical));
}

export function createExpectedArchiveManifest(
  production,
  hosting,
  migrations = [],
) {
  const expected = new Map(
    production
      .filter(({ path }) => path !== ".openai/hosting.json")
      .map((entry) => [
        `dist/${entry.path}`,
        { ...entry, path: `dist/${entry.path}` },
      ]),
  );
  expected.set("dist/.openai/hosting.json", {
    ...hosting,
    path: "dist/.openai/hosting.json",
  });
  for (const migration of migrations) {
    const path = `dist/.openai/drizzle/${migration.path}`;
    expected.set(path, { ...migration, path });
  }
  return [...expected.values()].sort(comparePath);
}

export function compareFileManifests(expected, actual) {
  const failures = [];
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry]));
  for (const [path, entry] of expectedByPath) {
    const candidate = actualByPath.get(path);
    if (!candidate) failures.push(`missing:${path}`);
    else if (
      candidate.bytes !== entry.bytes ||
      candidate.sha256 !== entry.sha256
    ) {
      failures.push(`changed:${path}`);
    }
  }
  for (const path of actualByPath.keys()) {
    if (!expectedByPath.has(path)) failures.push(`unexpected:${path}`);
  }
  return failures.sort();
}

export function createSitesChildEnvironment(environment) {
  const allowed = [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "PATHEXT",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE",
    "LANG",
    "LC_ALL",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => typeof environment[key] === "string")
      .map((key) => [key, environment[key]]),
  );
}

export function resolveSitesPackageCommand(environment, project, archive) {
  for (const key of ["SITES_PLUGIN_ROOT", "SITES_BASH_BIN"]) {
    if (!environment[key] || !isAbsolute(environment[key])) {
      throw new Error(`${key} must be an absolute configured path`);
    }
  }
  return {
    command: environment.SITES_BASH_BIN,
    args: [
      resolve(environment.SITES_PLUGIN_ROOT, "scripts/package-site.sh"),
      project,
      archive,
    ],
  };
}

export async function validateSitesPackagingPrerequisites(
  environment,
  project = root,
) {
  const packageCommand = resolveSitesPackageCommand(
    environment,
    project,
    archivePath,
  );
  const [packageScript] = packageCommand.args;
  const innerPackageScript = resolve(
    environment.SITES_PLUGIN_ROOT,
    "skills/sites-hosting/scripts/package-site.sh",
  );
  if (!(await stat(packageCommand.command)).isFile()) {
    throw new Error("SITES_BASH_BIN is not a file");
  }
  if (!(await stat(packageScript)).isFile()) {
    throw new Error("Configured Sites scripts/package-site.sh is not a file");
  }
  if (!(await stat(innerPackageScript)).isFile()) {
    throw new Error(
      "Configured Sites skills/sites-hosting/scripts/package-site.sh is not a file",
    );
  }
  const hostingBytes = await readFile(resolve(project, ".openai/hosting.json"));
  const hosting = JSON.parse(hostingBytes.toString("utf8"));
  const hostingFailures = validateSitesHostingConfiguration(hosting);
  if (hostingFailures.length > 0) {
    throw new Error(
      `Invalid .openai/hosting.json: ${hostingFailures.join(", ")}`,
    );
  }
  return {
    packageCommand,
    packageScript,
    packageScriptSha256: sha256(await readFile(packageScript)),
    innerPackageScript,
    innerPackageScriptSha256: sha256(
      await readFile(innerPackageScript),
    ),
    hosting,
    hostingBytes,
    hostingSha256: sha256(hostingBytes),
  };
}

async function optionalManifest(directory) {
  try {
    return (await stat(directory)).isDirectory()
      ? buildFileManifest(directory)
      : [];
  } catch {
    return [];
  }
}

async function writeReport(report) {
  await mkdir(dirname(reportPath), { recursive: true });
  const temporary = `${reportPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
  await rename(temporary, reportPath);
}

function run(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: createSitesChildEnvironment(environment),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      result.error?.message ??
        `Sites packaging command failed (${result.status}): ${String(result.stderr ?? "").trim()}`,
    );
  }
}

export async function packageValidatedSitesArtifact(
  environment = process.env,
) {
  if (
    environment.SITE_ENV !== "production" ||
    !/^[0-9a-f]{40}$/.test(environment.RELEASE_ID ?? "")
  ) {
    throw new Error("Sites packaging requires production and exact RELEASE_ID");
  }
  const lifecycle = {
    status: "running",
    release: environment.RELEASE_ID,
    startedAt: new Date().toISOString(),
  };
  await writeReport(lifecycle);

  try {
    const {
      packageCommand,
      packageScriptSha256,
      innerPackageScriptSha256,
      hosting,
      hostingBytes,
    } = await validateSitesPackagingPrerequisites(environment, root);

    const productionManifest = await buildFileManifest(resolve(root, "dist"));
    if (productionManifest.some(({ path }) => path.endsWith(".map"))) {
      throw new Error("Source maps must be uploaded and removed before Sites packaging");
    }
    const hostingEntry = {
      path: ".openai/hosting.json",
      bytes: hostingBytes.byteLength,
      sha256: sha256(hostingBytes),
    };
    const migrations = await optionalManifest(resolve(root, "drizzle"));
    const expectedArchiveManifest = createExpectedArchiveManifest(
      productionManifest,
      hostingEntry,
      migrations,
    );

    run(packageCommand.command, packageCommand.args, environment);

    const extraction = await mkdtemp(resolve(tmpdir(), "sites-package-"));
    let archivedManifest;
    try {
      run(
        packageCommand.command,
        [
          "-c",
          'set -euo pipefail; mkdir -p "$2"; tar -xzf "$1" -C "$2"',
          "sites-package-extract",
          archivePath,
          extraction,
        ],
        environment,
      );
      archivedManifest = await buildFileManifest(extraction);
    } finally {
      await rm(extraction, { recursive: true, force: true });
    }
    const archiveFailures = compareFileManifests(
      expectedArchiveManifest,
      archivedManifest,
    );
    if (archiveFailures.length > 0) {
      throw new Error(`Sites archive mismatch: ${archiveFailures.join(", ")}`);
    }

    const archiveBytes = await readFile(archivePath);
    const report = {
      ...lifecycle,
      status: "passed",
      finishedAt: new Date().toISOString(),
      commitSha: environment.RELEASE_ID,
      sitesProjectId: hosting.project_id,
      productionDistSha256: hashFileManifest(productionManifest),
      archivedPackageSha256: hashFileManifest(archivedManifest),
      archiveSha256: sha256(archiveBytes),
      hostingSha256: hostingEntry.sha256,
      packageScriptSha256,
      innerPackageScriptSha256,
      productionManifest,
      archiveManifest: archivedManifest,
    };
    await writeReport(report);
    return report;
  } catch (error) {
    await writeReport({
      ...lifecycle,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: String(error),
    });
    throw error;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  packageValidatedSitesArtifact().catch((error) => {
    console.error(String(error));
    process.exitCode = 1;
  });
}
```

Create `scripts/quality/verify-sites-handoff.mjs`. Run it immediately before saving a Sites version; it is the final read-only bridge from the local release proof to the connector call:

```js
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildFileManifest,
  hashFileManifest,
  validateSitesPackagingPrerequisites,
} from "./package-validated-sites.mjs";
import { readGitState } from "./release-approval.mjs";

const root = resolve(import.meta.dirname, "../..");
const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function evaluateSitesHandoff({
  gitState,
  releaseReport,
  packageReport,
  currentDistSha256,
  currentArchiveSha256,
  prerequisites,
  expectedSiteUrl,
}) {
  const failures = [];
  if (!gitState.clean) failures.push("git-clean");
  if (releaseReport.status !== "passed") failures.push("release-status");
  if (packageReport.status !== "passed") failures.push("package-status");
  if (!expectedSiteUrl || releaseReport.siteUrl !== expectedSiteUrl) {
    failures.push("site-url");
  }
  if (
    releaseReport.release !== gitState.headCommit ||
    packageReport.commitSha !== gitState.headCommit
  ) {
    failures.push("commit-sha");
  }
  if (
    releaseReport.approvalTargetSha256 !==
    gitState.approvalTargetSha256
  ) {
    failures.push("approval-target");
  }
  if (
    releaseReport.sitesProjectId !== prerequisites.hosting.project_id ||
    packageReport.sitesProjectId !== prerequisites.hosting.project_id
  ) {
    failures.push("sites-project-id");
  }
  if (
    releaseReport.productionDistSha256 !==
      packageReport.productionDistSha256 ||
    packageReport.productionDistSha256 !== currentDistSha256
  ) {
    failures.push("dist-current");
  }
  if (
    releaseReport.sitesArchiveSha256 !== packageReport.archiveSha256 ||
    packageReport.archiveSha256 !== currentArchiveSha256
  ) {
    failures.push("archive-current");
  }
  if (
    packageReport.hostingSha256 !== prerequisites.hostingSha256
  ) {
    failures.push("hosting-current");
  }
  if (
    releaseReport.sitesPackageScriptSha256 !==
      packageReport.packageScriptSha256 ||
    packageReport.packageScriptSha256 !==
      prerequisites.packageScriptSha256
  ) {
    failures.push("package-helper-current");
  }
  if (
    releaseReport.sitesInnerPackageScriptSha256 !==
      packageReport.innerPackageScriptSha256 ||
    packageReport.innerPackageScriptSha256 !==
      prerequisites.innerPackageScriptSha256
  ) {
    failures.push("package-inner-helper-current");
  }
  return failures.sort();
}

export async function verifySitesHandoff(environment = process.env) {
  const [releaseReport, packageReport, prerequisites] = await Promise.all([
    readFile(resolve(root, "reports/release.json"), "utf8").then(JSON.parse),
    readFile(resolve(root, "reports/sites-package.json"), "utf8").then(JSON.parse),
    validateSitesPackagingPrerequisites(environment, root),
  ]);
  const [currentManifest, archiveBytes] = await Promise.all([
    buildFileManifest(resolve(root, "dist")),
    readFile(resolve(root, "reports/sites-package.tar.gz")),
  ]);
  const gitState = readGitState(root);
  const currentDistSha256 = hashFileManifest(currentManifest);
  const currentArchiveSha256 = sha256(archiveBytes);
  const failures = evaluateSitesHandoff({
    gitState,
    releaseReport,
    packageReport,
    currentDistSha256,
    currentArchiveSha256,
    prerequisites,
    expectedSiteUrl: environment.SITE_URL,
  });
  if (failures.length > 0) {
    throw new Error(`Sites handoff failed: ${failures.join(", ")}`);
  }
  return {
    projectId: packageReport.sitesProjectId,
    commitSha: gitState.headCommit,
    siteUrl: releaseReport.siteUrl,
    archivePath: resolve(root, "reports/sites-package.tar.gz"),
    archiveSha256: currentArchiveSha256,
    productionDistSha256: currentDistSha256,
  };
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) {
  verifySitesHandoff()
    .then((binding) => console.log(JSON.stringify(binding, null, 2)))
    .catch((error) => {
      console.error(String(error));
      process.exitCode = 1;
    });
}
```

No preview command inherits production DSNs, tokens, organization/project names or IDs, release IDs, or Cloudflare credentials. Preview builds therefore cannot upload source maps or randomly load production monitoring. The controlled production build emits hidden maps; the explicit uploader injects and uploads the client scope once to the browser project and the server scope once to the Worker project. Organization slug/ID, project slug/ID, release, scope, and manifest participate in every target, receipt, reuse decision, and prior-report match. Maps are removed only after both receipts pass. Uncertain state or changed bytes for the same release/scope block automatic upload and require manual reconciliation. The Sites packager binds both helper scripts and proves the complete archive root contains only the expected `dist/` tree with these exact post-upload production bytes; it does not rebuild.


- [ ] **Step 8: Expose every preview-safe and strict gate explicitly**

Run:

```bash
npm pkg set "scripts.typecheck=tsc --noEmit"
npm pkg set "scripts.assets:validate:release=node scripts/assets/validate.mjs --require-posters"
npm pkg set "scripts.test:quality=node --test tests/quality/contrast.test.mjs tests/quality/performance-gate.test.mjs tests/quality/public-artifacts.test.mjs tests/quality/release-approval.test.mjs tests/quality/release-environment.test.mjs tests/quality/sentry-upload.test.mjs tests/quality/sites-package.test.mjs"
npm pkg set "scripts.test:acceptance=playwright test tests/browser/site-acceptance.spec.ts"
npm pkg set "scripts.test:visual=playwright test tests/browser/visual-regression.spec.ts"
npm pkg set "scripts.test:visual:update:run=playwright test tests/browser/visual-regression.spec.ts --update-snapshots"
npm pkg set "scripts.test:visual:update=node scripts/quality/run-preview-browser.mjs visual-update"
npm pkg set "scripts.test:preview-safe-browser:run=npm run test:browser && npm run test:accessibility && npm run test:acceptance"
npm pkg set "scripts.test:preview-safe-browser=node scripts/quality/run-preview-browser.mjs preview-safe"
npm pkg set "scripts.test:preview-browser:run=npm run test:browser && npm run test:accessibility && npm run test:acceptance && npm run test:visual && npm run quality:performance:run"
npm pkg set "scripts.test:preview-browser=node scripts/quality/run-preview-browser.mjs strict"
npm pkg set "scripts.quality:approval=node scripts/quality/release-approval.mjs"
npm pkg set "scripts.quality:approval:bindings=node scripts/quality/release-approval.mjs --print-bindings"
npm pkg set "scripts.upload:sentry=node scripts/quality/upload-sentry-sourcemaps.mjs"
npm pkg set "scripts.package:sites:validated=node scripts/quality/package-validated-sites.mjs"
npm pkg set "scripts.verify:sites:handoff=node scripts/quality/verify-sites-handoff.mjs"
npm pkg set "scripts.validate:release=node scripts/quality/validate-release.mjs"
```

Expected: `test:quality` names the seven Node files exactly; `test:browser` remains the runtime-owned `three-runtime.spec.ts` only; `test:posters` and `posters:check` remain explicit pre-build gates; accessibility, acceptance, visual, and performance are separate and all appear explicitly in the strict browser aggregate. Poster capture is never in normal browser tests. `upload:sentry` and `package:sites:validated` are production-only; the latter invokes the configured Sites helper and never builds. `verify:sites:handoff` is read-only and must pass immediately before the Sites save-version call.

- [ ] **Step 9: Run preview-safe verification now**

With preview environment values and no monitoring credentials:

```bash
npm run typecheck
npm run test:unit
npm run test:quality
npm run lint
npm run assets:preflight
npm run assets:validate:release
npm run test:assets
npm run test:posters
npm run posters:check
npm run quality:contrast
npm run quality:public
npm run build
npm run quality:performance
node --test tests/rendered-html.test.mjs
npm run test:preview-safe-browser
```

Expected: all implementation and advisory checks pass while owner copy, strict contrast decisions, final social generation, screenshot baselines, approval bindings, hostname, and monitoring accounts remain explicitly pending. `quality:performance` runs only after the fresh sanitized build and is the first full Task 7 profile. Do not run `test:visual` or `validate:release` yet.

Commit the runnable pending-state implementation now; deferred baselines and evidence directories do not exist yet and are intentionally excluded:

```bash
git add tests/browser/site-acceptance.spec.ts tests/browser/visual-regression.spec.ts tests/rendered-html.test.mjs config/release-approval.json scripts/quality/release-approval.mjs tests/quality/release-approval.test.mjs scripts/quality/validate-release.mjs scripts/quality/run-preview-browser.mjs scripts/quality/upload-sentry-sourcemaps.mjs scripts/quality/package-validated-sites.mjs scripts/quality/verify-sites-handoff.mjs tests/quality/release-environment.test.mjs tests/quality/sentry-upload.test.mjs tests/quality/sites-package.test.mjs package.json package-lock.json .gitignore
git commit -m "chore: add branch-safe portfolio release gates"
```

- [ ] **Step 10: Prepare final owner, asset, baseline, and evidence material**

Provision Sites before the final evidence target or production build. The checked-in `.openai/hosting.json` initially has no `project_id`. `create_site` requires a title and unique slug: use Richard-approved values already recorded for this project, or stop and ask him for them. Retry only when the connector explicitly identifies a temporary failure or slug conflict. A slug conflict requires a new Richard-approved alternate slug before one retry; quota, permission, access, and every other validation error are terminal. Never invent speculative alternatives. On success, retain the source-write credential only in memory and persist the opaque returned project ID verbatim:

```json
{
  "project_id": "<returned Sites project ID>",
  "d1": null,
  "r2": null
}
```

Reject any extra key, credential, token, nonempty D1 binding, or nonempty R2 binding. Commit this provisioning change by itself before creating the final approval target:

```bash
git add .openai/hosting.json
git commit -m "chore: bind portfolio Sites project"
```

Create `docs/release-evidence/sites-project.md` with the approved title/slug, opaque project ID, `.openai/hosting.json` SHA-256, provisioning date, Richard's review, and confirmation that the source credential was neither written nor committed. If `create_site` was already completed and the committed project ID is a nonempty exact string without surrounding/control whitespace, reuse it; never create a replacement site to recover a missing/expired source credential.

Resolve `SITE_URL` without guessing. Use a Sites URL only when `create_site` or `get_site` actually returns an authoritative URL and Richard approves it; never derive a hostname from the slug. If neither connector response provides that URL, stop this release workflow and require Richard's approved custom HTTPS origin. This v1 plan permits no provisional Sites version/deployment before strict approval merely to discover a hostname.

After final owner copy, social art, posters, and screenshot baselines are stable, create review notes under `docs/release-evidence/`. Use stable, descriptive files such as `owner-content.md`, `contrast-review.md`, `social-card-review.md`, `nasa-rocket-review.md`, `league-brand-review.md`, `resume-site-consistency.md`, `sites-project.md`, `monitoring-configuration.md`, and `android-smoke.md`. The desktop/mobile approvals point directly to the eight stable Playwright snapshot paths rather than copied screenshots. The material must cover:

Before creating the baselines, run a sanitized preview `npm run build`, then `npm run test:visual:update`; never approve snapshots captured from the dev server.

- both final Home paragraphs;
- a committed contrast review note that names the current configuration hash and every approved-exact/compliant decision (the ignored `reports/contrast.json` is supporting output, not evidence);
- the social card text/visual inspection;
- Rocket/NASA no-official-logo inspection;
- CraneOnLeague/Riot no-official-art-or-logo inspection;
- all four 1920-wide full-page comparisons captured from a 1920x1080 viewport and checked against each tracked reference's actual dimensions/hash;
- all four mobile composition screenshots;
- resume/site title, role, date, and contact consistency;
- the persisted Sites project ID/config hash and absence of any credential or nonempty D1/R2 binding;
- final-host Cloudflare JS-Snippet-only setup, automatic injection off, Worker logs/free quota, exact Sentry organization/project slugs and numeric IDs with each DSN binding, tested alert recipients, and replay/tracing/overage off;
- a physical Android smoke result, or an explicit unavailable reason.

Do not compute `approvalTargetSha256` or edit the approval record yet. The checklist in Step 11 is also part of the tracked target, so all final material must be committed together before bindings are printed.


- [ ] **Step 11: Write the operational release checklist**

Create `docs/release-checklist.md`:

```markdown
# Personal Site Release Checklist

## Accounts and final hostname

- [ ] Provision exactly one Sites project before final approval. Call `create_site` with approved title/slug; retry only an explicit temporary failure or a slug conflict after Richard approves an alternate. Persist only its `project_id` with null/empty D1 and R2 in `.openai/hosting.json`, commit it, and never store the returned source-write credential.
- [ ] Keep Cloudflare Web Analytics, Worker observability, and Sentry on free tiers; disable paid overage or automatic upgrades.
- [ ] Create Cloudflare Web Analytics for the final production hostname only.
- [ ] Use manual JavaScript Snippet installation and disable Cloudflare automatic injection so the app's referrer/query/fragment-free 5% loader remains authoritative.
- [ ] Create separate Sentry browser and Worker projects; record the numeric organization ID and each numeric project ID, bind each DSN to its intended ID, and disable replay, tracing, client reports, and default PII.
- [ ] Create browser and Worker uncaught-error alert rules, use Sentry test notifications, and save evidence that both reached Richard.
- [ ] Store only Worker runtime `SITE_ENV`, hostname, exact 40-hex release, and secret Worker DSN through Sites runtime configuration. Browser DSN/beacon/public release values are build-baked and are not mirrored unless the connector explicitly requires them. Keep `SENTRY_AUTH_TOKEN`, Sentry organization/project upload values, `SITES_PLUGIN_ROOT`, and `SITES_BASH_BIN` only in the controlled release environment.
- [ ] Set SITE_URL to the final HTTPS origin and both release IDs to exact git HEAD.
- [ ] Record monitoringConfiguration approval evidence for final host, JS-Snippet-only setup, automatic injection off, Worker logs/free quota, exact Sentry org/project slug+numeric-ID/DSN bindings, alert recipients, and replay/tracing/overage off.

## Content, assets, and visual evidence

- [ ] Replace both Home owner fields with Richard's final paragraphs.
- [ ] Run posters:capture, inspect pixel changes, and pass posters:check.
- [ ] Finish each source-bound contrast decision with Richard/date and compare every failing original to its generated compliant candidate.
- [ ] Generate and inspect the outlined social source/PNG only after copy and motifs are final.
- [ ] Confirm Rocket contains no NASA meatball, worm, seal, logotype, or official logo; bind evidence to the canonical Rocket hash.
- [ ] Confirm CraneOnLeague contains only the two repository-owned screens and no Riot/League official art or logo; bind evidence to its canonical hash and assets/brand-approvals.json.
- [ ] Compare all four 1920-wide full-page desktop baselines (captured from a 1920x1080 viewport) to the actual-height ReferenceImages and review all four mobile compositions separately.
- [ ] Verify site roles, dates, contact details, and claims against Richard-Phong-Resume.pdf.
- [ ] Run physical Android Chrome smoke for scroll, poster fallback, toggle, and rotation. If unavailable, record outcome unavailable, reason, Richard/date, and hashed evidence.
- [ ] Fill config/release-approval.json, commit only it, and pass quality:approval from a clean checkout.

## Strict local proof

~~~bash
npm ci
# On Windows run assets:bootstrap once; on other systems set BLENDER_BIN.
npm run assets:preflight
npx playwright install chromium
npm run validate:release
~~~

- [ ] Confirm reports/release.json is passed for exact HEAD and hostname, with no stale pass after any failed run.
- [ ] Confirm reports/performance.json has four route and eight scene results, WebGL2 SwiftShader, and zero failures.
- [ ] Confirm reports/contrast.json has no blocking IDs or selector-wiring failures.
- [ ] Confirm reports/public-artifacts.json matches resume, social regeneration, and motif hashes.
- [ ] Confirm reports/sentry-uploads.json records one counted `dist/client` receipt for the browser project and one counted `dist/server` receipt for the Worker project, with maps removed only after both passed.
- [ ] Confirm reports/sites-package.json binds the approved commit, Sites project, hosting hash, both exact helper hashes (`scripts/package-site.sh` and `skills/sites-hosting/scripts/package-site.sh`), production dist manifest, full archive-root manifest, and reports/sites-package.tar.gz hash. Require the archive to contain only the expected `dist/` tree with no top-level extra or symlink anywhere.
- [ ] Confirm the sanitized preview and production dist hashes differ; only the sanitized artifact is expected to be noindex and telemetry-disabled.

## Sanitized review, protected production version, and monitoring smoke

- [ ] Review the separately built sanitized preview artifact before production: verify four routes, fixed nav, links, resume, posters, toggle, rotation, no overflow, noindex/nofollow, no canonical/social absolute URL, no monitoring request, and Referrer-Policy no-referrer.
- [ ] After `validate:release` passes, run `npm run verify:sites:handoff` immediately before hosting and use only its exact project ID, commit SHA, archive path, archive hash, and production dist hash.
- [ ] Reuse the `create_site` source credential if still valid; otherwise call `create_source_repository_write_credential`. Use exactly its returned `remote_url`, `branch`, `auth_mode`, and token: push the clean approved HEAD to that specific remote branch with the token only in the per-command authorization header, never a credential-bearing URL or Git config. Read back that exact remote branch head and require it equals the handoff `commitSha`.
- [ ] Save exactly one Sites version using reports/sites-package.tar.gz with `commit_sha` equal to the verified approved HEAD. Verify the returned project/version and `source.commit_sha`; record `archive_storage.content_hash`, size, and file count. Compare the connector content hash to the local archive SHA-256 only when the connector explicitly identifies that field's algorithm as SHA-256. Do not rebuild or repackage between handoff verification and save-version.
- [ ] Before private deployment, call `get_environment_variables`, remove every existing user variable outside the exact runtime allowlist, then update only `SITE_ENV=production`, exact handoff `SITE_URL`, exact handoff `RELEASE_ID`, and Worker `SENTRY_DSN` marked secret. Public browser/beacon values are already build-baked and may be mirrored only if the connector explicitly requires them. Retrieve variables again, require the exact intended key set/secret flags, and record the environment-update revision. A reused project must not retain `SENTRY_AUTH_TOKEN`, Sentry organization/upload project values or IDs, source credentials, `SITES_PLUGIN_ROOT`, `SITES_BASH_BIN`, or any legacy key.
- [ ] Deploy that version with `deploy_private_site_version` and poll `get_deployment_status` directly until succeeded or failed. If only shared/public deployment is available, stop and ask Richard before exposing it.
- [ ] Require the successful deployment's `env_set_revision` to equal the environment-update response revision; a stale runtime configuration blocks smoke testing and promotion.
- [ ] Treat the private deployment as production-baked and protect it by access control; do not claim it is the sanitized noindex preview or rely on robots metadata for secrecy.
- [ ] Verify the protected deployment references the saved project/version and that the saved version's `source.commit_sha` matches the handoff. Deployment status does not itself prove an archive hash; preserve the saved-version archive metadata beside the local handoff binding.
- [ ] If `SITE_URL` uses a custom hostname, add that custom domain to the same Sites project after the private deployment, apply every returned DNS validation record, and poll/refresh domain status until active. If the Sites-provided URL is the final origin, record that decision explicitly instead. Never rebuild while validating the domain.
- [ ] After Richard gives explicit launch authorization for public access and the already-baked indexing metadata, call `update_site_access` with `access_mode: "public"`, then call `deploy_site_version` for the same project/version and poll `get_deployment_status` to success. Do not rebuild. Verify unauthenticated public reachability first, then verify the expected canonical/robots/sitemap indexing contract on the active final hostname.
- [ ] Verify production canonicals, social PNG, robots, sitemap, and all four URLs.
- [ ] Verify the manual Cloudflare beacon can load on a sampled direct clean visit and cannot load for query, fragment, or referred visits.
- [ ] Filter a controlled kind=site_operational Worker Logs record; confirm only release/event fields and no headers, IP, query, referrer, or contact data.
- [ ] Confirm both Sentry releases/source maps and alert delivery; inspect smoke events for no user, request, breadcrumbs, contacts, or query.
- [ ] Treat free-tier exhaustion as a monitoring gap, never permission for paid collection.
```

- [ ] **Step 12: Commit final evidence, bind the approval, and prove lifecycle behavior**

Before deferred inputs exist, `npm run validate:release` must exit 1 before build/deploy. Every invocation immediately overwrites `reports/release.json` as `running`, then removes stale Sites package report/archive before reading Git. Missing Git explicitly reports `git unavailable`; every handled failure becomes `failed` with the exact gate, so a stale pass or archive never survives a later failed run.

After every Step 10/11 input exists, commit the final content, generated artifacts, baselines, evidence, and checklist before computing the target:

```bash
git add content/site-content.ts assets/social-card.svg public/social-card.png config/public-artifacts.json public/posters public/models assets/blender/source-provenance.json assets/brand-approvals.json tests/browser/visual-regression.spec.ts-snapshots docs/release-evidence docs/release-checklist.md
git commit -m "chore: finalize reviewed portfolio release evidence"
git status --short
npm run quality:approval:bindings
```

Expected: the tree is clean before bindings are printed. Copy the printed target and artifact/source hashes into `config/release-approval.json`, set every reviewer/date/status and the structured monitoring fields, then commit only the excluded approval record:

```bash
git add config/release-approval.json
git commit -m "chore: approve portfolio production release"
git status --short
npm run quality:approval
```

Any later tracked change other than `config/release-approval.json` changes the target digest and forces re-review. The approval commit changes HEAD, so set `RELEASE_ID` and `NEXT_PUBLIC_RELEASE_ID` to that exact new HEAD before the strict runner.

- [ ] **Step 13: Run the exact approved release gate**

From the clean approval commit with the final production environment, run:

```bash
npm run validate:release
git status --short
```

Expected: all explicit sanitized-preview gates pass, the controlled production build occurs once, each scoped Sentry upload has one full identity-bound receipt, production HTML passes against the injected output, the configured Sites helper packages and byte-verifies that exact post-upload `dist/` without a rebuild, final Git identity is unchanged, and `reports/release.json` becomes `passed` with distinct preview/production hashes for exact HEAD and hostname. Run `verify:sites:handoff` again immediately before saving the version.

## Completion proof

Preview-safe first pass:

```bash
npm run typecheck
npm run test:unit
npm run test:quality
npm run lint
npm run assets:preflight
npm run assets:validate
npm run test:assets
npm run test:posters
npm run posters:check
npm run quality:contrast
npm run quality:public
npm run build
npm run quality:performance
node --test tests/rendered-html.test.mjs
npm run test:preview-safe-browser
git status --short
```

Expected: checks pass without inventing deferred prose or baselines. Strict release remains blocked.

Final proof after owner/account/hostname/approval inputs:

```bash
npm run validate:release
git status --short
```

Expected: release report passed for exact HEAD and hostname; only ignored reproducible `reports/*.json`, `reports/*.tmp`, and the verified `reports/sites-package.tar.gz` may differ. No production Sites deployment or indexing occurs first.
