import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const EXPECTED_MODEL_KEYS = [
  "crane",
  "crane-workout",
  "crane-making-table",
  "crane-on-league",
  "crane-throwing-plane",
  "rocket",
  "froggie-display",
];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RELATIVE_PATH_PATTERN = /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/;
const EXPECTED_OWNED_TEXTURES = {
  "crane-on-league": [
    {
      name: "LeagueBanDashboard",
      source: "assets/blender/textures/league-ban-dashboard.png",
    },
    {
      name: "LeagueMatchHistory",
      source: "assets/blender/textures/league-match-history.png",
    },
  ],
  "froggie-display": [
    {
      name: "FroggieGameplay",
      source: "assets/blender/textures/froggie-gameplay-screen.png",
    },
  ],
};

function invariant(condition, message) {
  if (!condition) throw new Error(`Asset manifest: ${message}`);
}

function validateRelativePath(value, label) {
  invariant(typeof value === "string" && RELATIVE_PATH_PATTERN.test(value), `${label} must be repository-relative`);
  invariant(!value.includes("\\"), `${label} must use forward slashes`);
}

function validateModel(model, index) {
  const label = `models[${index}]`;
  invariant(model && typeof model === "object", `${label} must be an object`);
  invariant(model.key === EXPECTED_MODEL_KEYS[index], `${label}.key must be ${EXPECTED_MODEL_KEYS[index]}`);
  validateRelativePath(model.source, `${label}.source`);
  validateRelativePath(model.output, `${label}.output`);
  invariant(model.source.endsWith(".blend"), `${label}.source must end in .blend`);
  invariant(!model.source.endsWith(".blend1"), `${label}.source cannot be a Blender backup`);
  invariant(model.output.endsWith(".glb"), `${label}.output must end in .glb`);
  invariant(Number.isInteger(model.maxBytes) && model.maxBytes > 0, `${label}.maxBytes must be a positive integer`);
  invariant(Number.isInteger(model.minimumAnimations) && model.minimumAnimations >= 0, `${label}.minimumAnimations must be a non-negative integer`);
  invariant(["none", "webp"].includes(model.textureMode), `${label}.textureMode must be none or webp`);
  const expectedOwnedTextures = EXPECTED_OWNED_TEXTURES[model.key] ?? [];
  invariant(
    JSON.stringify(model.ownedTextures ?? []) === JSON.stringify(expectedOwnedTextures),
    `${label}.ownedTextures must match the exact repository-owned image policy`,
  );
  for (const [textureIndex, texture] of expectedOwnedTextures.entries()) {
    invariant(typeof texture.name === "string" && texture.name.length > 0, `${label}.ownedTextures[${textureIndex}].name is invalid`);
    validateRelativePath(texture.source, `${label}.ownedTextures[${textureIndex}].source`);
  }
  const expectedBrandTerms = model.key === "rocket" ? ["nasa", "meatball", "worm"] : [];
  invariant(
    JSON.stringify(model.forbiddenBrandTerms ?? []) === JSON.stringify(expectedBrandTerms),
    `${label}.forbiddenBrandTerms must match the approved brand policy`,
  );
  invariant(Boolean(model.origin) !== Boolean(model.generator), `${label} must define exactly one of origin or generator`);
  if (model.origin) {
    invariant(typeof model.origin.fileName === "string" && model.origin.fileName.endsWith(".blend"), `${label}.origin.fileName must be a .blend file`);
    invariant(Number.isInteger(model.origin.bytes) && model.origin.bytes > 0, `${label}.origin.bytes must be positive`);
    invariant(HASH_PATTERN.test(model.origin.sha256), `${label}.origin.sha256 must be lowercase SHA-256`);
  }
  if (model.generator) validateRelativePath(model.generator, `${label}.generator`);
}

export async function loadSourceManifest({ root = process.cwd() } = {}) {
  const manifestPath = path.join(root, "assets/scene-sources.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  invariant(manifest.schemaVersion === 1, "schemaVersion must be 1");
  invariant(manifest.hardMaxBytes === 25 * 1024 * 1024, "hardMaxBytes must be 25 MiB");
  invariant(manifest.toolchain?.blender?.version === "3.6.23", "Blender must be 3.6.23");
  invariant(HASH_PATTERN.test(manifest.toolchain.blender.sha256), "Blender archive SHA-256 is invalid");
  invariant(manifest.toolchain.gltfTransform === "4.4.1", "glTF Transform must be 4.4.1");
  invariant(manifest.toolchain.gltfValidator === "2.0.0-dev.3.10", "glTF Validator must be 2.0.0-dev.3.10");
  invariant(manifest.toolchain.meshoptimizer === "1.1.1", "Meshoptimizer must be 1.1.1");
  invariant(manifest.toolchain.sharp === "0.35.3", "Sharp must be 0.35.3");
  const capture = manifest.froggieCapture;
  invariant(capture && typeof capture === "object", "froggieCapture must be an object");
  invariant(capture.source === "ReferenceImages/Froggie Gameplay.png", "froggieCapture.source must use the tracked review input");
  invariant(Number.isInteger(capture.bytes) && capture.bytes > 0, "froggieCapture.bytes must be positive");
  invariant(HASH_PATTERN.test(capture.sha256), "froggieCapture.sha256 must be lowercase SHA-256");
  invariant(
    Number.isInteger(capture.crop?.left) && capture.crop.left >= 0 &&
      Number.isInteger(capture.crop?.top) && capture.crop.top >= 0 &&
      Number.isInteger(capture.crop?.width) && capture.crop.width > 0 &&
      Number.isInteger(capture.crop?.height) && capture.crop.height > 0,
    "froggieCapture.crop must contain non-negative integer offsets and positive integer dimensions",
  );
  invariant(
    JSON.stringify(capture.output) === JSON.stringify({
      path: "assets/blender/textures/froggie-gameplay-screen.png",
      width: 1600,
      height: 900,
      fit: "contain",
      background: "#1C1C1C",
    }),
    "froggieCapture.output must match the canonical 1600x900 texture contract",
  );
  invariant(Array.isArray(manifest.models) && manifest.models.length === EXPECTED_MODEL_KEYS.length, "models must contain the seven approved entries");
  manifest.models.forEach(validateModel);
  invariant(new Set(manifest.models.map((model) => model.output)).size === manifest.models.length, "model outputs must be unique");
  return manifest;
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortJsonValue(value[key])]),
    );
  }
  return value;
}

export function stringifyStable(value) {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}
