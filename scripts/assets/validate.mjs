import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import validator from "gltf-validator";
import sharp from "sharp";

import {
  readGlbImagePayloads,
  readGlbJsonBuffer,
} from "./lib/glb.mjs";
import {
  loadSourceManifest,
  sha256File,
  stringifyStable,
} from "./lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  readSourceProvenance,
} from "./prepare-all.mjs";
import {
  assertAssetNodeRuntime,
  verifyAssetPackages,
} from "./preflight.mjs";
import {
  canonicalJsonSha256,
  pinnedPlaywrightChromiumVersion,
  posterRenderInputsSha256,
} from "../posters/lib.mjs";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const POSTER_MANIFEST_PATH = "public/posters/poster-manifest.json";
const POSTER_MANIFEST_KEYS = [
  "contractSha256",
  "posters",
  "renderer",
  "renderInputsSha256",
  "schemaVersion",
  "toolVersions",
];
const POSTER_RECORD_KEYS = [
  "bytes",
  "height",
  "path",
  "sceneId",
  "sha256",
  "variant",
  "width",
];
const FORBIDDEN_EXTENSIONS = [
  "EXT_texture_avif",
  "KHR_draco_mesh_compression",
  "KHR_texture_basisu",
];
const EXPECTED_VALIDATOR_WARNING_CODES = {
  crane: ["NODE_SKINNED_MESH_NON_ROOT"],
  "crane-making-table": ["NODE_SKINNED_MESH_NON_ROOT"],
  "crane-on-league": ["NODE_SKINNED_MESH_NON_ROOT"],
  "crane-throwing-plane": ["NODE_SKINNED_MESH_NON_ROOT"],
  "crane-workout": ["NODE_SKINNED_MESH_NON_ROOT"],
  "froggie-display": [],
  rocket: [],
};
const EXPECTED_POSTER_VARIANTS = {
  desktop: {
    deviceScaleFactor: 1,
    viewportHeight: 1080,
    viewportWidth: 1920,
  },
  mobile: {
    deviceScaleFactor: 1.5,
    viewportHeight: 844,
    viewportWidth: 390,
  },
};
const EXPECTED_POSTER_SCENES = [
  {
    background: "#9ECCC0",
    id: "home-hero",
    outputs: {
      desktop: "public/posters/home-hero-desktop.webp",
      mobile: "public/posters/home-hero-mobile.webp",
    },
    route: "/",
    source: { kind: "web-scene", modelKey: "crane" },
    transparent: true,
  },
  {
    background: "#DFA9B5",
    id: "experience-hero",
    outputs: {
      desktop: "public/posters/experience-hero-desktop.webp",
      mobile: "public/posters/experience-hero-mobile.webp",
    },
    route: "/experience",
    source: { kind: "web-scene", modelKey: "crane-workout" },
  },
  {
    background: "#DFA9B5",
    id: "experience-intro",
    outputs: {
      desktop: "public/posters/experience-intro-desktop.webp",
      mobile: "public/posters/experience-intro-mobile.webp",
    },
    route: "/experience",
    source: { kind: "web-scene", modelKey: "crane-throwing-plane" },
  },
  {
    background: "#DFA9B5",
    id: "nasa-rocket",
    outputs: {
      desktop: "public/posters/nasa-rocket-desktop.webp",
      mobile: "public/posters/nasa-rocket-mobile.webp",
    },
    route: "/experience",
    source: { kind: "web-scene", modelKey: "rocket" },
  },
  {
    background: "#DFA9B5",
    id: "eog-poster",
    outputs: {
      desktop: "public/posters/eog-poster-desktop.webp",
      mobile: "public/posters/eog-poster-mobile.webp",
    },
    route: "/experience",
    source: { kind: "svg", path: "assets/poster-sources/eog.svg" },
  },
  {
    background: "#DFA9B5",
    id: "paycom-poster",
    outputs: {
      desktop: "public/posters/paycom-poster-desktop.webp",
      mobile: "public/posters/paycom-poster-mobile.webp",
    },
    route: "/experience",
    source: { kind: "svg", path: "assets/poster-sources/paycom.svg" },
  },
  {
    background: "#AFD4E1",
    id: "projects-hero",
    outputs: {
      desktop: "public/posters/projects-hero-desktop.webp",
      mobile: "public/posters/projects-hero-mobile.webp",
    },
    route: "/projects",
    source: { kind: "web-scene", modelKey: "crane-making-table" },
  },
  {
    background: "#AFD4E1",
    id: "league-ban",
    outputs: {
      desktop: "public/posters/league-ban-desktop.webp",
      mobile: "public/posters/league-ban-mobile.webp",
    },
    route: "/projects",
    source: { kind: "web-scene", modelKey: "crane-on-league" },
  },
  {
    background: "#AFD4E1",
    id: "froggie-adventures",
    outputs: {
      desktop: "public/posters/froggie-adventures-desktop.webp",
      mobile: "public/posters/froggie-adventures-mobile.webp",
    },
    route: "/projects",
    source: { kind: "web-scene", modelKey: "froggie-display" },
  },
  {
    background: "#C9BAE4",
    id: "contact-hero",
    outputs: {
      desktop: "public/posters/contact-hero-desktop.webp",
      mobile: "public/posters/contact-hero-mobile.webp",
    },
    route: "/contact",
    source: { kind: "web-scene", modelKey: "crane-workout" },
  },
];

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertExactObjectKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value).sort(compareCodePoints);
  const sortedExpectedKeys = [...expectedKeys].sort(compareCodePoints);
  if (stringifyStable(actualKeys) !== stringifyStable(sortedExpectedKeys)) {
    throw new Error(`${label} fields are invalid`);
  }
}

