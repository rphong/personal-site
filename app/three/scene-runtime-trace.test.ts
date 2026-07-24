import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("scene runtime trace delivery", () => {
  beforeEach(() => {
    vi.resetModules();
    window.__enableSceneRuntimeTrace = true;
    window.__sceneRuntimeTrace = [];
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    vi.restoreAllMocks();
    delete window.__enableSceneRuntimeTrace;
    delete window.__sceneRuntimeTrace;
    window.history.replaceState(null, "", "/");
  });

  it("records ordered entries synchronously and defers console output", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const {
      captureSceneRuntimeTraceMoment,
      traceSceneRuntime,
    } = await import("./scene-runtime-trace-core");
    const firstMoment = captureSceneRuntimeTraceMoment();

    const firstSequence = traceSceneRuntime(
      "test:first",
      { value: 1 },
      firstMoment,
    );
    const secondSequence = traceSceneRuntime("test:second", { value: 2 });

    expect(window.__sceneRuntimeTrace).toMatchObject([
      {
        at: firstMoment.at,
        details: { value: 1 },
        phase: "test:first",
        sequence: firstSequence,
        wallTime: firstMoment.wallTime,
        path: firstMoment.path,
      },
      {
        details: { value: 2 },
        phase: "test:second",
        sequence: secondSequence,
      },
    ]);
    expect(Number(secondSequence)).toBeGreaterThan(Number(firstSequence));
    expect(consoleLog).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    const consolePhases = consoleLog.mock.calls.map(([message]) => {
      const serialized = String(message).replace(
        "[scene-runtime-trace] ",
        "",
      );
      return (JSON.parse(serialized) as { readonly phase: string }).phase;
    });
    expect(consolePhases).toEqual(["test:first", "test:second"]);
  });

  it("preserves a captured pathname when delivery happens after navigation", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const {
      captureSceneRuntimeTraceMoment,
      traceSceneRuntime,
    } = await import("./scene-runtime-trace-core");
    window.history.replaceState(null, "", "/rendered");
    const renderMoment = captureSceneRuntimeTraceMoment();
    window.history.replaceState(null, "", "/later-route");

    traceSceneRuntime("test:deferred", {}, renderMoment);

    expect(window.__sceneRuntimeTrace?.[0]).toMatchObject({
      path: "/rendered",
      phase: "test:deferred",
    });
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    expect(consoleLog).toHaveBeenCalledOnce();
  });

  it("marks every superseded render identity field and renderer frame incoherent", async () => {
    const { compareSceneRenderTraceCoherence } = await import(
      "./scene-runtime-trace-core"
    );
    const rendered = {
      adoptionVersion: "4",
      canvasConnected: true,
      ownerSceneId: "experience-hero",
      path: "/experience",
      poolKey: "resident-stage-2",
      poolState: "assigned",
      renderedAdoptionVersion: "4",
      sectionSceneId: "experience-hero",
      stageConnected: true,
    };
    expect(
      compareSceneRenderTraceCoherence(rendered, rendered, 12, 12),
    ).toMatchObject({
      coherent: true,
      identityMatches: true,
      rendererFrameMatches: true,
    });

    for (const field of Object.keys(rendered) as Array<
      keyof typeof rendered
    >) {
      const value = rendered[field];
      const audit = {
        ...rendered,
        [field]:
          typeof value === "boolean"
            ? !value
            : `${value}:superseded`,
      } as typeof rendered;
      const comparison = compareSceneRenderTraceCoherence(
        rendered,
        audit,
        12,
        12,
      );
      expect(comparison.coherent, field).toBe(false);
      expect(comparison.identityMatches, field).toBe(false);
      expect(comparison.identityFields[field], field).toBe(false);
    }

    expect(
      compareSceneRenderTraceCoherence(rendered, rendered, 12, 13),
    ).toMatchObject({
      coherent: false,
      identityMatches: true,
      rendererFrameMatches: false,
    });
  });

  it("rejects detached or incomplete adoption identities even when both snapshots match", async () => {
    const { compareSceneRenderTraceCoherence } = await import(
      "./scene-runtime-trace-core"
    );
    const detached = {
      adoptionVersion: null,
      canvasConnected: false,
      ownerSceneId: null,
      path: "/experience",
      poolKey: null,
      poolState: null,
      renderedAdoptionVersion: null,
      sectionSceneId: null,
      stageConnected: false,
    };

    expect(
      compareSceneRenderTraceCoherence(detached, detached, 12, 12),
    ).toMatchObject({
      auditIdentityValid: false,
      coherent: false,
      identityMatches: false,
      renderedIdentityValid: false,
      rendererFrameMatches: true,
    });
  });

  it("bounds each deferred console task while preserving order", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const { traceSceneRuntime } = await import(
      "./scene-runtime-trace-core"
    );

    for (let index = 0; index < 10; index += 1) {
      traceSceneRuntime(`test:batch-${index}`);
    }

    expect(window.__sceneRuntimeTrace).toHaveLength(10);
    expect(consoleLog).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    expect(consoleLog).toHaveBeenCalledTimes(8);

    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const consolePhases = consoleLog.mock.calls.map(([message]) => {
      const serialized = String(message).replace(
        "[scene-runtime-trace] ",
        "",
      );
      return (JSON.parse(serialized) as { readonly phase: string }).phase;
    });
    expect(consolePhases).toEqual(
      Array.from({ length: 10 }, (_, index) => `test:batch-${index}`),
    );
  });

  it("stores entries without synchronous serialization and fails open for circular details", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const stringify = vi.spyOn(JSON, "stringify");
    const { traceSceneRuntime } = await import(
      "./scene-runtime-trace-core"
    );
    const details: Record<string, unknown> = { value: 1 };
    details.self = details;
    const stringifyCallsBeforeTrace = stringify.mock.calls.length;

    let sequence: number | null = null;
    let thrown: unknown;
    try {
      sequence = traceSceneRuntime("test:circular", details);
    } catch (error) {
      thrown = error;
    }
    const stringifyCallsAfterTrace = stringify.mock.calls.length;

    expect(thrown).toBeUndefined();
    expect(stringifyCallsAfterTrace).toBe(stringifyCallsBeforeTrace);
    expect(window.__sceneRuntimeTrace).toHaveLength(1);
    expect(window.__sceneRuntimeTrace?.[0]).toMatchObject({
      details,
      phase: "test:circular",
      sequence,
    });
    expect(window.__sceneRuntimeTrace?.[0]?.details).toBe(details);
    expect(consoleLog).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    expect(consoleLog).toHaveBeenCalledOnce();
    const serialized = String(consoleLog.mock.calls[0]?.[0]).replace(
      "[scene-runtime-trace] ",
      "",
    );
    expect(JSON.parse(serialized)).toMatchObject({
      details: {
        serializationError: expect.any(String),
      },
      phase: "test:circular",
      sequence,
    });
  });

  it("notifies a mounted subscriber when tracing is enabled later", async () => {
    delete window.__enableSceneRuntimeTrace;
    vi.resetModules();
    const {
      sceneRuntimeTraceEnabled,
      subscribeSceneRuntimeTraceEnable,
    } = await import("./scene-runtime-trace-core");
    const enabled = vi.fn();

    expect(sceneRuntimeTraceEnabled()).toBe(false);
    const unsubscribe = subscribeSceneRuntimeTraceEnable(enabled);
    expect(enabled).not.toHaveBeenCalled();

    window.__enableSceneRuntimeTrace = true;
    expect(enabled).toHaveBeenCalledOnce();
    expect(sceneRuntimeTraceEnabled()).toBe(true);

    window.__enableSceneRuntimeTrace = true;
    expect(enabled).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
