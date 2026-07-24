import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("persistent Canvas source contract", () => {
  it("owns one transparent demand renderer without controls or a ground plane", async () => {
    const source = await readFile("app/three/scene-canvas.tsx", "utf8");

    expect(source.match(/<Canvas\b/g)).toHaveLength(1);
    expect(source).toContain('frameloop="demand"');
    expect(source).toContain(
      "props.debugActive === false",
    );
    expect(source).toContain("INACTIVE_SCENE_DPR");
    expect(source).toContain("ACTIVE_SCENE_DPR");
    expect(source).toContain("resize={{ scroll: false }}");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("events={createDisabledSceneEventManager}");
    expect(source).toContain("alpha: true");
    expect(source).toContain('powerPreference: "high-performance"');
    expect(source).toContain("shadows={false}");
    expect(source.match(/<ambientLight\b/g)).toHaveLength(1);
    expect(source.match(/<rectAreaLight\b/g)).toHaveLength(1);
    expect(source).not.toContain("<directionalLight");
    expect(source).not.toContain("<hemisphereLight");
    expect(source).toContain("RectAreaLightUniformsLib.init()");
    expect(source).toContain("<AuthoredGroundShadow");
    expect(source).toContain("LinearSRGBColorSpace");
    expect(source).toContain("scene.lighting.world.strength * Math.PI");
    expect(source).toContain("light.current?.lookAt(...scene.lighting.key.target)");
    expect(source).toContain("ACESFilmicToneMapping");
    expect(source).toContain("renderer.toneMappingExposure = scene.lighting.exposure");
    expect(source).toContain("gl.render(scene, activeCamera)");
    expect(source).toContain("sceneModelIsAttached(scene, sceneId)");
    expect(source).toContain('"adoption-layout"');
    expect(source).toContain('"demand-frame"');
    expect(source).not.toMatch(
      /getWorldDirection|setFromObject|updateWorldMatrix/,
    );
    expect(source).toMatch(/useFrame\([\s\S]*?,\s*1\s*\)/);
    expect(source).not.toMatch(
      /OrbitControls|MapControls|PresentationControls|ContactShadows/,
    );
    expect(source).not.toContain("ContactBlobShadow");
    expect(source).not.toMatch(
      /scene\.background\s*=|attach=["']background["']|planeGeometry/,
    );
  });

  it("keeps cache and context lifecycle outside the model error boundary", async () => {
    const source = await readFile("app/three/scene-canvas.tsx", "utf8");
    const boundaryIndex = source.indexOf("<SceneErrorBoundary");

    expect(source.indexOf("<ContextLifecycle")).toBeLessThan(boundaryIndex);
    expect(source.indexOf("<AdjacentScenePreloader")).toBeLessThan(
      boundaryIndex,
    );
    expect(source).toContain("props.loadEnabled && props.scene.modelUrl");
    expect(source).toContain("props.activationVersion");
    expect(source).toContain("props.renderVersion");
    expect(source).toContain('addEventListener("webglcontextlost"');
    expect(source).toContain('addEventListener("webglcontextrestored"');
    expect(source).toContain('removeEventListener("webglcontextlost"');
    expect(source).toContain('removeEventListener("webglcontextrestored"');
    expect(source).toContain("event.preventDefault()");
  });

  it("renders and presents before scheduling expensive telemetry after paint", async () => {
    const source = await readFile("app/three/scene-canvas.tsx", "utf8");
    const renderFrameStart = source.indexOf("const renderFrame = useCallback");
    const activeRenderStart = source.indexOf(
      "const cameraFrame = synchronizeCameraForCanvas",
      renderFrameStart,
    );
    const renderFrameEnd = source.indexOf(
      "\n  useLayoutEffect(() =>",
      activeRenderStart,
    );
    const activeRender = source.slice(activeRenderStart, renderFrameEnd);
    const renderIndex = activeRender.indexOf(
      "gl.render(scene, activeCamera)",
    );
    const beforeRender = activeRender.slice(0, renderIndex);
    const afterRender = activeRender.slice(renderIndex);
    const firstTraceEmission = activeRender.indexOf(
      "emitRenderBeforeTrace();",
    );
    const firstFrameBookkeeping = activeRender.indexOf("onFirstFrame();");
    const immediateAfterStart = activeRender.indexOf(
      "const cameraAfterRender = traceCamera(",
    );
    const auditScheduleStart = activeRender.indexOf(
      "const auditScheduledAt = performance.now();",
    );
    const auditSchedule = activeRender.slice(auditScheduleStart);
    const auditAnimationFrame = auditSchedule.indexOf(
      "requestAnimationFrame(() => {",
    );
    const auditMacrotask = auditSchedule.indexOf(
      "window.setTimeout(() => {",
    );
    const auditBounds = auditSchedule.indexOf("traceModelWorldBounds(");
    const auditDom = auditSchedule.indexOf("snapshotSceneCanvasDom(");
    const auditEmission = auditSchedule.indexOf(
      '"canvas:render-audit"',
    );
    const auditAnimationFrameBody = auditSchedule.slice(
      auditAnimationFrame,
    );
    const auditMacrotaskBody = auditSchedule.slice(auditMacrotask);
    const immediateAfter = activeRender.slice(
      immediateAfterStart,
      auditScheduleStart,
    );

    expect(renderFrameStart).toBeGreaterThanOrEqual(0);
    expect(activeRenderStart).toBeGreaterThan(renderFrameStart);
    expect(renderFrameEnd).toBeGreaterThan(activeRenderStart);
    expect(renderIndex).toBeGreaterThanOrEqual(0);
    expect(beforeRender).toContain("captureSceneRuntimeTraceMoment()");
    expect(beforeRender).toContain("traceCamera(activeCamera, expectedFrame)");
    expect(beforeRender).not.toContain("traceModelWorldBounds(");
    expect(beforeRender).not.toContain("traceModelScreenBounds(");
    expect(beforeRender).not.toContain("snapshotSceneCanvasDom(");
    expect(firstTraceEmission).toBeGreaterThan(renderIndex);
    expect(firstFrameBookkeeping).toBeGreaterThan(renderIndex);
    expect(immediateAfterStart).toBeGreaterThan(firstFrameBookkeeping);
    expect(immediateAfter).toContain('"canvas:render-after"');
    expect(immediateAfter).toContain("renderAfterMoment");
    expect(immediateAfter).toContain("renderIdentity");
    expect(immediateAfter).toContain(
      "renderedStage.dataset.sceneLastRenderSequence",
    );
    expect(immediateAfter).not.toContain("traceModelWorldBounds(");
    expect(immediateAfter).not.toContain("traceModelScreenBounds(");
    expect(immediateAfter).not.toContain("snapshotSceneCanvasDom(");
    expect(activeRender).toContain('"canvas:render-before"');
    expect(afterRender).toContain('"canvas:render-after"');
    expect(auditAnimationFrame).toBeGreaterThanOrEqual(0);
    expect(auditMacrotask).toBeGreaterThan(auditAnimationFrame);
    expect(auditBounds).toBeGreaterThan(auditMacrotask);
    expect(auditDom).toBeGreaterThan(auditMacrotask);
    expect(auditEmission).toBeGreaterThan(auditMacrotask);
    expect(auditAnimationFrameBody).toContain("window.setTimeout(() => {");
    expect(auditMacrotaskBody).toContain("traceModelWorldBounds(");
    expect(auditMacrotaskBody).toContain("traceModelScreenBounds(");
    expect(auditMacrotaskBody).toContain("snapshotSceneCanvasDom(");
    expect(auditMacrotaskBody).toContain("renderAfterSequence");
    expect(auditMacrotaskBody).toContain("auditMatchesRenderedFrame");
    expect(auditMacrotaskBody).toContain(
      "compareSceneRenderTraceCoherence",
    );
    expect(auditMacrotaskBody).toContain(
      "auditCoherentWithRenderedFrame",
    );
    expect(auditMacrotaskBody).toContain("auditIdentity");
    expect(auditMacrotaskBody).toContain("renderIdentity");
    expect(auditMacrotaskBody).toContain("renderedStage &&");
    expect(auditMacrotaskBody).toContain("renderedStage.isConnected");
    expect(auditMacrotaskBody).toContain("gl.domElement.isConnected");
    expect(auditMacrotaskBody).toContain(
      "auditCoherence.auditIdentityValid",
    );
  });
});
