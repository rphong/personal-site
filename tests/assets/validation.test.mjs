import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadSourceManifest } from "../../scripts/assets/lib/manifest.mjs";
import {
  validateAll,
  validateBrandApprovals,
  validateGlbMetadata,
  validatePosterContract,
  writeManifestAtomically,
} from "../../scripts/assets/validate.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/validation-test-${process.pid}`,
);
const model = {
  animationNames: [],
  key: "fixture",
  maxBytes: 5 * 1024 * 1024,
  minimumAnimations: 0,
  textureMode: "none",
};
const validJson = {
  accessors: [
    { bufferView: 0, count: 3, max: [1, 1, 0], min: [0, 0, 0] },
    { bufferView: 1, count: 3 },
  ],
  animations: [],
  asset: { version: "2.0" },
  bufferViews: [
    { extensions: { EXT_meshopt_compression: {} } },
    { extensions: { EXT_meshopt_compression: {} } },
  ],
  buffers: [{ byteLength: 64 }],
  extensionsRequired: [
    "EXT_meshopt_compression",
    "KHR_mesh_quantization",
  ],
  extensionsUsed: [
    "EXT_meshopt_compression",
    "KHR_mesh_quantization",
  ],
  images: [],
  materials: [],
  meshes: [
    {
      primitives: [
        { attributes: { POSITION: 0 }, indices: 1 },
      ],
    },
  ],
  nodes: [
    { children: [1], name: "WEB_EXPORT_ROOT" },
    { mesh: 0, name: "Mesh" },
  ],
  scene: 0,
  scenes: [{ nodes: [0] }],
};

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

function metadataErrors({
  json = validJson,
  bytes = 1024,
  imagePayloads = [],
  fixtureModel = model,
} = {}) {
  return validateGlbMetadata({
    bytes,
    hardMaxBytes: 25 * 1024 * 1024,
    imagePayloads,
    json,
    model: fixtureModel,
  });
}

test("metadata validation rejects each release-blocking GLB defect", () => {
  assert.deepEqual(metadataErrors(), []);
  const cases = [
    [{ ...validJson, cameras: [{}] }, /cameras/],
    [
      { ...validJson, extensionsUsed: ["KHR_lights_punctual"] },
      /lights/,
    ],
    [
      { ...validJson, images: [{ uri: "screen.png" }] },
      /external URI/,
    ],
    [
      { ...validJson, extensionsRequired: ["KHR_mesh_quantization"] },
      /Meshopt/,
    ],
    [
      { ...validJson, extensionsRequired: ["EXT_meshopt_compression"] },
      /quantization/,
    ],
    [
      { ...validJson, nodes: [{ name: "WrongRoot" }] },
      /WEB_EXPORT_ROOT/,
    ],
  ];
  for (const [json, pattern] of cases) {
    assert.match(metadataErrors({ json }).join("\n"), pattern);
  }

  assert.match(
    metadataErrors({
      json: {
        ...validJson,
        materials: [{ name: "NASA meatball decal" }],
      },
      fixtureModel: {
        ...model,
        forbiddenBrandTerms: ["nasa", "meatball", "worm"],
      },
    }).join("\n"),
    /forbidden brand term/i,
  );
  assert.match(
    metadataErrors({ bytes: model.maxBytes }).join("\n"),
    /preferred budget/,
  );
  assert.match(
    metadataErrors({ bytes: 25 * 1024 * 1024 }).join("\n"),
    /hard limit/,
  );
  assert.match(
    metadataErrors({
      fixtureModel: {
        ...model,
        animationNames: ["ExpectedAction"],
        minimumAnimations: 1,
      },
    }).join("\n"),
    /animation names/,
  );
});

test("metadata validation requires the exact owned WebP allowlist", () => {
  const league = {
    ...model,
    key: "crane-on-league",
    ownedTextures: [
      { name: "LeagueBanDashboard" },
      { name: "LeagueMatchHistory" },
    ],
    textureMode: "webp",
  };
  const json = {
    ...validJson,
    extensionsRequired: [
      ...validJson.extensionsRequired,
      "EXT_texture_webp",
    ],
    extensionsUsed: [
      ...validJson.extensionsUsed,
      "EXT_texture_webp",
    ],
    images: [
      {
        bufferView: 0,
        mimeType: "image/webp",
        name: "LeagueBanDashboard",
      },
      {
        bufferView: 1,
        mimeType: "image/webp",
        name: "LeagueMatchHistory",
      },
    ],
  };
  const payloads = [
    {
      bytes: 10,
      height: 576,
      mimeType: "image/webp",
      name: "LeagueBanDashboard",
      sha256: "a".repeat(64),
      width: 1024,
    },
    {
      bytes: 20,
      height: 576,
      mimeType: "image/webp",
      name: "LeagueMatchHistory",
      sha256: "b".repeat(64),
      width: 1024,
    },
  ];
  assert.deepEqual(
    metadataErrors({ fixtureModel: league, imagePayloads: payloads, json }),
    [],
  );
  assert.match(
    metadataErrors({
      fixtureModel: league,
      imagePayloads: [
        ...payloads,
        {
          bytes: 30,
          height: 576,
          mimeType: "image/webp",
          name: "OfficialChampionArt",
          sha256: "c".repeat(64),
          width: 1024,
        },
      ],
      json: {
        ...json,
        images: [
          ...json.images,
          {
            bufferView: 2,
            mimeType: "image/webp",
            name: "OfficialChampionArt",
          },
        ],
      },
    }).join("\n"),
    /owned image allowlist/,
  );
});

