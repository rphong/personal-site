import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBlenderScript } from "./lib/blender.mjs";
import {
  sha256File,
  stringifyStable,
} from "./lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  promoteCandidateArtifacts,
  readSourceProvenance,
} from "./prepare-all.mjs";
import { runPreflight } from "./preflight.mjs";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SUPPORTED_MATERIAL_NODES = new Set([
  "ShaderNodeBsdfPrincipled",
  "ShaderNodeOutputMaterial",
  "ShaderNodeTexImage",
]);
const IDENTITY_ROOT_TRANSFORM = {
  location: [0, 0, 0],
  rotationEuler: [0, 0, 0],
  scale: [1, 1, 1],
};

function assertEmptyArray(value, model, label, description = label) {
  if (!Array.isArray(value) || value.length > 0) {
    throw new Error(`${model.key}: ${description} are unsupported`);
  }
}

function expectedPackedImages(model, provenanceEntry) {
  const entries = (model.ownedTextures ?? [])
    .map((texture) => {
      const sha256 =
        provenanceEntry.generatorInputs?.ownedTextures?.[texture.name]?.sha256;
      if (!HASH_PATTERN.test(sha256 ?? "")) {
        throw new Error(
          `${model.key}: packed image allowlist or SHA-256 values drifted`,
        );
      }
      return [texture.name, sha256];
    })
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function rootStateIsInert(state) {
  if (!state || typeof state !== "object") return false;
  if (typeof state.inert === "boolean") return state.inert;
  return (
    state.animation === null &&
    Array.isArray(state.constraints) &&
    state.constraints.length === 0 &&
    state.data === false &&
    stringifyStable(state.deltaLocation) === stringifyStable([0, 0, 0]) &&
    stringifyStable(state.deltaRotationEuler) === stringifyStable([0, 0, 0]) &&
    stringifyStable(state.deltaRotationQuaternion) ===
      stringifyStable([1, 0, 0, 0]) &&
    stringifyStable(state.deltaScale) === stringifyStable([1, 1, 1]) &&
    (state.fieldType === null || state.fieldType === "NONE") &&
    state.hidden === false &&
    state.hideRender === false &&
    state.hideViewport === false &&
    state.instanceCollection === null &&
    state.instanceType === "NONE" &&
    state.isHoldout === false &&
    state.isInstancer === false &&
    state.isShadowCatcher === false &&
    Array.isArray(state.modifiers) &&
    state.modifiers.length === 0 &&
    state.parent === null &&
    Array.isArray(state.particleSystems) &&
    state.particleSystems.length === 0 &&
    state.rigidBody === false &&
    state.rigidBodyConstraint === false &&
    state.rotationMode === "XYZ"
  );
}

export function assertExportableInspection(
  inspection,
  model,
  provenanceEntry = {},
) {
  if (inspection.rootCount !== 1) {
    throw new Error(`${model.key}: expected exactly one WEB_EXPORT_ROOT`);
  }
  if (
    stringifyStable(inspection.rootTransform) !==
    stringifyStable(IDENTITY_ROOT_TRANSFORM)
  ) {
    throw new Error(`${model.key}: WEB_EXPORT_ROOT must have an identity transform`);
  }
  if (
    !rootStateIsInert(inspection.rootState) ||
    (inspection.rootState?.inActiveScene ?? inspection.rootState?.inScene) !== true ||
    inspection.rootState?.inViewLayer !== true
  ) {
    throw new Error(
      `${model.key}: WEB_EXPORT_ROOT must be inert in the active scene and view layer`,
    );
  }
  if (!inspection.objects?.includes("WEB_EXPORT_ROOT")) {
    throw new Error(`${model.key}: WEB_EXPORT_ROOT is absent from the export set`);
  }

  assertEmptyArray(
    inspection.inactiveObjects,
    model,
    "inactiveObjects",
    "objects outside the active scene or view layer",
  );
  assertEmptyArray(
    inspection.externalResources,
    model,
    "externalResources",
    "external resources",
  );
  assertEmptyArray(
    inspection.nonFileImages,
    model,
    "nonFileImages",
    "non-file images",
  );
  assertEmptyArray(
    inspection.particleSystems,
    model,
    "particleSystems",
    "particle systems",
  );
  assertEmptyArray(
    inspection.volumeObjects,
    model,
    "volumeObjects",
    "volume objects",
  );
  assertEmptyArray(
    inspection.shadowCatchers,
    model,
    "shadowCatchers",
    "shadow catchers",
  );
  assertEmptyArray(
    inspection.cameraObjects,
    model,
    "cameraObjects",
    "camera objects",
  );
  assertEmptyArray(
    inspection.lightObjects,
    model,
    "lightObjects",
    "light objects",
  );
  const unsupportedMaterialNodes =
    inspection.unsupportedMaterialNodes ??
    (inspection.materialNodeTypes ?? []).filter(
      (nodeType) => !SUPPORTED_MATERIAL_NODES.has(nodeType),
    );
  assertEmptyArray(
    unsupportedMaterialNodes,
    model,
    "unsupportedMaterialNodes",
    "unsupported material nodes",
  );

  if (!Number.isInteger(inspection.triangleEstimate) || inspection.triangleEstimate <= 0) {
    throw new Error(`${model.key}: export root has no triangles`);
  }

  const expectedHashes = expectedPackedImages(model, provenanceEntry);
  const expectedNames = Object.keys(expectedHashes);
  if (
    stringifyStable(inspection.packedImages ?? []) !==
      stringifyStable(expectedNames) ||
    stringifyStable(inspection.packedImageSha256 ?? {}) !==
      stringifyStable(expectedHashes)
  ) {
    throw new Error(
      `${model.key}: packed image allowlist or SHA-256 values drifted`,
    );
  }

  if (
    !Array.isArray(inspection.animations) ||
    inspection.animations.length < model.minimumAnimations
  ) {
    throw new Error(
      `${model.key}: expected at least ${model.minimumAnimations} animation clip(s)`,
    );
  }
}

function inspectRawGlb(bytes, model, expectedAnimations) {
  if (bytes.length < 20 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(`${model.key}: Blender output is not a binary glTF file`);
  }
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`${model.key}: Blender output has an invalid GLB envelope`);
  }
  const jsonLength = bytes.readUInt32LE(12);
  if (
    bytes.readUInt32LE(16) !== 0x4e4f534a ||
    jsonLength <= 0 ||
    20 + jsonLength > bytes.length
  ) {
    throw new Error(`${model.key}: Blender output has an invalid JSON chunk`);
  }
  let document;
  try {
    document = JSON.parse(
      bytes.subarray(20, 20 + jsonLength).toString("utf8"),
    );
  } catch (error) {
    throw new Error(`${model.key}: Blender output JSON is invalid`, {
      cause: error,
    });
  }
  const scene = document.scenes?.[document.scene ?? 0];
  if (!scene || scene.nodes?.length !== 1) {
    throw new Error(`${model.key}: raw GLB must contain exactly one scene root`);
  }
  const rootNode = document.nodes?.[scene.nodes[0]];
  if (rootNode?.name !== "WEB_EXPORT_ROOT") {
    throw new Error(`${model.key}: raw GLB scene root must be WEB_EXPORT_ROOT`);
  }
  if (document.cameras?.length) {
    throw new Error(`${model.key}: raw GLB contains cameras`);
  }
  if (
    document.extensionsUsed?.includes("KHR_lights_punctual") ||
    document.extensionsRequired?.includes("KHR_lights_punctual")
  ) {
    throw new Error(`${model.key}: raw GLB contains lights`);
  }
  if (
    document.buffers?.length !== 1 ||
    document.buffers[0].uri !== undefined
  ) {
    throw new Error(`${model.key}: raw GLB must use one embedded buffer`);
  }
  const images = (document.images ?? [])
    .map((image, index) => {
      if (image.uri !== undefined || !Number.isInteger(image.bufferView)) {
        throw new Error(`${model.key}: raw GLB image ${index} is external`);
      }
      return image.name ?? `image-${index}`;
    })
    .sort();
  const expectedImages = (model.ownedTextures ?? [])
    .map((texture) => texture.name)
    .sort();
  if (stringifyStable(images) !== stringifyStable(expectedImages)) {
    throw new Error(
      `${model.key}: raw GLB image names differ from the reviewed allowlist`,
    );
  }
  const animations = (document.animations ?? [])
    .map((animation, index) => animation.name ?? `animation-${index}`)
    .sort();
  if (animations.length < model.minimumAnimations) {
    throw new Error(
      `${model.key}: raw GLB expected at least ${model.minimumAnimations} animation clip(s)`,
    );
  }
  if (
    stringifyStable(animations) !==
    stringifyStable([...(expectedAnimations ?? [])].sort())
  ) {
    throw new Error(
      `${model.key}: raw GLB animation names differ from the canonical source`,
    );
  }
  return {
    animations,
    extensionsRequired: [...(document.extensionsRequired ?? [])].sort(),
    extensionsUsed: [...(document.extensionsUsed ?? [])].sort(),
    images,
    rootNodeName: rootNode.name,
    sceneRootCount: scene.nodes.length,
  };
}

