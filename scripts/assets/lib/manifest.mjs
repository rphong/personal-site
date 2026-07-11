import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RELATIVE_PATH_PATTERN = /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/;
const EXPECTED_BLENDER_TOOLCHAIN = {
  version: "3.6.23",
  downloadUrl: "https://download.blender.org/release/Blender3.6/blender-3.6.23-windows-x64.zip",
  sha256: "e3296eba7eab32c2e5182459ec7614af32224eee2bd32c9d0a08ffd751c54f3b",
};
const EXPECTED_MODELS = [
  {
    key: "crane",
    source: "assets/blender/Crane.blend",
    output: "public/models/crane.glb",
    origin: {
      fileName: "Crane.blend",
      bytes: 1154308,
      sha256: "be2adf030ddcd2fe7f5d9f93eb5a2385d59dc840cf3a71f7e56c602c6470437b",
    },
    maxBytes: 2097152,
    minimumAnimations: 0,
    animationNames: [],
    textureMode: "none",
  },
  {
    key: "crane-workout",
    source: "assets/blender/CraneWorkout.blend",
    output: "public/models/crane-workout.glb",
    origin: {
      fileName: "CraneWorkout.blend",
      bytes: 1609068,
      sha256: "d66c19df5fa3e30b7efbc71553ebb8f2db6bef5be5544005e5da792959941382",
    },
    maxBytes: 5242880,
    minimumAnimations: 1,
    animationNames: ["Dumbell L", "Dumbell R", "Lifting Weights"],
    textureMode: "none",
  },
  {
    key: "crane-making-table",
    source: "assets/blender/CraneMakingTable.blend",
    output: "public/models/crane-making-table.glb",
    origin: {
      fileName: "CraneMakingTable.blend",
      bytes: 1406844,
      sha256: "b3a9addb51fac7bc19944d707d850660a4490a2e6931bcce0846290f9612c2e8",
    },
    maxBytes: 5242880,
    minimumAnimations: 0,
    animationNames: [],
    textureMode: "none",
  },
  {
    key: "crane-on-league",
    source: "assets/blender/CraneOnLeague.blend",
    output: "public/models/crane-on-league.glb",
    origin: {
      fileName: "CraneOnLeague.blend",
      bytes: 1816028,
      sha256: "f3436f0231b0a599c70b2c24c5ad5bbb167ed62c8ec35c948285a0cddfc9db81",
    },
    maxBytes: 5242880,
    minimumAnimations: 0,
    animationNames: [],
    textureMode: "webp",
    ownedTextures: [
      {
        name: "LeagueBanDashboard",
        source: "assets/blender/textures/league-ban-dashboard.png",
      },
      {
        name: "LeagueMatchHistory",
        source: "assets/blender/textures/league-match-history.png",
      },
    ],
  },
  {
    key: "crane-throwing-plane",
    source: "assets/blender/CraneThrowingPlane.blend",
    output: "public/models/crane-throwing-plane.glb",
    origin: {
      fileName: "CraneThrowingPlane.blend",
      bytes: 1384532,
      sha256: "a8a02d0e0cd02dbdafedccdf37c89d30f5d812785255a9f474070b01f5ab1840",
    },
    maxBytes: 5242880,
    minimumAnimations: 0,
    animationNames: ["EmptyAction", "Hat propellerAction.002"],
    textureMode: "none",
  },
  {
    key: "rocket",
    source: "assets/blender/Rocket.blend",
    output: "public/models/rocket.glb",
    origin: {
      fileName: "Rocket.blend",
      bytes: 1227028,
      sha256: "0953bf47975129f879c52b4197188e0b1b6c93de2ebf78a685cf0fcfb6a33010",
    },
    maxBytes: 5242880,
    minimumAnimations: 0,
    animationNames: ["RocketAction"],
    textureMode: "none",
    forbiddenBrandTerms: ["nasa", "meatball", "worm"],
  },
  {
    key: "froggie-display",
    source: "assets/blender/FroggieDisplay.blend",
    output: "public/models/froggie-display.glb",
    generator: "scripts/assets/blender/create_froggie_display.py",
    maxBytes: 5242880,
    minimumAnimations: 0,
    animationNames: [],
    textureMode: "webp",
    ownedTextures: [
      {
        name: "FroggieGameplay",
        source: "assets/blender/textures/froggie-gameplay-screen.png",
      },
    ],
  },
];
const EXPECTED_MODEL_KEYS = EXPECTED_MODELS.map((model) => model.key);
const EXPECTED_MODELS_BY_KEY = new Map(EXPECTED_MODELS.map((model) => [model.key, model]));

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
  const expectedModel = EXPECTED_MODELS_BY_KEY.get(model.key);
  validateRelativePath(model.source, `${label}.source`);
  validateRelativePath(model.output, `${label}.output`);
  invariant(model.source.endsWith(".blend"), `${label}.source must end in .blend`);
  invariant(!model.source.endsWith(".blend1"), `${label}.source cannot be a Blender backup`);
  invariant(model.output.endsWith(".glb"), `${label}.output must end in .glb`);
  invariant(Number.isInteger(model.maxBytes) && model.maxBytes > 0, `${label}.maxBytes must be a positive integer`);
  invariant(Number.isInteger(model.minimumAnimations) && model.minimumAnimations >= 0, `${label}.minimumAnimations must be a non-negative integer`);
  invariant(Array.isArray(model.animationNames), `${label}.animationNames must be an array`);
  invariant(
    model.animationNames.length >= model.minimumAnimations &&
      model.animationNames.every((name) => typeof name === "string" && name.trim().length > 0) &&
      new Set(model.animationNames).size === model.animationNames.length,
    `${label}.animationNames must contain unique non-empty names and satisfy minimumAnimations`,
  );
  invariant(["none", "webp"].includes(model.textureMode), `${label}.textureMode must be none or webp`);
  invariant(model.ownedTextures === undefined || Array.isArray(model.ownedTextures), `${label}.ownedTextures must be an array`);
  for (const [textureIndex, texture] of (model.ownedTextures ?? []).entries()) {
    invariant(typeof texture.name === "string" && texture.name.length > 0, `${label}.ownedTextures[${textureIndex}].name is invalid`);
    validateRelativePath(texture.source, `${label}.ownedTextures[${textureIndex}].source`);
  }
  invariant(Boolean(model.origin) !== Boolean(model.generator), `${label} must define exactly one of origin or generator`);
  if (model.origin) {
    invariant(typeof model.origin.fileName === "string" && model.origin.fileName.endsWith(".blend"), `${label}.origin.fileName must be a .blend file`);
    invariant(Number.isInteger(model.origin.bytes) && model.origin.bytes > 0, `${label}.origin.bytes must be positive`);
    invariant(HASH_PATTERN.test(model.origin.sha256), `${label}.origin.sha256 must be lowercase SHA-256`);
  }
  if (model.generator) validateRelativePath(model.generator, `${label}.generator`);
  invariant(
    stringifyStable(model) === stringifyStable(expectedModel),
    `${label} must match the exact ${expectedModel.key} contract`,
  );
}

export async function loadSourceManifest({ root = process.cwd() } = {}) {
  const manifestPath = path.join(root, "assets/scene-sources.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  invariant(manifest.schemaVersion === 1, "schemaVersion must be 1");
  invariant(manifest.hardMaxBytes === 25 * 1024 * 1024, "hardMaxBytes must be 25 MiB");
  const blender = manifest.toolchain?.blender;
  invariant(blender?.version === EXPECTED_BLENDER_TOOLCHAIN.version, "Blender must be 3.6.23");
  invariant(
    blender?.downloadUrl === EXPECTED_BLENDER_TOOLCHAIN.downloadUrl,
    "Blender downloadUrl must match the pinned official 3.6.23 archive",
  );
  invariant(
    blender?.sha256 === EXPECTED_BLENDER_TOOLCHAIN.sha256,
    "Blender archive SHA-256 must match the pinned official 3.6.23 archive",
  );
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
  invariant(Array.isArray(manifest.models) && manifest.models.length === EXPECTED_MODELS.length, "models must contain the seven approved entries");
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