function extensionPresent(json, name) {
  return (
    json.extensionsUsed?.includes(name) &&
    json.extensionsRequired?.includes(name)
  );
}

function animationNames(json) {
  return (json.animations ?? [])
    .map((animation, index) => animation.name ?? `animation-${index}`)
    .sort();
}

function countGeometry(json) {
  let primitives = 0;
  let triangles = 0;
  let vertices = 0;
  const bounds = {
    max: [-Infinity, -Infinity, -Infinity],
    min: [Infinity, Infinity, Infinity],
  };
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitives += 1;
      const positionAccessor = json.accessors?.[primitive.attributes?.POSITION];
      const indexAccessor = json.accessors?.[primitive.indices];
      vertices += positionAccessor?.count ?? 0;
      const count = indexAccessor?.count ?? positionAccessor?.count ?? 0;
      const mode = primitive.mode ?? 4;
      if (mode === 4) triangles += count / 3;
      if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
      if (
        positionAccessor?.min?.length === 3 &&
        positionAccessor?.max?.length === 3
      ) {
        for (let axis = 0; axis < 3; axis += 1) {
          bounds.min[axis] = Math.min(bounds.min[axis], positionAccessor.min[axis]);
          bounds.max[axis] = Math.max(bounds.max[axis], positionAccessor.max[axis]);
        }
      }
    }
  }
  return {
    bounds:
      bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)
        ? bounds
        : null,
    primitives,
    triangles,
    vertices,
  };
}

function namedAssetText(json) {
  return [
    ...(json.animations ?? []),
    ...(json.images ?? []),
    ...(json.materials ?? []),
    ...(json.meshes ?? []),
    ...(json.nodes ?? []),
    ...(json.textures ?? []),
  ]
    .map((entry) => entry.name ?? "")
    .join("\n")
    .toLowerCase();
}