async function verifySelectedSources({
  root,
  selected,
  provenance,
  hashFile = sha256File,
}) {
  return Promise.all(
    selected.map(async (model) => {
      const sourcePath = path.join(root, model.source);
      const expectedHash = provenance.models?.[model.key]?.canonicalSha256;
      if (!HASH_PATTERN.test(expectedHash ?? "")) {
        throw new Error(
          `${model.key}: canonical source is missing from source-provenance.json`,
        );
      }
      const sourceSha256 = await hashFile(sourcePath);
      if (sourceSha256 !== expectedHash) {
        throw new Error(
          `${model.key}: canonical source does not match source-provenance.json`,
        );
      }
      return { model, sourcePath, sourceSha256 };
    }),
  );
}

export async function exportAll({
  root = process.cwd(),
  only = null,
  rawRoot = path.join(root, ".tmp/assets/raw"),
  reportRoot = path.join(root, ".tmp/assets/reports"),
} = {}, {
  preflight = runPreflight,
  provenanceReader = readSourceProvenance,
  reviewedGuard = assertReviewedSourcesUnchanged,
  blenderRunner = runBlenderScript,
  hashFile = sha256File,
  promoter = promoteCandidateArtifacts,
} = {}) {
  const { blenderBin, manifest } = await preflight({ root });
  const provenance = await provenanceReader(root);
  await reviewedGuard({ root, manifest, provenance });
  const selected = manifest.models.filter((model) => !only || model.key === only);
  if (only && selected.length !== 1) {
    throw new Error(`Unknown model key: ${only}`);
  }
  if (selected.length === 0) {
    throw new Error("No models were selected for export");
  }

  const sourceRecords = await verifySelectedSources({
    root,
    selected,
    provenance,
    hashFile,
  });
  await Promise.all([
    mkdir(rawRoot, { recursive: true }),
    mkdir(reportRoot, { recursive: true }),
  ]);

  const operationId = `${process.pid}-${randomUUID()}`;
  const candidates = [];
  const records = [];
  try {
    for (const { model, sourcePath, sourceSha256 } of sourceRecords) {
      const rawPath = path.join(rawRoot, `${model.key}.glb`);
      const reportPath = path.join(reportRoot, `${model.key}.json`);
      const rawCandidate = path.join(
        rawRoot,
        `.${model.key}.${operationId}.next.glb`,
      );
      const reportCandidate = path.join(
        reportRoot,
        `.${model.key}.${operationId}.next.json`,
      );
      candidates.push(
        { candidatePath: rawCandidate, outputPath: rawPath },
        { candidatePath: reportCandidate, outputPath: reportPath },
      );

      let exportError;
      try {
        blenderRunner({
          blenderBin,
          blendFile: sourcePath,
          script: path.join(root, "scripts/assets/blender/export_scene.py"),
          scriptArgs: [
            "--output",
            rawCandidate,
            "--report",
            reportCandidate,
          ],
          cwd: root,
        });
      } catch (error) {
        exportError = error;
      }

      const after = await hashFile(sourcePath);
      if (after !== sourceSha256) {
        throw new Error(
          `${model.key}: export changed the canonical .blend file`,
          { cause: exportError },
        );
      }
      if (exportError) throw exportError;

      const [rawBytes, inspectionSource] = await Promise.all([
        readFile(rawCandidate),
        readFile(reportCandidate, "utf8"),
      ]);
      const inspection = JSON.parse(inspectionSource);
      assertExportableInspection(
        inspection,
        model,
        provenance.models[model.key],
      );
      const rawGlb = inspectRawGlb(
        rawBytes,
        model,
        inspection.animations,
      );
      const rawSha256 = createHash("sha256").update(rawBytes).digest("hex");
      const report = {
        schemaVersion: 1,
        key: model.key,
        rawGlb,
        sourceSha256,
        rawSha256,
        inspection,
      };
      await writeFile(reportCandidate, stringifyStable(report));
      records.push({
        key: model.key,
        rawPath,
        reportPath,
        rawSha256,
        rawGlb,
        sourceSha256,
        inspection,
      });
    }

    const finalHashes = await Promise.all(
      sourceRecords.map(({ sourcePath }) => hashFile(sourcePath)),
    );
    for (const [index, finalHash] of finalHashes.entries()) {
      if (finalHash !== sourceRecords[index].sourceSha256) {
        throw new Error(
          `${sourceRecords[index].model.key}: canonical source changed before raw publication`,
        );
      }
    }

    await promoter({ candidates, operationId });
    for (const record of records) console.log(`exported ${record.key}`);
    return records;
  } finally {
    await Promise.all(
      candidates.map(({ candidatePath }) =>
        rm(candidatePath, { force: true }),
      ),
    );
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
  try {
    if (onlyIndex >= 0 && !only) {
      throw new Error("--only requires a model key");
    }
    await exportAll({ only });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
