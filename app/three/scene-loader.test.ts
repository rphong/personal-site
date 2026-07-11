import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  loadSceneGltf,
  parseSceneGltf,
} from "./scene-loader";
import { disposeSceneSource } from "./scene-resources";

describe("scene GLB loader", () => {
  it("decodes the committed Meshopt-compressed crane", async () => {
    const bytes = await readFile("public/models/crane.glb");
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const gltf = await parseSceneGltf(buffer, "");
    expect(gltf.scene.children.length).toBeGreaterThan(0);
    expect(gltf.scene.getObjectByProperty("type", "SkinnedMesh")).toBeTruthy();
    disposeSceneSource(gltf.scene);
  });

  it("classifies HTTP failures as fetch failures", async () => {
    const fetcher = async () => new Response("missing", { status: 404 });
    await expect(
      loadSceneGltf(
        "/models/missing.glb",
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow(/scene model fetch failed/i);
  });

  it("classifies corrupt GLB bytes as decode failures", async () => {
    const fetcher = async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
    await expect(
      loadSceneGltf(
        "/models/corrupt.glb",
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow(/scene model decode failed/i);
  });
});
