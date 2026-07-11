import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertExportableInspection,
  exportAll,
} from "../../scripts/assets/export-all.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/export-contract-test-${process.pid}`,
);

const validInspection = {
  animations: [],
  cameraObjects: [],
  externalResources: [],
  inactiveObjects: [],
  lightObjects: [],
  materialNodeTypes: [
    "ShaderNodeBsdfPrincipled",
    "ShaderNodeOutputMaterial",
  ],
  nonFileImages: [],
  objects: ["WEB_EXPORT_ROOT", "Crane"],
  packedImages: [],
  packedImageSha256: {},
  particleSystems: [],
  rootCount: 1,
  rootState: { inert: true, inActiveScene: true, inViewLayer: true },
  rootTransform: {
    location: [0, 0, 0],
    rotationEuler: [0, 0, 0],
    scale: [1, 1, 1],
  },
  shadowCatchers: [],
  triangleEstimate: 12,
  unsupportedMaterialNodes: [],
  volumeObjects: [],
};

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("inspection rejects every unsupported export condition", () => {
  const model = { key: "fixture", minimumAnimations: 0 };
  assert.doesNotThrow(() =>
    assertExportableInspection(validInspection, model),
  );

  const invalidCases = [
    [{ rootCount: 0 }, /exactly one WEB_EXPORT_ROOT/],
    [
      { rootTransform: { ...validInspection.rootTransform, scale: [2, 1, 1] } },
      /identity transform/,
    ],
    [{ rootState: { ...validInspection.rootState, inert: false } }, /inert/],
    [{ externalResources: [{ kind: "image" }] }, /external resources/],
    [{ nonFileImages: ["Generated"] }, /non-file images/],
    [{ particleSystems: ["Smoke"] }, /particle systems/],
    [{ volumeObjects: ["Fog"] }, /volume objects/],
    [{ shadowCatchers: ["Ground"] }, /shadow catchers/],
    [{ cameraObjects: ["Camera"] }, /camera objects/],
    [{ lightObjects: ["Key"] }, /light objects/],
    [
      { unsupportedMaterialNodes: ["ShaderNodeTexNoise"] },
      /unsupported material nodes/,
    ],
    [{ triangleEstimate: 0 }, /no triangles/],
  ];

  for (const [change, pattern] of invalidCases) {
    assert.throws(
      () =>
        assertExportableInspection(
          { ...validInspection, ...change },
          model,
        ),
      pattern,
    );
  }

  assert.throws(
    () =>
      assertExportableInspection(
        {
          ...validInspection,
          packedImages: ["UnreviewedOfficialArt"],
          packedImageSha256: { UnreviewedOfficialArt: "a".repeat(64) },
        },
        model,
        {},
      ),
    /packed image allowlist/,
  );
  assert.throws(
    () =>
      assertExportableInspection(validInspection, {
        key: "animated",
        minimumAnimations: 1,
      }),
    /at least 1 animation/,
  );
  assert.throws(
    () =>
      assertExportableInspection(
        validInspection,
        {
          key: "textured",
          minimumAnimations: 0,
          ownedTextures: [{ name: "ReviewedTexture" }],
        },
        {},
      ),
    /packed image allowlist/,
  );
});

function readGlbJson(bytes) {
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
}

test("exporting Workout preserves every clip and never changes its canonical blend", async () => {
  const sourcePath = path.join(root, "assets/blender/CraneWorkout.blend");
  const before = await sha256File(sourcePath);
  const [record] = await exportAll({
    root,
    only: "crane-workout",
    rawRoot: path.join(tempRoot, "raw"),
    reportRoot: path.join(tempRoot, "reports"),
  });
  const after = await sha256File(sourcePath);
  const bytes = await readFile(record.rawPath);
  const report = JSON.parse(await readFile(record.reportPath, "utf8"));
  const glb = readGlbJson(bytes);

  assert.equal(before, after);
  assert.equal(record.sourceSha256, before);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.key, "crane-workout");
  assert.equal(report.sourceSha256, before);
  assert.equal(report.rawSha256, record.rawSha256);
  assert.equal(report.rawGlb.rootNodeName, "WEB_EXPORT_ROOT");
  assert.equal(report.rawGlb.sceneRootCount, 1);
  assert.deepEqual(report.rawGlb.images, []);
  assert.deepEqual(report.rawGlb.animations, [
    "Dumbell L",
    "Dumbell R",
    "Lifting Weights",
  ]);
  assert.deepEqual(report.inspection, record.inspection);
  assert.equal(record.inspection.rootCount, 1);
  assert.deepEqual(record.inspection.externalResources, []);
  assert.deepEqual(record.inspection.cameraObjects, []);
  assert.deepEqual(record.inspection.lightObjects, []);
  assert.equal(glb.scenes[glb.scene].nodes.length, 1);
  assert.equal(glb.nodes[glb.scenes[glb.scene].nodes[0]].name, "WEB_EXPORT_ROOT");
  assert.equal(glb.cameras, undefined);
  assert.ok(!glb.extensionsUsed?.includes("KHR_lights_punctual"));
});

test("a failing Blender export still detects source mutation and publishes nothing", async () => {
  const fixtureRoot = path.join(tempRoot, "mutation-fixture");
  const sourcePath = path.join(fixtureRoot, "assets/Fixture.blend");
  const rawRoot = path.join(fixtureRoot, ".tmp/raw");
  const reportRoot = path.join(fixtureRoot, ".tmp/reports");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, "reviewed-source");
  const sourceSha256 = await sha256File(sourcePath);
  const model = {
    key: "fixture",
    minimumAnimations: 0,
    source: "assets/Fixture.blend",
  };

  await assert.rejects(
    exportAll(
      { root: fixtureRoot, rawRoot, reportRoot },
      {
        preflight: async () => ({
          blenderBin: "fixture-blender",
          manifest: { models: [model] },
        }),
        provenanceReader: async () => ({
          schemaVersion: 1,
          models: {
            fixture: {
              canonicalSha256: sourceSha256,
              source: model.source,
            },
          },
        }),
        reviewedGuard: async () => undefined,
        blenderRunner: () => {
          writeFileSync(sourcePath, "mutated-source");
          throw new Error("injected Blender failure");
        },
      },
    ),
    /export changed the canonical .blend file/,
  );

  await assert.rejects(access(path.join(rawRoot, "fixture.glb")), {
    code: "ENOENT",
  });
  await assert.rejects(access(path.join(reportRoot, "fixture.json")), {
    code: "ENOENT",
  });
  assert.deepEqual(await readdir(rawRoot), []);
  assert.deepEqual(await readdir(reportRoot), []);
});