export function validateGlbMetadata({
  json,
  bytes,
  imagePayloads = [],
  model,
  hardMaxBytes,
}) {
  const errors = [];
  const scene = json.scenes?.[json.scene ?? 0];
  const rootIndices = scene?.nodes ?? [];
  const rootName =
    rootIndices.length === 1 ? json.nodes?.[rootIndices[0]]?.name : null;
  if (json.asset?.version !== "2.0") {
    errors.push("asset.version must be 2.0");
  }
  if (rootIndices.length !== 1 || rootName !== "WEB_EXPORT_ROOT") {
    errors.push("scene must contain exactly one WEB_EXPORT_ROOT");
  }
  if ((json.cameras ?? []).length > 0) {
    errors.push("Blender cameras are forbidden");
  }
  if (
    json.extensionsUsed?.includes("KHR_lights_punctual") ||
    json.extensionsRequired?.includes("KHR_lights_punctual")
  ) {
    errors.push("Blender lights are forbidden");
  }
  if (!extensionPresent(json, "EXT_meshopt_compression")) {
    errors.push("Meshopt must be used and required");
  }
  if (!extensionPresent(json, "KHR_mesh_quantization")) {
    errors.push("mesh quantization must be used and required");
  }
  for (const extension of FORBIDDEN_EXTENSIONS) {
    if (
      json.extensionsUsed?.includes(extension) ||
      json.extensionsRequired?.includes(extension)
    ) {
      errors.push(`forbidden extension is present: ${extension}`);
    }
  }
  if (
    [...(json.buffers ?? []), ...(json.images ?? [])].some(
      (resource) => resource.uri !== undefined,
    )
  ) {
    errors.push("GLB contains an external URI");
  }
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    errors.push("file byte length must be a positive integer");
  }
  if (bytes >= hardMaxBytes) {
    errors.push(`file meets or exceeds the ${hardMaxBytes}-byte hard limit`);
  }
  if (bytes >= model.maxBytes) {
    errors.push(`file meets or exceeds the ${model.maxBytes}-byte preferred budget`);
  }

  const names = namedAssetText(json);
  for (const term of model.forbiddenBrandTerms ?? []) {
    if (names.includes(term.toLowerCase())) {
      errors.push(`GLB contains forbidden brand term: ${term}`);
    }
  }

  const actualAnimationNames = animationNames(json);
  const expectedAnimationNames = [...(model.animationNames ?? [])].sort();
  if (
    actualAnimationNames.some((name) => !name.trim()) ||
    new Set(actualAnimationNames).size !== actualAnimationNames.length ||
    stringifyStable(actualAnimationNames) !==
      stringifyStable(expectedAnimationNames)
  ) {
    errors.push("animation names do not match the exact authored contract");
  }
  if (actualAnimationNames.length < model.minimumAnimations) {
    errors.push(`expected at least ${model.minimumAnimations} animation clip(s)`);
  }

  for (const [index, accessor] of (json.accessors ?? []).entries()) {
    for (const value of [...(accessor.min ?? []), ...(accessor.max ?? [])]) {
      if (!Number.isFinite(value)) {
        errors.push(`accessor ${index} bounds must be finite`);
      }
    }
    if (accessor.bufferView !== undefined) {
      const view = json.bufferViews?.[accessor.bufferView];
      if (!view?.extensions?.EXT_meshopt_compression) {
        errors.push(`accessor ${index} is not Meshopt-compressed`);
      }
    }
  }
  for (const [meshIndex, mesh] of (json.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const position = json.accessors?.[primitive.attributes?.POSITION];
      const count =
        json.accessors?.[primitive.indices]?.count ?? position?.count ?? 0;
      if (
        (primitive.mode ?? 4) !== 4 ||
        !Number.isInteger(count) ||
        count <= 0 ||
        count % 3 !== 0 ||
        position?.min?.length !== 3 ||
        position?.max?.length !== 3 ||
        position.min.some((value, axis) =>
          !Number.isFinite(value) || value > position.max[axis]
        ) ||
        position.max.some((value) => !Number.isFinite(value))
      ) {
        errors.push(`mesh ${meshIndex} primitive ${primitiveIndex} is invalid`);
      }
    }
  }
  const geometry = countGeometry(json);
  if (
    !Number.isInteger(geometry.triangles) ||
    geometry.triangles <= 0 ||
    geometry.vertices <= 0 ||
    geometry.primitives <= 0 ||
    !geometry.bounds
  ) {
    errors.push("GLB must contain bounded triangle geometry");
  }

  const images = json.images ?? [];
  const expectedImageNames = (model.ownedTextures ?? [])
    .map((texture) => texture.name)
    .sort();
  const actualImageNames = imagePayloads
    .map((payload) => payload.name)
    .sort();
  if (
    stringifyStable(actualImageNames) !==
      stringifyStable(expectedImageNames) ||
    imagePayloads.length !== images.length
  ) {
    errors.push("embedded images do not match the exact owned image allowlist");
  }
  if (model.textureMode === "webp") {
    if (!extensionPresent(json, "EXT_texture_webp")) {
      errors.push("textured model must use and require EXT_texture_webp");
    }
    if (
      images.length === 0 ||
      images.some((image) => image.mimeType !== "image/webp")
    ) {
      errors.push("textured model must embed only WebP images");
    }
    if (
      imagePayloads.some(
        (payload) =>
          payload.mimeType !== "image/webp" ||
          !Number.isSafeInteger(payload.bytes) ||
          payload.bytes <= 0 ||
          !HASH_PATTERN.test(payload.sha256 ?? "") ||
          payload.width !== 1024 ||
          payload.height !== 576,
      )
    ) {
      errors.push("WebP image payload metadata is invalid");
    }
  } else {
    if (images.length > 0 || imagePayloads.length > 0) {
      errors.push("texture-free model unexpectedly embeds images");
    }
    if (
      json.extensionsUsed?.includes("EXT_texture_webp") ||
      json.extensionsRequired?.includes("EXT_texture_webp")
    ) {
      errors.push("texture-free model unexpectedly declares EXT_texture_webp");
    }
  }
  return errors;
}

