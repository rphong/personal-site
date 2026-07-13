import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  renderSourceTextures,
  stageSourceTextures,
} from "../../scripts/assets/render-source-textures.mjs";
import { resolveBlenderBin, runBlenderScript } from "../../scripts/assets/lib/blender.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  prepareAll,
  writeSourceProvenance,
} from "../../scripts/assets/prepare-all.mjs";
import { buildBrandApproval } from "../../scripts/assets/record-brand-approval.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/source-preparation-test-${process.pid}`,
);

const leagueWebGroundCleanup = {
  mesh: "Plane.001",
  object: "Shadow Catcher",
  policy: "remove-authored-shadow-catcher-v1",
  shadowStrategy: "transparent-canvas-contact-shadow-v1",
  version: 1,
};
const leagueStaticCranePose = {
  frame: 48,
  policy: "bake-skinned-mesh-pose-v1",
  version: 1,
};

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("source textures render to fixed dimensions without third-party raster inputs", async () => {
  await renderSourceTextures({ root });
  const expected = [
    ["assets/blender/textures/league-ban-dashboard.png", 1024, 576],
    ["assets/blender/textures/league-match-history.png", 1024, 576],
    ["assets/blender/textures/froggie-gameplay-screen.png", 1600, 900],
  ];

  for (const [relativePath, width, height] of expected) {
    const metadata = await sharp(path.join(root, relativePath)).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.equal(metadata.format, "png");
  }

  const dashboardSvg = await readFile(path.join(root, "assets/blender/textures/league-ban-dashboard.svg"), "utf8");
  const historySvg = await readFile(path.join(root, "assets/blender/textures/league-match-history.svg"), "utf8");
  assert.doesNotMatch(`${dashboardSvg}${historySvg}`, /riot|champion|item|logo/i);
  assert.doesNotMatch(`${dashboardSvg}${historySvg}`, /<image\b/i);
});

async function createTextureFixture(name) {
  const fixtureRoot = path.join(tempRoot, name);
  await mkdir(path.join(fixtureRoot, "assets/blender/textures"), {
    recursive: true,
  });
  await mkdir(path.join(fixtureRoot, "ReferenceImages"), { recursive: true });
  await copyFile(
    path.join(root, "assets/scene-sources.json"),
    path.join(fixtureRoot, "assets/scene-sources.json"),
  );
  for (const fileName of [
    "league-ban-dashboard.svg",
    "league-match-history.svg",
  ]) {
    await copyFile(
      path.join(root, "assets/blender/textures", fileName),
      path.join(fixtureRoot, "assets/blender/textures", fileName),
    );
  }
  await copyFile(
    path.join(root, "ReferenceImages/Froggie Gameplay.png"),
    path.join(fixtureRoot, "ReferenceImages/Froggie Gameplay.png"),
  );
  const sentinels = new Map();
  for (const relativePath of [
    "assets/blender/textures/league-ban-dashboard.png",
    "assets/blender/textures/league-match-history.png",
    "assets/blender/textures/froggie-gameplay-screen.png",
  ]) {
    const contents = Buffer.from(`sentinel:${relativePath}`);
    await writeFile(path.join(fixtureRoot, relativePath), contents);
    sentinels.set(relativePath, contents);
  }
  return { fixtureRoot, sentinels };
}

async function assertTextureOutputsUnchanged(fixtureRoot, sentinels) {
  for (const [relativePath, contents] of sentinels) {
    assert.deepEqual(await readFile(path.join(fixtureRoot, relativePath)), contents);
  }
  const textureFiles = await readdir(
    path.join(fixtureRoot, "assets/blender/textures"),
  );
  assert.deepEqual(
    textureFiles.filter((name) => /\.next\.|\.backup$/.test(name)),
    [],
  );
}

