import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  expect,
  type Locator,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";

const TRIANGLE_GLTF = {
  asset: { version: "2.0", generator: "runtime-browser-test" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  buffers: [
    {
      byteLength: 36,
      uri: "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA",
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: "VEC3",
      min: [0, 0, 0],
      max: [1, 1, 0],
    },
  ],
} as const;

const STATIC_POSE_CLIPS_BY_MODEL: Readonly<Record<string, readonly string[]>> = {
  "/models/crane-throwing-plane.glb": [
    "EmptyAction",
    "Hat propellerAction.002",
  ],
  "/models/crane-workout.glb": [
    "Dumbell L",
    "Dumbell R",
    "Lifting Weights",
  ],
};

function triangleGltf(pathname: string): string {
  const clipNames = STATIC_POSE_CLIPS_BY_MODEL[pathname] ?? [];
  if (clipNames.length === 0) return JSON.stringify(TRIANGLE_GLTF);
  return JSON.stringify({
    ...TRIANGLE_GLTF,
    animations: clipNames.map((name) => ({
      name,
      channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
      samplers: [{ input: 1, output: 2, interpolation: "LINEAR" }],
    })),
    buffers: [
      ...TRIANGLE_GLTF.buffers,
      {
        byteLength: 8,
        uri: "data:application/octet-stream;base64,AAAAAAAAQEA=",
      },
      {
        byteLength: 24,
        uri: "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    ],
    bufferViews: [
      ...TRIANGLE_GLTF.bufferViews,
      { buffer: 1, byteOffset: 0, byteLength: 8 },
      { buffer: 2, byteOffset: 0, byteLength: 24 },
    ],
    accessors: [
      ...TRIANGLE_GLTF.accessors,
      {
        bufferView: 1,
        componentType: 5126,
        count: 2,
        type: "SCALAR",
        min: [0],
        max: [3],
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 2,
        type: "VEC3",
      },
    ],
  });
}

const POSTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900">
  <rect width="1440" height="900" fill="#9ECCC0"/>
  <circle cx="900" cy="350" r="180" fill="#135946"/>
</svg>`;

const MODEL_ROUTE = "**/models/*.glb";
const POSTER_ROUTE = "**/posters/*.webp";

export const COMMITTED_MESHOPT_MODEL = "/models/crane.glb";

export type ModelResponseKind =
  | "triangle"
  | "committed"
  | "decode-error"
  | "passthrough"
  | "abort"
  | "http-error";

export interface ModelResponsePlan {
  /** The deterministic triangle is the default. `committed` serves public/models. */
  readonly kind?: ModelResponseKind;
  /** A deterministic timer delay applied before the response action. */
  readonly delayMs?: number;
  /** Keep the request pending until `release(pathname)` is called. */
  readonly hold?: boolean;
  /** HTTP status used by `http-error`; defaults to 503. */
  readonly status?: number;
  /** Playwright/Chromium network error used by `abort`; defaults to `failed`. */
  readonly errorCode?: string;
}

export type ModelPlan =
  | ModelResponsePlan
  | readonly ModelResponsePlan[];

export interface ModelFixtureOptions {
  readonly defaultPlan?: ModelResponsePlan;
  /**
   * A single plan repeats for that URL. A sequence is consumed once per
   * request and then falls back to `defaultPlan`.
   */
  readonly plans?: Readonly<Record<string, ModelPlan>>;
}

export type ModelRouteAction =
  | "pending"
  | "fulfilled"
  | "continued"
  | "aborted"
  | "http-error";

export type ModelRequestPhase =
  | "requested"
  | "request-finished"
  | "request-failed";

export interface ModelRequestRecord {
  readonly id: number;
  readonly ordinal: number;
  readonly pathname: string;
  /** Monotonic fixture-process time, useful for request ordering assertions. */
  readonly at: number;
  readonly requestedAt: number;
  readonly plan: Readonly<ModelResponsePlan>;
  phase: ModelRequestPhase;
  routeAction: ModelRouteAction;
  failureText: string | null;
}

export interface ModelFixtureController {
  /** Every GLB pathname in browser request order. */
  readonly requested: string[];
  /** Mutable lifecycle records, stable by request id. */
  readonly records: ModelRequestRecord[];
  /** Replace the repeating plan or one-shot response sequence for a URL. */
  readonly setPlan: (pathname: string, plan: ModelPlan) => void;
  /** Release one held request by default, or up to `count` held requests. */
  readonly release: (pathname: string, count?: number) => number;
  readonly requestCount: (pathname: string) => number;
  readonly pendingCount: (pathname?: string) => number;
  readonly waitForRequest: (
    pathname: string,
    count?: number,
    timeoutMs?: number,
  ) => Promise<ModelRequestRecord>;
  readonly dispose: () => Promise<void>;
}

interface MutablePlanQueue {
  repeating: ModelResponsePlan | null;
  sequence: ModelResponsePlan[];
}

interface HeldRequest {
  readonly release: () => void;
  readonly pathname: string;
  settled: boolean;
}

interface RequestWaiter {
  readonly count: number;
  readonly pathname: string;
  readonly reject: (error: Error) => void;
  readonly resolve: (record: ModelRequestRecord) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

function modelPathname(url: string): string | null {
  const pathname = new URL(url).pathname;
  return pathname.endsWith(".glb") ? pathname : null;
}

function normalizedModelPathname(pathname: string): string {
  const normalized = pathname.startsWith("http")
    ? new URL(pathname).pathname
    : pathname.startsWith("/")
      ? pathname
      : `/${pathname}`;
  if (!normalized.startsWith("/models/") || !normalized.endsWith(".glb")) {
    throw new Error(`Expected a /models/*.glb pathname, received ${pathname}`);
  }
  return normalized;
}

function toPlanQueue(plan: ModelPlan): MutablePlanQueue {
  return Array.isArray(plan)
    ? { repeating: null, sequence: [...plan] }
    : { repeating: plan as ModelResponsePlan, sequence: [] };
}

function settleHeldRequest(held: HeldRequest) {
  if (held.settled) return;
  held.settled = true;
  held.release();
}

async function waitForDelay(
  delayMs: number,
  terminated: Promise<void>,
): Promise<"elapsed" | "terminated"> {
  if (delayMs <= 0) return "elapsed";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<"elapsed">((resolve) => {
    timeout = setTimeout(() => resolve("elapsed"), delayMs);
  });
  const outcome = await Promise.race([
    elapsed,
    terminated.then(() => "terminated" as const),
  ]);
  if (timeout !== undefined) clearTimeout(timeout);
  return outcome;
}

export async function fulfillPosters(page: Page): Promise<void> {
  await page.route(POSTER_ROUTE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: POSTER_SVG,
    }),
  );
}

export async function fulfillModels(
  page: Page,
  requested: string[] = [],
  options: ModelFixtureOptions = {},
): Promise<ModelFixtureController> {
  const defaultPlan: ModelResponsePlan = options.defaultPlan ?? {
    kind: "triangle",
  };
  const queues = new Map<string, MutablePlanQueue>();
  const records: ModelRequestRecord[] = [];
  const recordsByRequest = new WeakMap<Request, ModelRequestRecord>();
  const requestTermination = new WeakMap<
    Request,
    { readonly promise: Promise<void>; readonly resolve: () => void }
  >();
  const heldRequests: HeldRequest[] = [];
  const waiters: RequestWaiter[] = [];
  const activeHandlers = new Set<Promise<void>>();
  const committedBuffers = new Map<string, Buffer>();
  let nextRecordId = 1;

  for (const [pathname, plan] of Object.entries(options.plans ?? {})) {
    queues.set(normalizedModelPathname(pathname), toPlanQueue(plan));
  }

  const nextPlan = (pathname: string): ModelResponsePlan => {
    const queue = queues.get(pathname);
    if (!queue) return defaultPlan;
    return queue.sequence.shift() ?? queue.repeating ?? defaultPlan;
  };

  const matchingRecords = (pathname: string) => {
    const normalized = normalizedModelPathname(pathname);
    return records.filter((record) => record.pathname === normalized);
  };

  const flushWaiters = (pathname: string) => {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (waiter.pathname !== pathname) continue;
      const matches = records.filter(
        (record) => record.pathname === pathname,
      );
      if (matches.length < waiter.count) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(matches[waiter.count - 1]);
    }
  };

  const ensureRecord = (request: Request): ModelRequestRecord | null => {
    const pathname = modelPathname(request.url());
    if (!pathname) return null;
    const existing = recordsByRequest.get(request);
    if (existing) return existing;

    const ordinal = records.reduce(
      (count, record) => count + Number(record.pathname === pathname),
      0,
    ) + 1;
    const record: ModelRequestRecord = {
      id: nextRecordId,
      ordinal,
      pathname,
      at: performance.now(),
      requestedAt: Date.now(),
      plan: nextPlan(pathname),
      phase: "requested",
      routeAction: "pending",
      failureText: null,
    };
    nextRecordId += 1;
    requested.push(pathname);
    records.push(record);
    recordsByRequest.set(request, record);

    let resolveTermination: () => void = () => undefined;
    const termination = new Promise<void>((resolve) => {
      resolveTermination = resolve;
    });
    requestTermination.set(request, {
      promise: termination,
      resolve: resolveTermination,
    });
    flushWaiters(pathname);
    return record;
  };

  const onRequest = (request: Request) => {
    ensureRecord(request);
  };
  const onRequestFinished = (request: Request) => {
    const record = recordsByRequest.get(request);
    if (!record) return;
    record.phase = "request-finished";
    requestTermination.get(request)?.resolve();
  };
  const onRequestFailed = (request: Request) => {
    const record = recordsByRequest.get(request);
    if (!record) return;
    record.phase = "request-failed";
    record.failureText = request.failure()?.errorText ?? "request failed";
    requestTermination.get(request)?.resolve();
  };

  page.on("request", onRequest);
  page.on("requestfinished", onRequestFinished);
  page.on("requestfailed", onRequestFailed);

  const handleRoute = async (route: Route) => {
    const request = route.request();
    const record = ensureRecord(request);
    if (!record) {
      await route.fallback();
      return;
    }
    const plan = record.plan;
    const termination = requestTermination.get(request)?.promise ??
      Promise.resolve();

    if (plan.hold) {
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held: HeldRequest = {
        pathname: record.pathname,
        release,
        settled: false,
      };
      heldRequests.push(held);
      const outcome = await Promise.race([
        released.then(() => "released" as const),
        termination.then(() => "terminated" as const),
      ]);
      settleHeldRequest(held);
      const heldIndex = heldRequests.indexOf(held);
      if (heldIndex >= 0) heldRequests.splice(heldIndex, 1);
      if (outcome === "terminated") return;
    }

    const delayOutcome = await waitForDelay(plan.delayMs ?? 0, termination);
    if (delayOutcome === "terminated") return;

    switch (plan.kind ?? "triangle") {
      case "triangle":
        record.routeAction = "fulfilled";
        await route.fulfill({
          status: 200,
          contentType: "model/gltf+json",
          body: triangleGltf(record.pathname),
        });
        return;
      case "committed": {
        const filename = path.basename(record.pathname);
        let body = committedBuffers.get(filename);
        if (!body) {
          body = await readFile(
            path.resolve(process.cwd(), "public", "models", filename),
          );
          committedBuffers.set(filename, body);
        }
        record.routeAction = "fulfilled";
        await route.fulfill({
          status: 200,
          contentType: "model/gltf-binary",
          body,
        });
        return;
      }
      case "decode-error":
        record.routeAction = "fulfilled";
        await route.fulfill({
          status: 200,
          contentType: "model/gltf-binary",
          body: Buffer.from("intentional-corrupt-glb", "utf8"),
        });
        return;
      case "passthrough":
        record.routeAction = "continued";
        await route.continue();
        return;
      case "abort":
        record.routeAction = "aborted";
        await route.abort(plan.errorCode ?? "failed");
        return;
      case "http-error":
        record.routeAction = "http-error";
        await route.fulfill({
          status: plan.status ?? 503,
          contentType: "text/plain; charset=utf-8",
          body: "Intentional runtime fixture failure",
        });
    }
  };

  const routeHandler = (route: Route) => {
    const handling = handleRoute(route);
    activeHandlers.add(handling);
    void handling.then(
      () => activeHandlers.delete(handling),
      () => activeHandlers.delete(handling),
    );
    return handling;
  };

  await page.route(MODEL_ROUTE, routeHandler);

  return {
    requested,
    records,
    setPlan(pathname, plan) {
      queues.set(normalizedModelPathname(pathname), toPlanQueue(plan));
    },
    release(pathname, count = 1) {
      const normalized = normalizedModelPathname(pathname);
      let released = 0;
      for (const held of [...heldRequests]) {
        if (held.pathname !== normalized || released >= count) continue;
        settleHeldRequest(held);
        released += 1;
      }
      return released;
    },
    requestCount(pathname) {
      return matchingRecords(pathname).length;
    },
    pendingCount(pathname) {
      const normalized = pathname
        ? normalizedModelPathname(pathname)
        : null;
      return heldRequests.filter(
        (held) => !held.settled && (!normalized || held.pathname === normalized),
      ).length;
    },
    waitForRequest(pathname, count = 1, timeoutMs = 5_000) {
      const normalized = normalizedModelPathname(pathname);
      const matches = matchingRecords(normalized);
      if (matches.length >= count) {
        return Promise.resolve(matches[count - 1]);
      }
      return new Promise<ModelRequestRecord>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = waiters.findIndex(
            (waiter) => waiter.resolve === resolve,
          );
          if (index >= 0) waiters.splice(index, 1);
          reject(
            new Error(
              `Timed out waiting for request ${count} to ${normalized}`,
            ),
          );
        }, timeoutMs);
        waiters.push({
          pathname: normalized,
          count,
          resolve,
          reject,
          timeout,
        });
      });
    },
    async dispose() {
      for (const held of heldRequests) settleHeldRequest(held);
      heldRequests.length = 0;
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error("Model fixture disposed"));
      }
      await Promise.allSettled([...activeHandlers]);
      page.off("request", onRequest);
      page.off("requestfinished", onRequestFinished);
      page.off("requestfailed", onRequestFailed);
      await page.unroute(MODEL_ROUTE, routeHandler);
    },
  };
}

export async function openScene(
  page: Page,
  sceneId: string,
  query = "controls=1",
): Promise<Locator> {
  const normalizedQuery = query.replace(/^[?&]+/, "");
  const suffix = normalizedQuery ? `&${normalizedQuery}` : "";
  await page.goto(`/scene-capture?scene=${encodeURIComponent(sceneId)}${suffix}`);
  const host = page.getByTestId("scene-runtime-host");
  await expect(host).toHaveAttribute("data-active-scene-id", sceneId);
  return host;
}
