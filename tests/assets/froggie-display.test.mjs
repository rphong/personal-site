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
  assertFroggieReplacementAllowed,
  createFroggieDisplay,
} from "../../scripts/assets/create-froggie-display.mjs";
import {
  resolveBlenderBin,
  runBlenderScript,
} from "../../scripts/assets/lib/blender.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/froggie-display-test-${process.pid}`,
);
const expectedPayload = [
  "ActionButtonA",
  "ActionButtonB",
  "ArcadeBase",
  "ArcadeCabinet",
  "ArcadePedestal",
  "ControlDeck",
  "FrogEyeLeft",
  "FrogEyeRight",
  "FrogPupilLeft",
  "FrogPupilRight",
  "GameplayScreen",
  "Joystick",
  "JoystickStem",
  "WEB_EXPORT_ROOT",
];

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function inspect(blenderBin, blendFile, name) {
  const reportPath = path.join(tempRoot, `${name}.json`);
  runBlenderScript({
    blenderBin,
    blendFile,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", reportPath],
    cwd: root,
  });
  return JSON.parse(await readFile(reportPath, "utf8"));
}

function semanticInspection(inspection) {
  return {
    allObjectParents: inspection.allObjectParents,
    fileImages: inspection.fileImages,
    materialImages: inspection.materialImages,
    materialNames: inspection.materialNames,
    materialNodeTypes: inspection.materialNodeTypes,
    meshNames: inspection.meshNames,
    objectMaterials: inspection.objectMaterials,
    objectDimensions: inspection.objectDimensions,
    objectModifiers: inspection.objectModifiers,
    objectParents: inspection.objectParents,
    objects: inspection.objects,
    objectTypes: inspection.objectTypes,
    objectTransforms: inspection.objectTransforms,
    packedImageSha256: inspection.packedImageSha256,
    rootCustomProperties: inspection.rootCustomProperties,
    rootState: inspection.rootState,
    triangleEstimate: inspection.triangleEstimate,
  };
}

test("Froggie display is deterministic, packed, bounded, and ground-free", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const firstOutput = path.join(tempRoot, "FroggieDisplay-first.blend");
  const secondOutput = path.join(tempRoot, "FroggieDisplay-second.blend");
  await createFroggieDisplay({
    root,
    output: firstOutput,
    writeProvenance: false,
  });
  await createFroggieDisplay({
    root,
    output: secondOutput,
    writeProvenance: false,
  });
  const first = await inspect(blenderBin, firstOutput, "first");
  const second = await inspect(blenderBin, secondOutput, "second");
  assert.deepEqual(semanticInspection(second), semanticInspection(first));

  assert.equal(first.rootCount, 1);
  assert.deepEqual(first.objects, expectedPayload);
  assert.deepEqual(first.externalResources, []);
  assert.deepEqual(first.nonFileImages, []);
  assert.deepEqual(first.particleSystems, []);
  assert.deepEqual(first.volumeObjects, []);
  assert.deepEqual(first.shadowCatchers, []);
  assert.deepEqual(first.animations, []);
  assert.deepEqual(first.packedImages, ["FroggieGameplay"]);
  assert.deepEqual(first.packedImageSha256, {
    FroggieGameplay: await sha256File(
      path.join(
        root,
        "assets/blender/textures/froggie-gameplay-screen.png",
      ),
    ),
  });
  assert.deepEqual(first.fileImages, [
    {
      filepath: "//textures/froggie-gameplay-screen.png",
      name: "FroggieGameplay",
      packed: true,
      source: "FILE",
    },
  ]);
  assert.deepEqual(first.materialImages.GameplayScreenMaterial, [
    "FroggieGameplay",
  ]);
  assert.deepEqual(first.objectMaterials.GameplayScreen, [
    "GameplayScreenMaterial",
  ]);
  assert.deepEqual(first.objectDimensions.GameplayScreen, [3.45, 1.94, 0]);
  assert.deepEqual(first.objectTransforms.GameplayScreen, {
    location: [0, -0.316, 3.15],
    rotationEuler: [1.570796, 0, 0],
    scale: [1, 1, 1],
  });
  assert.ok(first.allObjects.includes("ReferenceCamera"));
  assert.ok(first.allObjects.includes("ReferenceKeyLight"));
  assert.ok(!first.objects.includes("ReferenceCamera"));
  assert.ok(!first.objects.includes("ReferenceKeyLight"));
  assert.ok(!first.allObjects.includes("Ground"));
  assert.ok(!first.allObjects.includes("Shadow Catcher"));
  assert.ok(!first.meshNames.includes("Plane"));
  assert.ok(!first.meshNames.includes("Plane.001"));
  assert.deepEqual(
    Object.values(first.objectModifiers).flat(),
    [],
  );
  assert.equal(first.rootCustomProperties.froggie_display_version, 1);
  assert.equal(
    first.rootCustomProperties.web_ground_shadow_strategy,
    "transparent-canvas-contact-shadow-v1",
  );
  assert.ok(first.triangleEstimate > 0);
  assert.ok(
    first.triangleEstimate <= 2_000,
    `triangle estimate was ${first.triangleEstimate}`,
  );
});