test("source texture validation cannot partially replace existing outputs", async () => {
  for (const name of ["league-ban-dashboard", "league-match-history"]) {
    const invalidSvg = await createTextureFixture(`invalid-${name}`);
    await writeFile(
      path.join(
        invalidSvg.fixtureRoot,
        `assets/blender/textures/${name}.svg`,
      ),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Riot logo</text></svg>',
    );
    await assert.rejects(
      renderSourceTextures({ root: invalidSvg.fixtureRoot }),
      new RegExp(`${name}\\.svg.*policy`, "i"),
    );
    await assertTextureOutputsUnchanged(
      invalidSvg.fixtureRoot,
      invalidSvg.sentinels,
    );
  }

  const invalidFroggie = await createTextureFixture("invalid-froggie");
  await writeFile(
    path.join(invalidFroggie.fixtureRoot, "ReferenceImages/Froggie Gameplay.png"),
    "drifted-capture",
  );
  await assert.rejects(
    renderSourceTextures({ root: invalidFroggie.fixtureRoot }),
    /Froggie gameplay reference.*bytes\/SHA-256/i,
  );
  await assertTextureOutputsUnchanged(
    invalidFroggie.fixtureRoot,
    invalidFroggie.sentinels,
  );
});

test("staged source textures do not mutate canonical outputs and direct rendering stays idempotent", async () => {
  const fixture = await createTextureFixture("staged-and-direct");
  const staged = await stageSourceTextures({ root: fixture.fixtureRoot });
  try {
    for (const [relativePath, contents] of fixture.sentinels) {
      assert.deepEqual(
        await readFile(path.join(fixture.fixtureRoot, relativePath)),
        contents,
      );
    }
    for (const candidate of staged.candidates) {
      await access(candidate.candidatePath);
      assert.notEqual(
        await sha256File(candidate.candidatePath),
        await sha256File(candidate.outputPath),
      );
    }
  } finally {
    await staged.cleanup();
  }
  await assertTextureOutputsUnchanged(
    fixture.fixtureRoot,
    fixture.sentinels,
  );

  for (const relativePath of fixture.sentinels.keys()) {
    await rm(path.join(fixture.fixtureRoot, relativePath), { force: true });
  }
  const first = await renderSourceTextures({ root: fixture.fixtureRoot });
  const firstBytes = new Map();
  for (const relativePath of fixture.sentinels.keys()) {
    firstBytes.set(
      relativePath,
      await readFile(path.join(fixture.fixtureRoot, relativePath)),
    );
  }
  const second = await renderSourceTextures({ root: fixture.fixtureRoot });
  assert.deepEqual(second, first);
  for (const [relativePath, contents] of firstBytes) {
    assert.deepEqual(
      await readFile(path.join(fixture.fixtureRoot, relativePath)),
      contents,
    );
  }
  const textureFiles = await readdir(
    path.join(fixture.fixtureRoot, "assets/blender/textures"),
  );
  assert.deepEqual(
    textureFiles.filter((name) => /\.next\.|\.backup$/.test(name)),
    [],
  );
});