test("brand approvals reject stale source and League texture hashes", () => {
  const provenance = {
    models: {
      "crane-on-league": {
        canonicalSha256: "a".repeat(64),
        generatorInputs: {
          ownedTextures: {
            LeagueBanDashboard: { sha256: "b".repeat(64) },
            LeagueMatchHistory: { sha256: "c".repeat(64) },
          },
        },
      },
      rocket: { canonicalSha256: "d".repeat(64) },
    },
  };
  const approvals = {
    approvals: {
      "league-owned-art": {
        modelKey: "crane-on-league",
        reviewedBy: "Richard Phong",
        reviewedOn: "2026-07-10",
        sourceSha256: "a".repeat(64),
        status: "approved",
        textureSha256: {
          LeagueBanDashboard: "b".repeat(64),
          LeagueMatchHistory: "c".repeat(64),
        },
      },
      "rocket-brand-safety": {
        modelKey: "rocket",
        reviewedBy: "Richard Phong",
        reviewedOn: "2026-07-10",
        sourceSha256: "d".repeat(64),
        status: "approved",
      },
    },
    schemaVersion: 1,
  };
  assert.doesNotThrow(() =>
    validateBrandApprovals({ approvals, provenance }),
  );
  const stale = structuredClone(approvals);
  stale.approvals["league-owned-art"].textureSha256.LeagueBanDashboard =
    "f".repeat(64);
  assert.throws(
    () => validateBrandApprovals({ approvals: stale, provenance }),
    /stale or incomplete/,
  );
});

test("poster contract covers the ten approved scenes and keeps capture optional", async () => {
  const manifest = await loadSourceManifest({ root });
  const contract = JSON.parse(
    await readFile(path.join(root, "assets/poster-contract.json"), "utf8"),
  );
  await validatePosterContract({
    contract,
    manifest,
    requirePosters: false,
    root,
  });
  assert.deepEqual(
    contract.scenes.map((scene) => scene.id),
    [
      "home-hero",
      "experience-hero",
      "experience-intro",
      "nasa-rocket",
      "eog-poster",
      "paycom-poster",
      "projects-hero",
      "league-ban",
      "froggie-adventures",
      "contact-hero",
    ],
  );
  await assert.rejects(
    validatePosterContract({
      contract,
      manifest,
      requirePosters: true,
      root,
    }),
    /Required poster is missing: public\/posters\/home-hero-desktop\.webp/,
  );
  const drifted = structuredClone(contract);
  drifted.scenes[0].source.modelKey = "rocket";
  await assert.rejects(
    validatePosterContract({
      contract: drifted,
      manifest,
      requirePosters: false,
      root,
    }),
    /exact approved contract/,
  );
});

test("poster-only sources are abstract vectors with no company payload", async () => {
  for (const name of ["eog", "paycom"]) {
    const svg = await readFile(
      path.join(root, `assets/poster-sources/${name}.svg`),
      "utf8",
    );
    assert.doesNotMatch(
      svg,
      /<image\b|<text\b|<script\b|<foreignObject\b|\bhref\s*=|\b(?:eog|paycom|logo)\b/i,
    );
  }
});

test("full validation generates stable relative-only runtime metadata", async () => {
  await mkdir(tempRoot, { recursive: true });
  const outputPath = path.join(tempRoot, "assets-manifest.json");
  const generated = await validateAll({
    outputPath,
    requirePosters: false,
    root,
    writeManifest: true,
  });
  await validateAll({ outputPath, requirePosters: false, root });
  const serialized = await readFile(outputPath, "utf8");
  assert.equal(Object.keys(generated.models).length, 7);
  assert.doesNotMatch(serialized, /[A-Za-z]:\\/);
  assert.doesNotMatch(serialized, /timestamp|generatedAt/i);
  assert.doesNotMatch(serialized, /"payload"|"data"/i);
  assert.ok(
    Object.values(generated.models).every((entry) =>
      entry.url.startsWith("/models/"),
    ),
  );
  await writeFile(
    outputPath,
    serialized.replace('"schemaVersion": 1', '"schemaVersion": 999'),
  );
  await assert.rejects(
    validateAll({ outputPath, requirePosters: false, root }),
    /committed model manifest drifted/,
  );
});

test("atomic manifest replacement preserves the previous file on rename failure", async () => {
  await mkdir(tempRoot, { recursive: true });
  const outputPath = path.join(tempRoot, "assets-manifest.json");
  await writeFile(outputPath, "previous-manifest\n");
  await assert.rejects(
    writeManifestAtomically(outputPath, "candidate-manifest\n", {
      operationId: "rename-failure",
      renameFile: async () => {
        throw new Error("injected manifest rename failure");
      },
    }),
    /injected manifest rename failure/,
  );
  assert.equal(await readFile(outputPath, "utf8"), "previous-manifest\n");
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) => name.endsWith(".next")),
    [],
  );
});