test("an existing canonical Froggie source requires the explicit replacement path", () => {
  assert.throws(
    () =>
      assertFroggieReplacementAllowed({
        canonical: true,
        exists: true,
        replace: false,
      }),
    /--replace/,
  );
  assert.doesNotThrow(() =>
    assertFroggieReplacementAllowed({
      canonical: true,
      exists: true,
      replace: true,
    }),
  );
  assert.throws(
    () =>
      assertFroggieReplacementAllowed({
        canonical: true,
        exists: false,
        replace: true,
      }),
    /existing canonical/,
  );
  assert.throws(
    () =>
      assertFroggieReplacementAllowed({
        canonical: false,
        exists: false,
        replace: true,
      }),
    /canonical output/,
  );
});

test("canonical Froggie promotion rolls blend and texture back on provenance failure", async () => {
  const fixtureRoot = path.join(tempRoot, "rollback-fixture");
  const textureRoot = path.join(fixtureRoot, "assets/blender/textures");
  const output = path.join(fixtureRoot, "assets/blender/FroggieDisplay.blend");
  const textureOutput = path.join(
    textureRoot,
    "froggie-gameplay-screen.png",
  );
  const textureCandidate = path.join(textureRoot, ".froggie.next.png");
  await mkdir(textureRoot, { recursive: true });
  await writeFile(textureOutput, "reviewed-texture");
  let cleaned = false;

  await assert.rejects(
    createFroggieDisplay(
      { root: fixtureRoot, output },
      {
        preflight: async () => ({
          blenderBin: "fixture-blender",
          manifest: {
            models: [
              {
                key: "froggie-display",
                source: "assets/blender/FroggieDisplay.blend",
              },
            ],
          },
        }),
        provenanceReader: async () => ({ schemaVersion: 1, models: {} }),
        reviewedGuard: async () => undefined,
        stageTextures: async () => {
          await writeFile(textureCandidate, "candidate-texture");
          return {
            candidates: [
              {
                candidatePath: textureCandidate,
                key: "FroggieGameplay",
                outputPath: textureOutput,
              },
            ],
            cleanup: async () => {
              cleaned = true;
              await rm(textureCandidate, { force: true });
            },
            operationId: "rollback-fixture",
          };
        },
        blenderRunner: ({ scriptArgs }) => {
          const candidate = scriptArgs[scriptArgs.indexOf("--output") + 1];
          writeFileSync(candidate, "candidate-blend");
        },
        provenanceWriter: async () => {
          throw new Error("injected Froggie provenance failure");
        },
      },
    ),
    /injected Froggie provenance failure/,
  );

  assert.equal(cleaned, true);
  await assert.rejects(access(output), { code: "ENOENT" });
  assert.equal(await readFile(textureOutput, "utf8"), "reviewed-texture");
  assert.deepEqual(await readdir(path.join(fixtureRoot, ".tmp/assets/curated")), []);
  assert.deepEqual(
    (await readdir(textureRoot)).filter((name) =>
      /\.next\.|\.backup$/.test(name)),
    [],
  );
});