test("changed League SVG fails unrelated replacement validation without mutating artifacts", async () => {
  const fixture = await createTextureFixture("unrelated-league-drift");
  const leagueSource = path.join(
    fixture.fixtureRoot,
    "assets/blender/CraneOnLeague.blend",
  );
  const craneSource = path.join(
    fixture.fixtureRoot,
    "assets/blender/Crane.blend",
  );
  await Promise.all([
    writeFile(leagueSource, "reviewed-league-source"),
    writeFile(craneSource, "reviewed-crane-source"),
  ]);
  const manifest = {
    models: [
      {
        key: "crane",
        source: "assets/blender/Crane.blend",
        origin: { sha256: "a".repeat(64) },
        ownedTextures: [],
      },
      {
        key: "crane-on-league",
        source: "assets/blender/CraneOnLeague.blend",
        origin: { sha256: "b".repeat(64) },
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
    ],
  };
  const provenance = {
    schemaVersion: 1,
    models: {
      crane: {
        canonicalSha256: await sha256File(craneSource),
        originalSha256: "a".repeat(64),
        source: "assets/blender/Crane.blend",
      },
      "crane-on-league": {
        canonicalSha256: await sha256File(leagueSource),
        originalSha256: "b".repeat(64),
        source: "assets/blender/CraneOnLeague.blend",
        generatorInputs: {
          ownedTextures: {
            LeagueBanDashboard: {
              bytes: fixture.sentinels.get(
                "assets/blender/textures/league-ban-dashboard.png",
              ).length,
              path: "assets/blender/textures/league-ban-dashboard.png",
              sha256: await sha256File(path.join(
                fixture.fixtureRoot,
                "assets/blender/textures/league-ban-dashboard.png",
              )),
            },
            LeagueMatchHistory: {
              bytes: fixture.sentinels.get(
                "assets/blender/textures/league-match-history.png",
              ).length,
              path: "assets/blender/textures/league-match-history.png",
              sha256: await sha256File(path.join(
                fixture.fixtureRoot,
                "assets/blender/textures/league-match-history.png",
              )),
            },
          },
          staticCranePose: leagueStaticCranePose,
          webGroundCleanup: leagueWebGroundCleanup,
        },
      },
    },
  };
  await writeFile(
    path.join(
      fixture.fixtureRoot,
      "assets/blender/textures/league-ban-dashboard.svg",
    ),
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#123456"/></svg>',
  );
  const provenancePath = path.join(
    fixture.fixtureRoot,
    "assets/blender/source-provenance.json",
  );
  await writeFile(provenancePath, JSON.stringify(provenance));
  const before = new Map([
    [leagueSource, await readFile(leagueSource)],
    [craneSource, await readFile(craneSource)],
    [provenancePath, await readFile(provenancePath)],
  ]);
  for (const [relativePath] of fixture.sentinels) {
    before.set(
      path.join(fixture.fixtureRoot, relativePath),
      await readFile(path.join(fixture.fixtureRoot, relativePath)),
    );
  }
  let blenderCalled = false;
  await assert.rejects(
    prepareAll(
      { root: fixture.fixtureRoot, only: "crane", replace: true },
      {
        preflight: async () => ({
          blenderBin: "fixture-blender",
          manifest,
        }),
        blenderRunner: () => {
          blenderCalled = true;
        },
      },
    ),
    /crane-on-league: staged generator inputs drifted/,
  );
  assert.equal(blenderCalled, false);
  for (const [filePath, contents] of before) {
    assert.deepEqual(await readFile(filePath), contents);
  }
  await assertTextureOutputsUnchanged(
    fixture.fixtureRoot,
    fixture.sentinels,
  );
});

async function createPrepareAllFixture(name) {
  const fixture = await createTextureFixture(name);
  const source = "assets/blender/CraneOnLeague.blend";
  const sourcePath = path.join(fixture.fixtureRoot, source);
  await writeFile(sourcePath, "reviewed-league-source");
  const model = {
    key: "crane-on-league",
    source,
    origin: { sha256: "b".repeat(64) },
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
  };
  const ownedTextures = {};
  for (const texture of model.ownedTextures) {
    const texturePath = path.join(fixture.fixtureRoot, texture.source);
    ownedTextures[texture.name] = {
      bytes: (await readFile(texturePath)).length,
      path: texture.source,
      sha256: await sha256File(texturePath),
    };
  }
  const provenancePath = path.join(
    fixture.fixtureRoot,
    "assets/blender/source-provenance.json",
  );
  await writeFile(
    provenancePath,
    JSON.stringify({
      schemaVersion: 1,
      models: {
        "crane-on-league": {
          canonicalSha256: await sha256File(sourcePath),
          originalSha256: model.origin.sha256,
          source,
          generatorInputs: {
            ownedTextures,
            staticCranePose: leagueStaticCranePose,
            webGroundCleanup: leagueWebGroundCleanup,
          },
        },
      },
    }),
  );
  const manifest = { models: [model] };
  const preflight = async () => ({ blenderBin: "fixture-blender", manifest });
  return {
    ...fixture,
    manifest,
    model,
    preflight,
    provenancePath,
    sourcePath,
  };
}

async function snapshotPrepareAllFixture(fixture) {
  const files = [
    fixture.sourcePath,
    fixture.provenancePath,
    ...[...fixture.sentinels.keys()].map((relativePath) =>
      path.join(fixture.fixtureRoot, relativePath)),
  ];
  return new Map(
    await Promise.all(
      files.map(async (filePath) => [filePath, await readFile(filePath)]),
    ),
  );
}

async function assertPrepareAllFixtureMatches(snapshot) {
  for (const [filePath, contents] of snapshot) {
    assert.deepEqual(await readFile(filePath), contents);
  }
}

function deterministicLeagueRunner({ scriptArgs }) {
  assert.ok(scriptArgs.includes("--remove-web-ground"));
  assert.equal(
    scriptArgs[scriptArgs.indexOf("--static-crane-pose-frame") + 1],
    "48",
  );
  const destination = scriptArgs[scriptArgs.indexOf("--destination") + 1];
  const dashboard = scriptArgs[scriptArgs.indexOf("--league-dashboard") + 1];
  const history = scriptArgs[scriptArgs.indexOf("--league-history") + 1];
  assert.match(path.basename(dashboard), /^\.league-ban-dashboard\..*\.next\.png$/);
  assert.match(path.basename(history), /^\.league-match-history\..*\.next\.png$/);
  writeFileSync(destination, "curated-league-source");
}

test("unrelated replacement cannot silently heal a drifted canonical League PNG", async () => {
  const fixture = await createPrepareAllFixture("canonical-league-drift");
  await renderSourceTextures({ root: fixture.fixtureRoot });
  const provenance = JSON.parse(
    await readFile(fixture.provenancePath, "utf8"),
  );
  for (const texture of fixture.model.ownedTextures) {
    const texturePath = path.join(fixture.fixtureRoot, texture.source);
    provenance.models[fixture.model.key].generatorInputs.ownedTextures[
      texture.name
    ] = {
      bytes: (await readFile(texturePath)).length,
      path: texture.source,
      sha256: await sha256File(texturePath),
    };
  }
  const craneModel = {
    key: "crane",
    source: "assets/blender/Crane.blend",
    origin: { sha256: "a".repeat(64) },
    ownedTextures: [],
  };
  const craneSource = path.join(fixture.fixtureRoot, craneModel.source);
  await writeFile(craneSource, "reviewed-crane-source");
  provenance.models.crane = {
    canonicalSha256: await sha256File(craneSource),
    originalSha256: craneModel.origin.sha256,
    source: craneModel.source,
  };
  fixture.manifest.models.unshift(craneModel);
  await writeFile(fixture.provenancePath, JSON.stringify(provenance));
  await writeFile(
    path.join(
      fixture.fixtureRoot,
      "assets/blender/textures/league-ban-dashboard.png",
    ),
    "corrupted-canonical-texture",
  );
  const before = await snapshotPrepareAllFixture(fixture);
  before.set(craneSource, await readFile(craneSource));
  let blenderCalled = false;

  await assert.rejects(
    prepareAll(
      { root: fixture.fixtureRoot, only: craneModel.key, replace: true },
      {
        preflight: fixture.preflight,
        blenderRunner: () => {
          blenderCalled = true;
        },
      },
    ),
    /crane-on-league: reviewed generator inputs drifted/,
  );

  assert.equal(blenderCalled, false);
  await assertPrepareAllFixtureMatches(before);
  const textureFiles = await readdir(
    path.join(fixture.fixtureRoot, "assets/blender/textures"),
  );
  assert.deepEqual(
    textureFiles.filter((name) => /\.next\.|\.backup$/.test(name)),
    [],
  );
});

test("prepareAll leaves textures, source, and provenance unchanged on Blender or provenance failure", async () => {
  let fixture = await createPrepareAllFixture("prepare-blender-failure");
  let before = await snapshotPrepareAllFixture(fixture);
  await assert.rejects(
    prepareAll(
      { root: fixture.fixtureRoot, only: fixture.model.key, replace: true },
      {
        preflight: fixture.preflight,
        blenderRunner: () => {
          throw new Error("injected League Blender failure");
        },
      },
    ),
    /injected League Blender failure/,
  );
  await assertPrepareAllFixtureMatches(before);
  await assertTextureOutputsUnchanged(
    fixture.fixtureRoot,
    fixture.sentinels,
  );

  fixture = await createPrepareAllFixture("prepare-provenance-failure");
  before = await snapshotPrepareAllFixture(fixture);
  await assert.rejects(
    prepareAll(
      { root: fixture.fixtureRoot, only: fixture.model.key, replace: true },
      {
        preflight: fixture.preflight,
        blenderRunner: deterministicLeagueRunner,
        provenanceWriter: async () => {
          assert.equal(
            await readFile(fixture.sourcePath, "utf8"),
            "curated-league-source",
          );
          assert.notDeepEqual(
            await readFile(path.join(
              fixture.fixtureRoot,
              "assets/blender/textures/league-ban-dashboard.png",
            )),
            fixture.sentinels.get(
              "assets/blender/textures/league-ban-dashboard.png",
            ),
          );
          throw new Error("injected League provenance failure");
        },
      },
    ),
    /injected League provenance failure/,
  );
  await assertPrepareAllFixtureMatches(before);
  await assertTextureOutputsUnchanged(
    fixture.fixtureRoot,
    fixture.sentinels,
  );
});

test("prepareAll promotes source, textures, and provenance idempotently", async () => {
  const fixture = await createPrepareAllFixture("prepare-success");
  const options = {
    root: fixture.fixtureRoot,
    only: fixture.model.key,
    replace: true,
  };
  const dependencies = {
    preflight: fixture.preflight,
    blenderRunner: deterministicLeagueRunner,
  };
  await prepareAll(options, dependencies);
  const first = await snapshotPrepareAllFixture(fixture);
  const firstProvenance = JSON.parse(
    await readFile(fixture.provenancePath, "utf8"),
  );
  for (const texture of fixture.model.ownedTextures) {
    assert.equal(
      firstProvenance.models[fixture.model.key].generatorInputs.ownedTextures[
        texture.name
      ].path,
      texture.source,
    );
  }

  await prepareAll(options, dependencies);
  await assertPrepareAllFixtureMatches(first);
  const textureFiles = await readdir(
    path.join(fixture.fixtureRoot, "assets/blender/textures"),
  );
  assert.deepEqual(
    textureFiles.filter((name) => /\.next\.|\.backup$/.test(name)),
    [],
  );
});

test("League curation replaces broken and canonical packed images, then creates one export root", async () => {
  await renderSourceTextures({ root });
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "CraneOnLeague-input.blend");
  const output = path.join(tempRoot, "CraneOnLeague-curated.blend");
  const report = path.join(tempRoot, "report.json");
  await copyFile(path.join(root, "assets/blender/CraneOnLeague.blend"), input);

  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", output,
      "--league-dashboard", path.join(root, "assets/blender/textures/league-ban-dashboard.png"),
      "--league-history", path.join(root, "assets/blender/textures/league-match-history.png"),
    ],
    cwd: root,
  });
  runBlenderScript({
    blenderBin,
    blendFile: output,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", report],
    cwd: root,
  });

  const inspection = JSON.parse(await readFile(report, "utf8"));
  assert.equal(inspection.rootCount, 1);
  assert.deepEqual(inspection.rootTransform, {
    location: [0, 0, 0],
    rotationEuler: [0, 0, 0],
    scale: [1, 1, 1],
  });
  const expectedPackedImages = {
    LeagueBanDashboard: await sha256File(
      path.join(root, "assets/blender/textures/league-ban-dashboard.png"),
    ),
    LeagueMatchHistory: await sha256File(
      path.join(root, "assets/blender/textures/league-match-history.png"),
    ),
  };
  assert.deepEqual(inspection.packedImages, Object.keys(expectedPackedImages));
  assert.deepEqual(inspection.packedImageSha256, expectedPackedImages);
  assert.deepEqual(inspection.fileImages, [
    {
      filepath: "//textures/league-ban-dashboard.png",
      name: "LeagueBanDashboard",
      packed: true,
      source: "FILE",
    },
    {
      filepath: "//textures/league-match-history.png",
      name: "LeagueMatchHistory",
      packed: true,
      source: "FILE",
    },
  ]);
  assert.deepEqual(inspection.nonFileImages, []);
  assert.deepEqual(inspection.externalResources, []);
  assert.deepEqual(inspection.particleSystems, []);
  assert.deepEqual(inspection.volumeObjects, []);
  assert.ok(inspection.objects.length > 1);

  const replacementDashboard = path.join(
    tempRoot,
    ".league-ban-dashboard.staged.next.png",
  );
  const replacementHistory = path.join(
    tempRoot,
    ".league-match-history.staged.next.png",
  );
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#135946" },
  }).png().toFile(replacementDashboard);
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#4b2e7e" },
  }).png().toFile(replacementHistory);
  const replacementOutput = path.join(tempRoot, "CraneOnLeague-replaced.blend");
  const replacementReport = path.join(tempRoot, "replacement-report.json");
  runBlenderScript({
    blenderBin,
    blendFile: output,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", replacementOutput,
      "--league-dashboard", replacementDashboard,
      "--league-history", replacementHistory,
    ],
    cwd: root,
  });
  runBlenderScript({
    blenderBin,
    blendFile: replacementOutput,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", replacementReport],
    cwd: root,
  });
  const replacementInspection = JSON.parse(
    await readFile(replacementReport, "utf8"),
  );
  const replacementHashes = {
    LeagueBanDashboard: await sha256File(replacementDashboard),
    LeagueMatchHistory: await sha256File(replacementHistory),
  };
  assert.deepEqual(replacementInspection.packedImageSha256, replacementHashes);
  assert.deepEqual(replacementInspection.fileImages, inspection.fileImages);
  for (const image of replacementInspection.fileImages) {
    assert.ok(image.filepath.startsWith("//textures/"));
    assert.ok(!image.filepath.includes(root.replaceAll("\\", "/")));
  }
  assert.notDeepEqual(
    replacementInspection.packedImageSha256,
    inspection.packedImageSha256,
  );
});

