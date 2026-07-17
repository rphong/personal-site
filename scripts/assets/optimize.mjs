import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  meshopt,
  prune,
  resample,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

import {
  readGlbImagePayloads,
  readGlbJsonBuffer,
} from "./lib/glb.mjs";
import {
  loadSourceManifest,
  stringifyStable,
} from "./lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  promoteCandidateArtifacts,
  readSourceProvenance,
} from "./prepare-all.mjs";
import {
  assertAssetNodeRuntime,
  verifyAssetPackages,
} from "./preflight.mjs";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_GEOMETRY_EXTENSIONS = [
  "EXT_meshopt_compression",
  "KHR_mesh_quantization",
];
const FORBIDDEN_EXTENSIONS = [
  "EXT_texture_avif",
  "KHR_draco_mesh_compression",
  "KHR_texture_basisu",
];
const WEBP_MAX_DIMENSION = 1024;
let sharpPromise = null;

async function loadSharp() {
  sharpPromise ??= import("sharp")
    .then((module) => module.default)
    .catch(() => null);
  return sharpPromise;
}

function readImageDimensions(buffer) {
  if (
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return {
      format: "png",
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16),
    };
  }
  if (
    buffer.length >= 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        format: "webp",
        height: 1 + buffer.readUIntLE(27, 3),
        width: 1 + buffer.readUIntLE(24, 3),
      };
    }
    if (chunk === "VP8L" && buffer[20] === 0x2f) {
      return {
        format: "webp",
        height:
          1 +
          ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10)),
        width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
      };
    }
    const signature = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (signature >= 0 && signature + 7 <= buffer.length) {
      return {
        format: "webp",
        height: buffer.readUInt16LE(signature + 5) & 0x3fff,
        width: buffer.readUInt16LE(signature + 3) & 0x3fff,
      };
    }
  }
  throw new Error("Unsupported image format for dimension inspection");
}

async function imageMetadata(input) {
  const sharp = await loadSharp();
  if (sharp) return sharp(input).metadata();
  const buffer = Buffer.isBuffer(input)
    ? input
    : typeof input === "string"
      ? await readFile(input)
      : Buffer.from(input);
  return readImageDimensions(buffer);
}

function createIo() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertIndex(array, index, label) {
  if (!Number.isInteger(index) || index < 0 || index >= (array?.length ?? 0)) {
    throw new Error(`${label} index is out of bounds`);
  }
  return array[index];
}

function defaultScene(json, model) {
  const sceneIndex = json.scene ?? 0;
  const scene = assertIndex(json.scenes, sceneIndex, `${model.key}: scene`);
  if (!Array.isArray(scene.nodes) || scene.nodes.length !== 1) {
    throw new Error(`${model.key}: optimized GLB must have one scene root`);
  }
  const root = assertIndex(json.nodes, scene.nodes[0], `${model.key}: root node`);
  if (root.name !== "WEB_EXPORT_ROOT") {
    throw new Error(`${model.key}: optimized scene root must be WEB_EXPORT_ROOT`);
  }
  return scene;
}

function primitiveTriangleCount(json, primitive, model) {
  const mode = primitive.mode ?? 4;
  if (mode !== 4) {
    throw new Error(`${model.key}: only triangle primitives are supported`);
  }
  let count;
  if (primitive.indices !== undefined) {
    count = assertIndex(
      json.accessors,
      primitive.indices,
      `${model.key}: primitive indices`,
    ).count;
  } else {
    const positionIndex = primitive.attributes?.POSITION;
    count = assertIndex(
      json.accessors,
      positionIndex,
      `${model.key}: primitive POSITION`,
    ).count;
  }
  if (!Number.isInteger(count) || count <= 0 || count % 3 !== 0) {
    throw new Error(`${model.key}: triangle primitive has an invalid element count`);
  }
  return count / 3;
}

