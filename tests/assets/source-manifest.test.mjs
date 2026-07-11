import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadSourceManifest,
  sha256File,
} from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
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
    textureMode: "webp",
    ownedTextures: [
      {
        name: "FroggieGameplay",
        source: "assets/blender/textures/froggie-gameplay-screen.png",
      },
    ],
  },
];

function changeModel(manifest, key, change) {
  const model = manifest.models.find((item) => item.key === key);
  assert.ok(model, `missing test fixture model ${key}`);
  change(model);
}

function createModelContractMutations() {
  const mutations = [];

  for (const expected of EXPECTED_MODELS) {
    const key = expected.key;
    mutations.push(
      {
        label: `${key} source`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.source = `assets/blender/${key}-drift.blend`;
        }),
      },
      {
        label: `${key} output`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.output = `public/models/${key}-drift.glb`;
        }),
      },
      {
        label: `${key} maxBytes`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.maxBytes += 1;
        }),
      },
      {
        label: `${key} minimumAnimations`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.minimumAnimations += 1;
        }),
      },
      {
        label: `${key} textureMode`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.textureMode = model.textureMode === "none" ? "webp" : "none";
        }),
      },
      {
        label: `${key} ownedTextures`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.ownedTextures = model.ownedTextures?.length
            ? model.ownedTextures.map((texture, index) => (
                index === 0 ? { ...texture, name: `${texture.name}Drift` } : texture
              ))
            : [{ name: "UnexpectedTexture", source: "assets/blender/textures/unexpected.png" }];
        }),
      },
      {
        label: `${key} forbiddenBrandTerms`,
        mutate: (manifest) => changeModel(manifest, key, (model) => {
          model.forbiddenBrandTerms = [...(model.forbiddenBrandTerms ?? []), "unexpected"];
        }),
      },
    );

    if (expected.origin) {
      mutations.push(
        {
          label: `${key} origin.fileName`,
          mutate: (manifest) => changeModel(manifest, key, (model) => {
            model.origin.fileName = `${key}-drift.blend`;
          }),
        },
        {
          label: `${key} origin.bytes`,
          mutate: (manifest) => changeModel(manifest, key, (model) => {
            model.origin.bytes += 1;
          }),
        },
        {
          label: `${key} origin.sha256`,
          mutate: (manifest) => changeModel(manifest, key, (model) => {
            model.origin.sha256 = "0".repeat(64);
          }),
        },
        {
          label: `${key} origin replaced by generator`,
          mutate: (manifest) => changeModel(manifest, key, (model) => {
            delete model.origin;
            model.generator = "scripts/assets/blender/unexpected.py";
          }),
        },
      );
    } else {
      mutations.push(
        {
          label: `${key} generator`,
          mutate: (manifest) => changeModel(manifest, key, (model) => {
            model.generator = "scripts/assets/blender/unexpected.py";
          }),
        },
        {
          label: `${key} generator replaced by origin`,
          mutate: (manifest) => changeModel(manifest, key, (model) => {
            delete model.generator;
            model.origin = {
              fileName: "FroggieDisplay.blend",
              bytes: 1,
              sha256: "0".repeat(64),
            };
          }),
        },
      );
    }
  }

  return mutations;
}

async function assertManifestMutationsRejected(mutations) {
  const authoredManifest = JSON.parse(
    await readFile(path.join(root, "assets/scene-sources.json"), "utf8"),
  );
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "personal-site-asset-manifest-"));
  const temporaryAssets = path.join(temporaryRoot, "assets");
  const temporaryManifest = path.join(temporaryAssets, "scene-sources.json");
  await mkdir(temporaryAssets, { recursive: true });

  try {
    for (const { label, mutate } of mutations) {
      const manifest = structuredClone(authoredManifest);
      mutate(manifest);
      await writeFile(temporaryManifest, JSON.stringify(manifest), "utf8");
      await assert.rejects(
        loadSourceManifest({ root: temporaryRoot }),
        /Asset manifest:/,
        `${label} drift should be rejected`,
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function walkFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }

  return files;
}

test("source manifest pins the approved models, tools, and budgets", async () => {
  const manifest = await loadSourceManifest({ root });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.hardMaxBytes, 25 * 1024 * 1024);
  assert.deepEqual(manifest.toolchain.blender, EXPECTED_BLENDER_TOOLCHAIN);
  assert.equal(manifest.toolchain.gltfTransform, "4.4.1");
  assert.equal(manifest.toolchain.gltfValidator, "2.0.0-dev.3.10");
  assert.equal(manifest.toolchain.meshoptimizer, "1.1.1");
  assert.equal(manifest.toolchain.sharp, "0.35.3");
  assert.deepEqual(manifest.models, EXPECTED_MODELS);
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
});

test("loader rejects valid-looking Blender and per-model contract drift", async () => {
  await assertManifestMutationsRejected([
    {
      label: "Blender download URL",
      mutate: (manifest) => {
        manifest.toolchain.blender.downloadUrl =
          "https://download.blender.org/release/Blender3.6/blender-3.6.22-windows-x64.zip";
      },
    },
    {
      label: "Blender archive SHA-256",
      mutate: (manifest) => {
        manifest.toolchain.blender.sha256 = "0".repeat(64);
      },
    },
    ...createModelContractMutations(),
  ]);
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

test("the source tree contains no Blender backup or excluded source files", async () => {
  const blenderRoot = path.join(root, "assets/blender");
  const files = (await walkFiles(blenderRoot))
    .map((filePath) => path.relative(blenderRoot, filePath).replaceAll("\\", "/"));
  const forbiddenFiles = files.filter((filePath) => {
    const name = path.basename(filePath);
    return /\.blend(?:\d+|@|~)$/i.test(name) ||
      /^quit\.blend$/i.test(name) ||
      /RocketExportParticle|CraneIntepreter|CubeAnimation/i.test(filePath);
  });

  assert.deepEqual(forbiddenFiles, [], `forbidden Blender files found: ${forbiddenFiles.join(", ")}`);
});

test("package.json pins the asset toolchain exactly", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(
    await readFile(path.join(root, "package-lock.json"), "utf8"),
  );

  assert.equal(pkg.engines.node, ">=22.15.0");
  assert.equal(lock.packages[""].engines.node, ">=22.15.0");
  assert.equal(pkg.dependencies.meshoptimizer, "1.1.1");
  assert.equal(pkg.devDependencies["@gltf-transform/cli"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/core"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/extensions"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/functions"], "4.4.1");
  assert.equal(pkg.devDependencies["gltf-validator"], "2.0.0-dev.3.10");
  assert.equal(pkg.devDependencies.sharp, "0.35.3");
  assert.equal(pkg.scripts["test:assets"], 'node --test --test-concurrency=1 "tests/assets/**/*.test.mjs"');
});