export function validateBrandApprovals({ approvals, provenance }) {
  if (approvals.schemaVersion !== 1) {
    throw new Error("Brand approvals schemaVersion must be 1");
  }
  const policies = {
    "league-owned-art": "crane-on-league",
    "rocket-brand-safety": "rocket",
  };
  if (
    stringifyStable(Object.keys(approvals.approvals ?? {}).sort()) !==
    stringifyStable(Object.keys(policies).sort())
  ) {
    throw new Error("Brand approvals are stale or incomplete");
  }
  for (const [key, modelKey] of Object.entries(policies)) {
    const approval = approvals.approvals[key];
    const model = provenance.models?.[modelKey];
    const valid =
      approval?.status === "approved" &&
      approval.modelKey === modelKey &&
      typeof approval.reviewedBy === "string" &&
      approval.reviewedBy.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(approval.reviewedOn ?? "") &&
      approval.sourceSha256 === model?.canonicalSha256;
    if (!valid) {
      throw new Error(`${key}: brand approval is stale or incomplete`);
    }
    if (key === "league-owned-art") {
      const expectedTextures = Object.fromEntries(
        Object.entries(model.generatorInputs?.ownedTextures ?? {}).map(
          ([name, entry]) => [name, entry.sha256],
        ),
      );
      if (
        stringifyStable(approval.textureSha256 ?? {}) !==
        stringifyStable(expectedTextures)
      ) {
        throw new Error(`${key}: brand approval is stale or incomplete`);
      }
    } else if (Object.hasOwn(approval, "textureSha256")) {
      throw new Error(`${key}: unexpected texture approval payload`);
    }
  }
}

function safeRelativePath(value, expectedPrefix, extension) {
  return (
    typeof value === "string" &&
    value.startsWith(expectedPrefix) &&
    value.endsWith(extension) &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    !value.split("/").includes("..")
  );
}