export function getRenderedSceneMetrics(json, model) {
  const scene = defaultScene(json, model);
  const visited = new Set();
  let renderedPrimitiveCount = 0;
  let renderedTriangleCount = 0;

  function visit(nodeIndex) {
    if (visited.has(nodeIndex)) {
      throw new Error(`${model.key}: scene graph reuses or cycles a node`);
    }
    visited.add(nodeIndex);
    const node = assertIndex(json.nodes, nodeIndex, `${model.key}: node`);
    if (node.mesh !== undefined) {
      const mesh = assertIndex(json.meshes, node.mesh, `${model.key}: mesh`);
      if (!Array.isArray(mesh.primitives) || mesh.primitives.length === 0) {
        throw new Error(`${model.key}: mesh contains no primitives`);
      }
      renderedPrimitiveCount += mesh.primitives.length;
      for (const primitive of mesh.primitives) {
        renderedTriangleCount += primitiveTriangleCount(json, primitive, model);
      }
    }
    for (const child of node.children ?? []) visit(child);
  }

  for (const rootNode of scene.nodes) visit(rootNode);
  if (renderedPrimitiveCount <= 0 || renderedTriangleCount <= 0) {
    throw new Error(`${model.key}: scene contains no rendered triangles`);
  }
  return { renderedPrimitiveCount, renderedTriangleCount };
}

