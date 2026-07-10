import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  loadSourceManifest,
  sha256File,
} from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("source manifest pins the approved models, tools, and budgets", async () => {
  const manifest = await loadSourceManifest({ root });

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.models.map((model) => model.key),
    [
      "crane",
      "crane-workout",
      "crane-making-table",
      "crane-on-league",
      "crane-throwing-plane",
      "rocket",
      "froggie-display",
    ],
  );
  assert.equal(manifest.hardMaxBytes, 25 * 1024 * 1024);
  assert.equal(manifest.models[0].maxBytes, 2 * 1024 * 1024);
  assert.ok(manifest.models.slice(1).every((model) => model.maxBytes === 5 * 1024 * 1024));
  assert.equal(manifest.models.find((model) => model.key === "crane-workout").minimumAnimations, 1);
  assert.deepEqual(
    manifest.models.find((model) => model.key === "crane-on-league").ownedTextures,
    [
      {
        name: "LeagueBanDashboard",
        source: "assets/blender/textures/league-ban-dashboard.png",
      },
      {
        name: "LeagueMatchHistory",
        source: "assets/blender/textures/league-match-history.png",
      },
    ],
  );
  assert.deepEqual(
    manifest.models.find((model) => model.key === "froggie-display").ownedTextures,
    [
      {
        name: "FroggieGameplay",
        source: "assets/blender/textures/froggie-gameplay-screen.png",
      },
    ],
  );
  assert.deepEqual(manifest.froggieCapture, {
    source: "ReferenceImages/Froggie Gameplay.png",
    bytes: 2337398,
    sha256: "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613",
    crop: { left: 254, top: 294, width: 2118, height: 1060 },
    output: {
      path: "assets/blender/textures/froggie-gameplay-screen.png",
      width: 1600,
      height: 900,
      fit: "contain",
      background: "#1C1C1C",
    },
  });
  assert.deepEqual(
    manifest.models.find((model) => model.key === "rocket").forbiddenBrandTerms,
    ["nasa", "meatball", "worm"],
  );
  assert.equal(manifest.toolchain.blender.version, "3.6.23");
  assert.equal(manifest.toolchain.gltfTransform, "4.4.1");
  assert.equal(manifest.toolchain.gltfValidator, "2.0.0-dev.3.10");
  assert.equal(manifest.toolchain.meshoptimizer, "1.1.1");
  assert.equal(manifest.toolchain.sharp, "0.35.3");
});

test("imported Blender files exist and retain either their import or curated hash", async () => {
  const manifest = await loadSourceManifest({ root });
  const provenancePath = path.join(root, "assets/blender/source-provenance.json");
  let provenance = null;

  try {
    provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const model of manifest.models.filter((item) => item.origin)) {
    const sourcePath = path.join(root, model.source);
    await access(sourcePath);
    const actualHash = await sha256File(sourcePath);
    const expectedHash = provenance?.models?.[model.key]?.canonicalSha256 ?? model.origin.sha256;
    assert.equal(actualHash, expectedHash, `${model.source} has an unrecorded change`);
  }
});

test("the source tree contains no Blender backup files", async () => {
  const manifest = await loadSourceManifest({ root });
  assert.ok(manifest.models.every((model) => !model.source.endsWith(".blend1")));
  assert.ok(manifest.models.every((model) => !model.source.includes("RocketExportParticle")));
  assert.ok(manifest.models.every((model) => !model.source.includes("CraneIntepreter")));
  assert.ok(manifest.models.every((model) => !model.source.includes("CubeAnimation")));
});

test("package.json pins the asset toolchain exactly", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

  assert.equal(pkg.dependencies.meshoptimizer, "1.1.1");
  assert.equal(pkg.devDependencies["@gltf-transform/cli"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/core"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/extensions"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/functions"], "4.4.1");
  assert.equal(pkg.devDependencies["gltf-validator"], "2.0.0-dev.3.10");
  assert.equal(pkg.devDependencies.sharp, "0.35.3");
  assert.equal(pkg.scripts["test:assets"], 'node --test --test-concurrency=1 "tests/assets/**/*.test.mjs"');
});
