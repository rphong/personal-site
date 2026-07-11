import assert from "node:assert/strict";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  resolveBlenderBin,
  runBlenderScript,
} from "../../scripts/assets/lib/blender.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/league-source-curation-test-${process.pid}`,
);
const fixtureScript = path.join(
  root,
  "tests/assets/fixtures/league_legacy_fixture.py",
);
const prepareScript = path.join(
  root,
  "scripts/assets/blender/prepare_source.py",
);
const inspectScript = path.join(
  root,
  "scripts/assets/blender/inspect_scene.py",
);

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function createOwnedTextures() {
  const dashboard = path.join(tempRoot, "owned-dashboard.png");
  const history = path.join(tempRoot, "owned-history.png");
  await Promise.all([
    sharp({
      create: {
        width: 16,
        height: 9,
        channels: 4,
        background: "#135946",
      },
    }).png().toFile(dashboard),
    sharp({
      create: {
        width: 16,
        height: 9,
        channels: 4,
        background: "#4b2e7e",
      },
    }).png().toFile(history),
  ]);
  return { dashboard, history };
}

async function createFixture(blenderBin, destination, { leftover = false } = {}) {
  const scriptArgs = ["--destination", destination];
  if (leftover) scriptArgs.push("--include-leftover");
  runBlenderScript({
    blenderBin,
    script: fixtureScript,
    scriptArgs,
    cwd: root,
  });
}

async function inspectScene(blenderBin, blendFile, name) {
  const report = path.join(tempRoot, `${name}-scene.json`);
  runBlenderScript({
    blenderBin,
    blendFile,
    script: inspectScript,
    scriptArgs: ["--report", report],
    cwd: root,
  });
  return JSON.parse(await readFile(report, "utf8"));
}

async function inspectFixture(blenderBin, blendFile, name) {
  const report = path.join(tempRoot, `${name}-fixture.json`);
  runBlenderScript({
    blenderBin,
    blendFile,
    script: fixtureScript,
    scriptArgs: ["--report", report],
    cwd: root,
  });
  return JSON.parse(await readFile(report, "utf8"));
}

test("League legacy aliases and duplicate Mint users remap to owned packed images", async () => {
  await mkdir(tempRoot, { recursive: true });
  const blenderBin = resolveBlenderBin({ root });
  const legacy = path.join(tempRoot, "League-legacy.blend");
  const curated = path.join(tempRoot, "League-curated.blend");
  const owned = await createOwnedTextures();

  await createFixture(blenderBin, legacy);
  const before = await inspectFixture(blenderBin, legacy, "before");
  assert.deepEqual(before.fileImages, ["ban site", "mint", "mint.001"]);
  assert.deepEqual(before.materialImages, {
    DashboardScreenMaterial: ["ban site"],
    MatchHistoryDuplicateMaterial: ["mint.001"],
    MatchHistoryPrimaryMaterial: ["mint"],
  });
  assert.deepEqual(before.imageUsers, {
    "ban site": 1,
    mint: 1,
    "mint.001": 1,
  });
  assert.deepEqual(before.packedImages, ["ban site", "mint", "mint.001"]);

  runBlenderScript({
    blenderBin,
    blendFile: legacy,
    script: prepareScript,
    scriptArgs: [
      "--destination",
      curated,
      "--league-dashboard",
      owned.dashboard,
      "--league-history",
      owned.history,
    ],
    cwd: root,
  });

  const [scene, after] = await Promise.all([
    inspectScene(blenderBin, curated, "curated"),
    inspectFixture(blenderBin, curated, "curated"),
  ]);
  const expectedHashes = {
    LeagueBanDashboard: await sha256File(owned.dashboard),
    LeagueMatchHistory: await sha256File(owned.history),
  };
  assert.deepEqual(scene.imageNames, [
    "LeagueBanDashboard",
    "LeagueMatchHistory",
  ]);
  assert.deepEqual(scene.packedImages, Object.keys(expectedHashes));
  assert.deepEqual(scene.packedImageSha256, expectedHashes);
  assert.deepEqual(scene.externalResources, []);
  assert.deepEqual(scene.nonFileImages, []);
  assert.deepEqual(scene.shadowCatchers, []);
  assert.deepEqual(after.materialImages, {
    DashboardScreenMaterial: ["LeagueBanDashboard"],
    MatchHistoryDuplicateMaterial: ["LeagueMatchHistory"],
    MatchHistoryPrimaryMaterial: ["LeagueMatchHistory"],
  });
  assert.deepEqual(after.imageUsers, {
    LeagueBanDashboard: 1,
    LeagueMatchHistory: 2,
  });
  assert.deepEqual(after.fileImages, Object.keys(expectedHashes));
  assert.doesNotMatch(JSON.stringify(after), /ban site|\bmint(?:\.001)?\b/i);
});

test("League curation rejects a referenced packed FILE image outside the alias allowlist", async () => {
  await mkdir(tempRoot, { recursive: true });
  const blenderBin = resolveBlenderBin({ root });
  const legacy = path.join(tempRoot, "League-leftover.blend");
  const rejected = path.join(tempRoot, "League-should-not-exist.blend");
  const owned = await createOwnedTextures();

  await createFixture(blenderBin, legacy, { leftover: true });
  const before = await inspectFixture(blenderBin, legacy, "leftover");
  assert.deepEqual(before.materialImages.LeftoverScreenMaterial, [
    "unowned-leftover",
  ]);
  assert.ok(before.packedImages.includes("unowned-leftover"));

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: legacy,
        script: prepareScript,
        scriptArgs: [
          "--destination",
          rejected,
          "--league-dashboard",
          owned.dashboard,
          "--league-history",
          owned.history,
        ],
        cwd: root,
      }),
    /non-allowlisted raster images.*unowned-leftover/i,
  );
  await assert.rejects(access(rejected), { code: "ENOENT" });
});