export function getAnimationSignature(json, model) {
  return (json.animations ?? [])
    .map((animation, animationIndex) => ({
      channelCount: animation.channels?.length ?? 0,
      name: animation.name ?? `animation-${animationIndex}`,
      samplerCount: animation.samplers?.length ?? 0,
      targets: (animation.channels ?? [])
        .map((channel) => {
          const target = channel.target ?? {};
          const node =
            target.node === undefined
              ? ""
              : assertIndex(
                  json.nodes,
                  target.node,
                  `${model.key}: animation target`,
                ).name ?? `node-${target.node}`;
          return `${node}:${target.path ?? ""}`;
        })
        .sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function expectedImageNames(model) {
  return (model.ownedTextures ?? [])
    .map((texture) => texture.name)
    .sort();
}

function assertEmbeddedResources(json, model) {
  if (
    !Array.isArray(json.buffers) ||
    json.buffers.length < 1 ||
    json.buffers[0].uri !== undefined
  ) {
    throw new Error(`${model.key}: GLB must contain an embedded physical buffer`);
  }
  for (const [index, buffer] of json.buffers.entries()) {
    if (
      buffer.uri !== undefined ||
      (index > 0 &&
        buffer.extensions?.EXT_meshopt_compression?.fallback !== true)
    ) {
      throw new Error(`${model.key}: GLB buffer ${index} is external`);
    }
  }
  const imageNames = (json.images ?? [])
    .map((image, index) => {
      if (image.uri !== undefined || !Number.isInteger(image.bufferView)) {
        throw new Error(`${model.key}: image ${index} is not embedded`);
      }
      return image.name ?? `image-${index}`;
    })
    .sort();
  if (
    stringifyStable(imageNames) !== stringifyStable(expectedImageNames(model))
  ) {
    throw new Error(`${model.key}: embedded image allowlist drifted`);
  }
  if (json.cameras?.length) {
    throw new Error(`${model.key}: optimized GLB contains cameras`);
  }
  if (
    json.extensionsUsed?.includes("KHR_lights_punctual") ||
    json.extensionsRequired?.includes("KHR_lights_punctual")
  ) {
    throw new Error(`${model.key}: optimized GLB contains lights`);
  }
}

async function expectedTextureDimensions(root, model) {
  const dimensions = {};
  for (const texture of model.ownedTextures ?? []) {
    const metadata = await imageMetadata(path.join(root, texture.source));
    if (!metadata.width || !metadata.height) {
      throw new Error(`${model.key}: could not inspect ${texture.name}`);
    }
    const scale = Math.min(
      1,
      WEBP_MAX_DIMENSION / metadata.width,
      WEBP_MAX_DIMENSION / metadata.height,
    );
    dimensions[texture.name] = {
      height: Math.round(metadata.height * scale),
      width: Math.round(metadata.width * scale),
    };
  }
  return dimensions;
}

function requireExtension(json, model, extension) {
  if (
    !json.extensionsUsed?.includes(extension) ||
    !json.extensionsRequired?.includes(extension)
  ) {
    throw new Error(`${model.key}: ${extension} must be used and required`);
  }
}

async function assertOptimizedDocument({
  root,
  model,
  outputBytes,
  rawJson,
}) {
  const outputJson = readGlbJsonBuffer(outputBytes);
  assertEmbeddedResources(outputJson, model);
  for (const extension of REQUIRED_GEOMETRY_EXTENSIONS) {
    requireExtension(outputJson, model, extension);
  }
  for (const extension of FORBIDDEN_EXTENSIONS) {
    if (
      outputJson.extensionsUsed?.includes(extension) ||
      outputJson.extensionsRequired?.includes(extension)
    ) {
      throw new Error(`${model.key}: forbidden extension ${extension} is present`);
    }
  }
  const compressedViews = (outputJson.bufferViews ?? []).filter(
    (view) => view.extensions?.EXT_meshopt_compression,
  );
  if (compressedViews.length === 0) {
    throw new Error(`${model.key}: Meshopt compressed no buffer views`);
  }
  for (const [index, accessor] of (outputJson.accessors ?? []).entries()) {
    if (accessor.bufferView === undefined) continue;
    const view = assertIndex(
      outputJson.bufferViews,
      accessor.bufferView,
      `${model.key}: accessor ${index} bufferView`,
    );
    if (!view.extensions?.EXT_meshopt_compression) {
      throw new Error(
        `${model.key}: accessor ${index} is not Meshopt-compressed`,
      );
    }
  }

  const payloads = readGlbImagePayloads(outputBytes, outputJson);
  if (model.textureMode === "webp") {
    requireExtension(outputJson, model, "EXT_texture_webp");
    const dimensions = await expectedTextureDimensions(root, model);
    for (const payload of payloads) {
      if (payload.mimeType !== "image/webp") {
        throw new Error(`${model.key}: ${payload.name} is not WebP`);
      }
      const metadata = await imageMetadata(payload.payload);
      const expected = dimensions[payload.name];
      if (
        !expected ||
        metadata.format !== "webp" ||
        metadata.width !== expected.width ||
        metadata.height !== expected.height ||
        metadata.width > WEBP_MAX_DIMENSION ||
        metadata.height > WEBP_MAX_DIMENSION
      ) {
        throw new Error(`${model.key}: ${payload.name} dimensions drifted`);
      }
    }
  } else {
    if (payloads.length > 0) {
      throw new Error(`${model.key}: texture-free model contains images`);
    }
    if (
      outputJson.extensionsUsed?.includes("EXT_texture_webp") ||
      outputJson.extensionsRequired?.includes("EXT_texture_webp")
    ) {
      throw new Error(`${model.key}: texture-free model requires WebP`);
    }
  }

  const rawMetrics = getRenderedSceneMetrics(rawJson, model);
  const optimizedMetrics = getRenderedSceneMetrics(outputJson, model);
  if (stringifyStable(rawMetrics) !== stringifyStable(optimizedMetrics)) {
    throw new Error(`${model.key}: optimization changed rendered topology`);
  }
  const rawAnimations = getAnimationSignature(rawJson, model);
  const optimizedAnimations = getAnimationSignature(outputJson, model);
  if (
    stringifyStable(rawAnimations) !== stringifyStable(optimizedAnimations)
  ) {
    throw new Error(`${model.key}: optimization changed animation semantics`);
  }

  const verificationIo = createIo();
  await verificationIo.readBinary(outputBytes);
  return {
    optimizedAnimations,
    optimizedMetrics,
    outputJson,
    rawAnimations,
    rawMetrics,
  };
}

async function readAttestedRaw({
  model,
  inputPath,
  reportPath,
  provenanceEntry,
}) {
  const [inputBytes, reportSource] = await Promise.all([
    readFile(inputPath),
    readFile(reportPath, "utf8"),
  ]);
  const report = JSON.parse(reportSource);
  const expectedSourceSha256 = provenanceEntry?.canonicalSha256;
  if (
    report.schemaVersion !== 1 ||
    report.key !== model.key ||
    !HASH_PATTERN.test(report.sourceSha256 ?? "") ||
    report.sourceSha256 !== expectedSourceSha256 ||
    !HASH_PATTERN.test(report.rawSha256 ?? "") ||
    report.rawSha256 !== sha256Buffer(inputBytes)
  ) {
    throw new Error(`${model.key}: raw GLB does not match its export attestation`);
  }
  const rawJson = readGlbJsonBuffer(inputBytes);
  assertEmbeddedResources(rawJson, model);
  const rawImageNames = (rawJson.images ?? [])
    .map((image, index) => image.name ?? `image-${index}`)
    .sort();
  const rawAnimationNames = (rawJson.animations ?? [])
    .map((animation, index) => animation.name ?? `animation-${index}`)
    .sort();
  if (
    stringifyStable(rawImageNames) !==
      stringifyStable(report.rawGlb?.images ?? []) ||
    stringifyStable(rawAnimationNames) !==
      stringifyStable(report.rawGlb?.animations ?? []) ||
    report.rawGlb?.rootNodeName !== "WEB_EXPORT_ROOT" ||
    report.rawGlb?.sceneRootCount !== 1
  ) {
    throw new Error(`${model.key}: raw GLB report metadata drifted`);
  }
  return { inputBytes, rawJson, report };
}

export async function optimizeOne({ inputBytes, model }) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = createIo();
  const document = await io.readBinary(inputBytes);
  await document.transform(
    dedup({ keepUniqueNames: true }),
    prune({
      keepExtras: true,
      keepLeaves: true,
      keepSolidTextures: true,
    }),
    weld(),
    resample({ cleanup: false, tolerance: 0 }),
  );
  if (model.textureMode === "webp") {
    const sharp = await loadSharp();
    await document.transform(
      textureCompress({
        ...(sharp ? { effort: 100, encoder: sharp, quality: 88 } : {}),
        resize: [WEBP_MAX_DIMENSION, WEBP_MAX_DIMENSION],
        resizeFilter: "lanczos3",
        targetFormat: "webp",
      }),
    );
  }
  await document.transform(
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  return Buffer.from(await io.writeBinary(document));
}

export async function optimizeAll({
  root = process.cwd(),
  only = null,
  rawRoot = path.join(root, ".tmp/assets/raw"),
  reportRoot = path.join(root, ".tmp/assets/reports"),
  outputRoot = null,
} = {}, {
  packageVerifier = verifyAssetPackages,
  provenanceReader = readSourceProvenance,
  reviewedGuard = assertReviewedSourcesUnchanged,
  optimizer = optimizeOne,
  promoter = promoteCandidateArtifacts,
} = {}) {
  assertAssetNodeRuntime();
  const manifest = await loadSourceManifest({ root });
  await packageVerifier({ root, manifest });
  const provenance = await provenanceReader(root);
  await reviewedGuard({ root, manifest, provenance });
  const selected = manifest.models.filter((model) => !only || model.key === only);
  if (only && selected.length !== 1) {
    throw new Error(`Unknown model key: ${only}`);
  }
  if (selected.length === 0) {
    throw new Error("No models were selected for optimization");
  }

  const rawRecords = await Promise.all(
    selected.map(async (model) => {
      const inputPath = path.join(rawRoot, `${model.key}.glb`);
      const reportPath = path.join(reportRoot, `${model.key}.json`);
      const attested = await readAttestedRaw({
        model,
        inputPath,
        reportPath,
        provenanceEntry: provenance.models?.[model.key],
      });
      return { ...attested, inputPath, model, reportPath };
    }),
  );

  const operationId = `${process.pid}-${randomUUID()}`;
  const candidates = [];
  const records = [];
  try {
    for (const { inputBytes, model, rawJson } of rawRecords) {
      const outputPath = outputRoot
        ? path.join(outputRoot, path.basename(model.output))
        : path.join(root, model.output);
      await mkdir(path.dirname(outputPath), { recursive: true });
      const candidatePath = path.join(
        path.dirname(outputPath),
        `.${path.basename(model.output, ".glb")}.${operationId}.next.glb`,
      );
      candidates.push({ candidatePath, outputPath });

      const outputBytes = await optimizer({ inputBytes, model });
      const bytes = outputBytes.length;
      if (bytes <= 0 || bytes >= model.maxBytes || bytes >= manifest.hardMaxBytes) {
        throw new Error(
          `${model.key}: optimized size ${bytes} exceeds its byte budget`,
        );
      }
      const validation = await assertOptimizedDocument({
        root,
        model,
        outputBytes,
        rawJson,
      });
      await writeFile(candidatePath, outputBytes);
      records.push({
        bytes,
        key: model.key,
        optimizedAnimations: validation.optimizedAnimations,
        optimizedMetrics: validation.optimizedMetrics,
        outputPath,
        rawAnimations: validation.rawAnimations,
        rawMetrics: validation.rawMetrics,
      });
    }

    await promoter({ candidates, operationId });
    for (const record of records) {
      console.log(`optimized ${record.key}: ${record.bytes} bytes`);
    }
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
    await optimizeAll({ only });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