test("League curation rejects a referenced non-FILE image", async () => {
  await renderSourceTextures({ root });
  const blenderBin = resolveBlenderBin({ root });
  const contaminated = path.join(tempRoot, "CraneOnLeague-generated-image.blend");
  const rejectedOutput = path.join(tempRoot, "CraneOnLeague-should-not-exist.blend");
  const fixtureScript = path.join(tempRoot, "add_generated_image.py");
  const report = path.join(tempRoot, "generated-image-report.json");
  await writeFile(
    fixtureScript,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nimage = bpy.data.images.new("UnexpectedGenerated", width=4, height=4)\nmaterial = bpy.data.materials.new("UnexpectedGeneratedMaterial")\nmaterial.use_nodes = True\ntexture = material.node_tree.nodes.new("ShaderNodeTexImage")\ntexture.image = image\nmesh = next(obj for obj in bpy.data.objects if obj.type == "MESH")\nmesh.data.materials.append(material)\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: path.join(root, "assets/blender/CraneOnLeague.blend"),
    script: fixtureScript,
    scriptArgs: ["--destination", contaminated],
    cwd: root,
  });
  runBlenderScript({
    blenderBin,
    blendFile: contaminated,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", report],
    cwd: root,
  });
  const contaminatedInspection = JSON.parse(await readFile(report, "utf8"));
  assert.deepEqual(contaminatedInspection.nonFileImages, [
    {
      name: "UnexpectedGenerated",
      source: "GENERATED",
      users: 1,
    },
  ]);

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: contaminated,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs: [
          "--destination", rejectedOutput,
          "--league-dashboard", path.join(
            root,
            "assets/blender/textures/league-ban-dashboard.png",
          ),
          "--league-history", path.join(
            root,
            "assets/blender/textures/league-match-history.png",
          ),
        ],
        cwd: root,
      }),
    /non-FILE image.*UnexpectedGenerated.*GENERATED.*users=1/i,
  );
  await assert.rejects(access(rejectedOutput), { code: "ENOENT" });
});

