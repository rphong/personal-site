import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPosterManifest,
  canonicalJsonSha256,
  changedChannelRatio,
  normalizePosterRenderInput,
  posterRenderInputsSha256,
  sha256Buffer,
} from "../../scripts/posters/lib.mjs";

test("poster manifest is stable and sorted by scene then variant", () => {
  const manifest = buildPosterManifest({
    browserVersion: "123.0.0",
    contractSha256: "abc123",
    renderInputsSha256: "render123",
    toolVersions: { playwright: "1.61.1", sharp: "0.35.3" },
    posters: [
      {
        sceneId: "projects-hero",
        variant: "mobile",
        path: "public/posters/projects-hero-mobile.webp",
        width: 585,
        height: 1266,
        bytes: 20,
        sha256: "second",
      },
      {
        sceneId: "home-hero",
        variant: "desktop",
        path: "public/posters/home-hero-desktop.webp",
        width: 1920,
        height: 1080,
        bytes: 10,
        sha256: "first",
      },
    ],
  });

  assert.deepEqual(
    manifest.posters.map(({ sceneId, variant }) => [sceneId, variant]),
    [
      ["home-hero", "desktop"],
      ["projects-hero", "mobile"],
    ],
  );
  assert.equal(JSON.stringify(manifest).includes("2026-"), false);
  assert.equal(JSON.stringify(manifest).includes("C:\\"), false);
  assert.equal(manifest.renderInputsSha256, "render123");
  assert.deepEqual(manifest.renderer, {
    browser: "chromium",
    browserVersion: "123.0.0",
    swiftShader: true,
  });
});

test("pixel comparison tolerates tiny channel drift and rejects visual drift", () => {
  const baseline = Uint8Array.from([0, 10, 20, 255, 40, 50, 60, 255]);
  const tiny = Uint8Array.from([1, 12, 22, 255, 42, 52, 63, 255]);
  const changed = Uint8Array.from([30, 40, 50, 255, 80, 90, 100, 255]);

  assert.equal(changedChannelRatio(baseline, tiny, 4), 0);
  assert.ok(changedChannelRatio(baseline, changed, 4) > 0.5);
  assert.equal(changedChannelRatio(baseline, baseline.subarray(1), 4), 1);
  assert.equal(changedChannelRatio(new Uint8Array(), new Uint8Array(), 4), 1);
});

test("buffer and render-input hashing are deterministic", async () => {
  assert.equal(
    sha256Buffer(Buffer.from("poster")),
    "293b9207228b7854bc3ccb2959ebea1583e066d41983124a5b381d6fdf6575f8",
  );
  const first = await posterRenderInputsSha256();
  const second = await posterRenderInputsSha256();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(second, first);
});

test("render provenance normalizes line endings and JSON formatting", () => {
  assert.deepEqual(
    normalizePosterRenderInput("example.ts", Buffer.from("a\r\nb\r")),
    Buffer.from("a\nb\n"),
  );
  assert.equal(
    canonicalJsonSha256('{\r\n  "b": 2, "a": 1\r\n}'),
    canonicalJsonSha256('{"a":1,"b":2}'),
  );
});