async function validatePosterSource(root, source) {
  if (source.kind !== "svg") return;
  if (!safeRelativePath(source.path, "assets/poster-sources/", ".svg")) {
    throw new Error(`Unsafe poster source path: ${source.path}`);
  }
  const sourcePath = path.join(root, source.path);
  const svg = await readFile(sourcePath, "utf8");
  if (
    !/^<svg\b/i.test(svg.trim()) ||
    /<!|<image\b|<text\b|<script\b|<style\b|<use\b|<foreignObject\b|\bhref\s*=|\bon\w+\s*=|\burl\s*\(|\b(?:eog|paycom|logo)\b/i.test(
      svg,
    )
  ) {
    throw new Error(`${source.path}: poster source is not an abstract safe vector`);
  }
}

function expectedPosterManifestRecords(contract) {
  return contract.scenes
    .flatMap((scene) =>
      ["desktop", "mobile"].map((variantName) => {
        const variant = contract.variants[variantName];
        return {
          sceneId: scene.id,
          variant: variantName,
          path: scene.outputs[variantName],
          width: Math.round(
            variant.viewportWidth * variant.deviceScaleFactor,
          ),
          height: Math.round(
            variant.viewportHeight * variant.deviceScaleFactor,
          ),
        };
      }),
    )
    .sort(
      (left, right) =>
        compareCodePoints(left.sceneId, right.sceneId) ||
        compareCodePoints(left.variant, right.variant),
    );
}

async function readPosterDirectoryEntries(root) {
  try {
    return await readdir(path.join(root, "public/posters"), {
      withFileTypes: true,
    });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readPosterManifest(root) {
  const manifestPath = path.join(root, POSTER_MANIFEST_PATH);
  let source;
  try {
    source = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Poster manifest is missing: ${POSTER_MANIFEST_PATH}`);
    }
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Poster manifest is not valid JSON: ${POSTER_MANIFEST_PATH}`, {
      cause: error,
    });
  }
}

export async function validatePosterManifest(
  { contract, root },
  { renderInputsHasher = posterRenderInputsSha256 } = {},
) {
  const expectedRecords = expectedPosterManifestRecords(contract);
  const expectedNames = contract.scenes.flatMap((scene) =>
    ["desktop", "mobile"].map((variantName) =>
      path.basename(scene.outputs[variantName]),
    ),
  );
  const directoryEntries = await readPosterDirectoryEntries(root);
  const publishedWebps = directoryEntries
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".webp"))
    .sort(compareCodePoints);
  const publishedSet = new Set(publishedWebps);
  const expectedSet = new Set(expectedNames);
  const missing = expectedNames.filter((name) => !publishedSet.has(name));
  if (missing.length > 0) {
    throw new Error(`Required poster is missing: public/posters/${missing[0]}`);
  }
  const unexpected = publishedWebps.filter((name) => !expectedSet.has(name));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected poster WebP is published: public/posters/${unexpected[0]}`);
  }

  const manifest = await readPosterManifest(root);
  assertExactObjectKeys(manifest, POSTER_MANIFEST_KEYS, "Poster manifest");
  if (manifest.schemaVersion !== 1) {
    throw new Error("Poster manifest schemaVersion must be 1");
  }
  if (
    !HASH_PATTERN.test(manifest.contractSha256 ?? "") ||
    manifest.contractSha256 !== canonicalJsonSha256(contract)
  ) {
    throw new Error("Poster manifest contractSha256 is invalid or stale");
  }
  if (!HASH_PATTERN.test(manifest.renderInputsSha256 ?? "")) {
    throw new Error("Poster manifest renderInputsSha256 is invalid");
  }

  assertExactObjectKeys(
    manifest.renderer,
    ["browser", "browserVersion", "swiftShader"],
    "Poster manifest renderer",
  );
  const expectedBrowserVersion = await pinnedPlaywrightChromiumVersion();
  if (
    manifest.renderer.browser !== "chromium" ||
    manifest.renderer.swiftShader !== true ||
    manifest.renderer.browserVersion !== expectedBrowserVersion
  ) {
    throw new Error("Poster manifest renderer is invalid");
  }

  assertExactObjectKeys(
    manifest.toolVersions,
    ["playwright", "sharp"],
    "Poster manifest toolVersions",
  );
  const packageJson = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const expectedToolVersions = {
    playwright: packageJson.devDependencies?.["@playwright/test"],
    sharp: packageJson.devDependencies?.sharp,
  };
  if (
    typeof expectedToolVersions.playwright !== "string" ||
    typeof expectedToolVersions.sharp !== "string" ||
    stringifyStable(manifest.toolVersions) !==
      stringifyStable(expectedToolVersions)
  ) {
    throw new Error("Poster manifest toolVersions do not match package.json");
  }

  if (!Array.isArray(manifest.posters) || manifest.posters.length !== 20) {
    throw new Error("Poster manifest must contain exactly 20 records");
  }
  for (const [index, expected] of expectedRecords.entries()) {
    const record = manifest.posters[index];
    assertExactObjectKeys(
      record,
      POSTER_RECORD_KEYS,
      `Poster manifest record ${index}`,
    );
    for (const field of ["sceneId", "variant", "path", "width", "height"]) {
      if (record[field] !== expected[field]) {
        throw new Error(
          `Poster manifest record ${index} ${field} does not match the exact poster contract`,
        );
      }
    }
    if (!Number.isSafeInteger(record.bytes) || record.bytes <= 0) {
      throw new Error(`Poster manifest record ${index} bytes are invalid`);
    }
    if (!HASH_PATTERN.test(record.sha256 ?? "")) {
      throw new Error(`Poster manifest record ${index} sha256 is invalid`);
    }
  }

  const expectedRenderInputsSha256 = await renderInputsHasher(root);
  if (manifest.renderInputsSha256 !== expectedRenderInputsSha256) {
    throw new Error("Poster manifest renderInputsSha256 is stale");
  }

  for (const record of manifest.posters) {
    const outputPath = path.join(root, record.path);
    const stats = await lstat(outputPath);
    if (!stats.isFile()) {
      throw new Error(`Required poster is not a regular file: ${record.path}`);
    }
    const buffer = await readFile(outputPath);
    if (stats.size !== buffer.byteLength || record.bytes !== buffer.byteLength) {
      throw new Error(`Poster manifest byte length drifted: ${record.path}`);
    }
    if (sha256Buffer(buffer) !== record.sha256) {
      throw new Error(`Poster manifest sha256 drifted: ${record.path}`);
    }
    let metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch (error) {
      throw new Error(`Required poster is not a valid WebP: ${record.path}`, {
        cause: error,
      });
    }
    if (
      metadata.format !== "webp" ||
      metadata.width !== record.width ||
      metadata.height !== record.height
    ) {
      throw new Error(`Required poster dimensions drifted: ${record.path}`);
    }
  }

  return manifest;
}

export async function validatePosterContract({
  contract,
  manifest,
  root,
  requirePosters,
}) {
  if (contract.schemaVersion !== 1) {
    throw new Error("Poster contract schemaVersion must be 1");
  }
  if (
    stringifyStable(contract.variants) !==
    stringifyStable(EXPECTED_POSTER_VARIANTS)
  ) {
    throw new Error("Poster contract variants are invalid");
  }
  if (
    stringifyStable(contract.scenes) !==
    stringifyStable(EXPECTED_POSTER_SCENES)
  ) {
    throw new Error("Poster scenes do not match the exact approved contract");
  }
  const modelKeys = new Set(manifest.models.map((entry) => entry.key));
  const outputs = new Set();
  for (const scene of contract.scenes) {
    if (scene.source.kind === "web-scene") {
      if (!modelKeys.has(scene.source.modelKey)) {
        throw new Error(`${scene.id}: unknown model key ${scene.source.modelKey}`);
      }
    } else {
      await validatePosterSource(root, scene.source);
    }
    for (const variantName of ["desktop", "mobile"]) {
      const output = scene.outputs[variantName];
      if (!safeRelativePath(output, "public/posters/", ".webp")) {
        throw new Error(`${scene.id}: unsafe ${variantName} poster output`);
      }
      if (outputs.has(output)) {
        throw new Error(`Duplicate poster output: ${output}`);
      }
      outputs.add(output);
    }
  }
  if (outputs.size !== 20) {
    throw new Error("Poster contract must contain exactly 20 unique outputs");
  }
  if (requirePosters) {
    await validatePosterManifest({ contract, root });
  }
}

async function serializableImageMetadata(imagePayloads) {
  return Promise.all(
    imagePayloads.map(async (payload) => {
      const metadata = await sharp(payload.payload).metadata();
      return {
        bytes: payload.bytes,
        height: metadata.height,
        mimeType: payload.mimeType,
        name: payload.name,
        sha256: payload.sha256,
        width: metadata.width,
      };
    }),
  );
}

export async function writeManifestAtomically(
  outputPath,
  serialized,
  {
    operationId = `${process.pid}-${randomUUID()}`,
    renameFile = rename,
    removeFile = rm,
    write = writeFile,
  } = {},
) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const candidatePath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${operationId}.next`,
  );
  try {
    await write(candidatePath, serialized);
    await renameFile(candidatePath, outputPath);
  } finally {
    await removeFile(candidatePath, { force: true });
  }
}