test("Rocket source names expose no official NASA brand assets", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const report = path.join(tempRoot, "rocket-report.json");
  runBlenderScript({
    blenderBin,
    blendFile: path.join(root, "assets/blender/Rocket.blend"),
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", report],
    cwd: root,
  });

  const inspection = JSON.parse(await readFile(report, "utf8"));
  const namedAssets = [
    ...inspection.objects,
    ...inspection.packedImages,
    ...inspection.imageNames,
    ...inspection.textureNames,
    ...inspection.materialNames,
  ].join("\n");
  assert.doesNotMatch(namedAssets, /nasa|meatball|worm/i);
  assert.deepEqual(inspection.externalResources, []);
});

test("provenance updates only authorized keys and rejects unrelated drift", async () => {
  const fixtureRoot = path.join(tempRoot, "provenance");
  await mkdir(path.join(fixtureRoot, "assets/blender"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "assets/blender/Reviewed.blend"), "reviewed-v1");
  await writeFile(path.join(fixtureRoot, "assets/blender/Updated.blend"), "updated-v1");
  const manifest = {
    models: [
      {
        key: "reviewed",
        source: "assets/blender/Reviewed.blend",
        origin: { sha256: "a".repeat(64) },
        ownedTextures: [],
      },
      {
        key: "updated",
        source: "assets/blender/Updated.blend",
        origin: { sha256: "b".repeat(64) },
        ownedTextures: [],
      },
    ],
  };

  await writeSourceProvenance({
    root: fixtureRoot,
    manifest,
    updateKeys: ["reviewed", "updated"],
  });
  const before = JSON.parse(
    await readFile(
      path.join(fixtureRoot, "assets/blender/source-provenance.json"),
      "utf8",
    ),
  );

  await writeFile(path.join(fixtureRoot, "assets/blender/Updated.blend"), "updated-v2");
  await writeSourceProvenance({
    root: fixtureRoot,
    manifest,
    updateKeys: ["updated"],
  });
  const after = JSON.parse(
    await readFile(
      path.join(fixtureRoot, "assets/blender/source-provenance.json"),
      "utf8",
    ),
  );
  assert.deepEqual(after.models.reviewed, before.models.reviewed);
  assert.notEqual(
    after.models.updated.canonicalSha256,
    before.models.updated.canonicalSha256,
  );
  await assert.rejects(
    assertReviewedSourcesUnchanged({
      root: fixtureRoot,
      manifest,
      provenance: {
        ...after,
        models: { updated: after.models.updated },
      },
      ignoreKeys: ["updated"],
    }),
    /reviewed source provenance is missing/,
  );

  await writeFile(path.join(fixtureRoot, "assets/blender/Reviewed.blend"), "unreviewed-drift");
  await assert.rejects(
    writeSourceProvenance({
      root: fixtureRoot,
      manifest,
      updateKeys: ["updated"],
    }),
    /reviewed source drifted/,
  );
  await assert.rejects(
    assertReviewedSourcesUnchanged({
      root: fixtureRoot,
      manifest,
      provenance: after,
      ignoreKeys: ["updated"],
    }),
    /reviewed source drifted/,
  );
});

test("brand approval records bind the reviewed source and exact owned textures", () => {
  const approval = buildBrandApproval({
    key: "league-owned-art",
    reviewedBy: "Richard Phong",
    reviewedOn: "2026-07-09",
    provenance: {
      models: {
        "crane-on-league": {
          canonicalSha256: "c".repeat(64),
          generatorInputs: {
            ownedTextures: {
              LeagueBanDashboard: {
                path: "assets/blender/textures/league-ban-dashboard.png",
                sha256: "d".repeat(64),
              },
              LeagueMatchHistory: {
                path: "assets/blender/textures/league-match-history.png",
                sha256: "e".repeat(64),
              },
            },
          },
        },
      },
    },
  });

  assert.deepEqual(approval, {
    modelKey: "crane-on-league",
    reviewedBy: "Richard Phong",
    reviewedOn: "2026-07-09",
    sourceSha256: "c".repeat(64),
    status: "approved",
    textureSha256: {
      LeagueBanDashboard: "d".repeat(64),
      LeagueMatchHistory: "e".repeat(64),
    },
  });
});
