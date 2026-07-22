import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("persistent Canvas source contract", () => {
  it("owns one transparent demand renderer without controls or a ground plane", async () => {
    const source = await readFile("app/three/scene-canvas.tsx", "utf8");

    expect(source.match(/<Canvas\b/g)).toHaveLength(1);
    expect(source).toContain('frameloop="demand"');
    expect(source).toContain("dpr={[1, 1.5]}");
    expect(source).toContain("resize={{ scroll: false }}");
    expect(source).toContain('aria-hidden="true"');
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
    expect(source).toContain("renderFrame(renderer, renderedScene, camera)");
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
});