export async function validateAll({
  root = process.cwd(),
  modelRoot = null,
  outputPath = path.join(root, "public/models/assets-manifest.json"),
  requirePosters = false,
  writeManifest = false,
} = {}, {
  packageVerifier = verifyAssetPackages,
  manifestWriter = writeManifestAtomically,
} = {}) {
  assertAssetNodeRuntime();
  const manifest = await loadSourceManifest({ root });
  await packageVerifier({ root, manifest });
  const provenance = await readSourceProvenance(root);
  await assertReviewedSourcesUnchanged({ root, manifest, provenance });
  const approvals = JSON.parse(
    await readFile(path.join(root, "assets/brand-approvals.json"), "utf8"),
  );
  validateBrandApprovals({ approvals, provenance });
  const posterContract = JSON.parse(
    await readFile(path.join(root, "assets/poster-contract.json"), "utf8"),
  );
  await validatePosterContract({
    contract: posterContract,
    manifest,
    requirePosters,
    root,
  });

  const models = {};
  for (const model of manifest.models) {
    const modelPath = modelRoot
      ? path.join(modelRoot, path.basename(model.output))
      : path.join(root, model.output);
    const buffer = await readFile(modelPath);
    const json = readGlbJsonBuffer(buffer);
    const rawImagePayloads = readGlbImagePayloads(buffer, json);
    const textures = (await serializableImageMetadata(rawImagePayloads)).sort(
      (left, right) => left.name.localeCompare(right.name),
    );
    const metadataErrors = validateGlbMetadata({
      bytes: buffer.length,
      hardMaxBytes: manifest.hardMaxBytes,
      imagePayloads: textures,
      json,
      model,
    });
    const validatorReport = await validator.validateBytes(
      new Uint8Array(buffer),
      {
        format: "glb",
        maxIssues: 1000,
        uri: path.basename(model.output),
        writeTimestamp: false,
      },
    );
    const validatorErrors = (validatorReport.issues?.messages ?? [])
      .filter((issue) => issue.severity === 0)
      .map((issue) => `${issue.code}: ${issue.message}`);
    const validatorWarningCodes = (validatorReport.issues?.messages ?? [])
      .filter((issue) => issue.severity === 1)
      .map((issue) => issue.code)
      .sort();
    const expectedWarnings = EXPECTED_VALIDATOR_WARNING_CODES[model.key];
    if (
      !expectedWarnings ||
      stringifyStable(validatorWarningCodes) !==
        stringifyStable(expectedWarnings)
    ) {
      metadataErrors.push(
        `validator warning drift: expected ${JSON.stringify(expectedWarnings ?? [])}, received ${JSON.stringify(validatorWarningCodes)}`,
      );
    }
    if (metadataErrors.length > 0 || validatorErrors.length > 0) {
      throw new Error(
        `${model.key} failed validation:\n${[
          ...metadataErrors,
          ...validatorErrors,
        ].join("\n")}`,
      );
    }

    const sourceSha256 = await sha256File(path.join(root, model.source));
    if (sourceSha256 !== provenance.models?.[model.key]?.canonicalSha256) {
      throw new Error(`${model.key}: source provenance mismatch`);
    }
    const geometry = countGeometry(json);
    models[model.key] = {
      animations: animationNames(json),
      bytes: buffer.length,
      extensionsRequired: [...(json.extensionsRequired ?? [])].sort(),
      extensionsUsed: [...(json.extensionsUsed ?? [])].sort(),
      materials: (json.materials ?? []).length,
      nodes: (json.nodes ?? []).length,
      primitives: geometry.primitives,
      sha256: sha256Buffer(buffer),
      sourceSha256,
      textures,
      triangles: geometry.triangles,
      url: `/${model.output.replace(/^public\//, "")}`,
      validatorWarningCodes,
      vertices: geometry.vertices,
    };
  }

  const generated = {
    models,
    schemaVersion: 1,
    toolchain: {
      blender: manifest.toolchain.blender.version,
      gltfTransform: manifest.toolchain.gltfTransform,
      gltfValidator: manifest.toolchain.gltfValidator,
      meshoptimizer: manifest.toolchain.meshoptimizer,
      sharp: manifest.toolchain.sharp,
    },
  };
  const serialized = stringifyStable(generated);
  if (writeManifest) {
    await manifestWriter(outputPath, serialized);
  } else {
    let committed;
    try {
      committed = await readFile(outputPath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          "committed model manifest is missing; run npm run assets:manifest after reviewed regeneration.",
        );
      }
      throw error;
    }
    if (committed !== serialized) {
      throw new Error(
        "committed model manifest drifted; run npm run assets:manifest only after reviewing regenerated GLBs.",
      );
    }
  }
  return generated;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await validateAll({
      requirePosters: process.argv.includes("--require-posters"),
      writeManifest: process.argv.includes("--write-manifest"),
    });
    console.log("asset validation passed");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
