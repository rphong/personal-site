import assert from "node:assert/strict";
import {
  access,
  appendFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { exportAll } from "../../scripts/assets/export-all.mjs";
import {
  readGlbImagePayloads,
  readGlbJson,
} from "../../scripts/assets/lib/glb.mjs";
import { optimizeAll } from "../../scripts/assets/optimize.mjs";
import { promoteCandidateArtifacts } from "../../scripts/assets/prepare-all.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/optimization-test-${process.pid}`,
);

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function exportModel(key, rawRoot, reportRoot) {
  await exportAll({ root, only: key, rawRoot, reportRoot });
}

async function assertOptimizedExtensions(json, { textured }) {
  for (const extension of [
    "EXT_meshopt_compression",
    "KHR_mesh_quantization",
  ]) {
    assert.ok(json.extensionsUsed.includes(extension));
    assert.ok(json.extensionsRequired.includes(extension));
  }
  if (textured) {
    assert.ok(json.extensionsUsed.includes("EXT_texture_webp"));
    assert.ok(json.extensionsRequired.includes("EXT_texture_webp"));
  } else {
    assert.ok(!json.extensionsUsed.includes("EXT_texture_webp"));
    assert.ok(!json.extensionsRequired.includes("EXT_texture_webp"));
  }
  for (const forbidden of [
    "KHR_draco_mesh_compression",
    "KHR_texture_basisu",
    "EXT_texture_avif",
  ]) {
    assert.ok(!json.extensionsUsed.includes(forbidden));
    assert.ok(!json.extensionsRequired.includes(forbidden));
  }
}

test("League and Froggie publish bounded WebP with Meshopt and unchanged scene semantics", async () => {
  const rawRoot = path.join(tempRoot, "raw");
  const reportRoot = path.join(tempRoot, "reports");
  const outputRoot = path.join(tempRoot, "published");
  await exportModel("crane-on-league", rawRoot, reportRoot);
  await exportModel("froggie-display", rawRoot, reportRoot);

  const records = [];
  for (const key of ["crane-on-league", "froggie-display"]) {
    const [record] = await optimizeAll({
      root,
      only: key,
      rawRoot,
      reportRoot,
      outputRoot,
    });
    records.push(record);
  }

  for (const record of records) {
    const [bytes, json] = await Promise.all([
      readFile(record.outputPath),
      readGlbJson(record.outputPath),
    ]);
    await assertOptimizedExtensions(json, { textured: true });
    assert.deepEqual(record.optimizedMetrics, record.rawMetrics);
    assert.deepEqual(
      record.optimizedAnimations,
      record.rawAnimations,
    );

    const payloads = readGlbImagePayloads(bytes, json);
    const expectedNames =
      record.key === "crane-on-league"
        ? ["LeagueBanDashboard", "LeagueMatchHistory"]
        : ["FroggieGameplay"];
    assert.deepEqual(
      payloads.map((payload) => payload.name),
      expectedNames,
    );
    for (const payload of payloads) {
      assert.equal(payload.mimeType, "image/webp");
      assert.ok(payload.byteLength > 0);
      assert.equal(payload.bytes, payload.byteLength);
      assert.match(payload.sha256, /^[a-f0-9]{64}$/);
      const metadata = await sharp(payload.payload).metadata();
      assert.deepEqual(
        { format: metadata.format, width: metadata.width, height: metadata.height },
        { format: "webp", width: 1024, height: 576 },
      );
    }
    assert.ok(record.bytes > 0);
  }
});

test("texture-free optimization requires Meshopt without introducing image extensions", async () => {
  const rawRoot = path.join(tempRoot, "raw");
  const reportRoot = path.join(tempRoot, "reports");
  const outputRoot = path.join(tempRoot, "published");
  await exportModel("crane", rawRoot, reportRoot);
  const [record] = await optimizeAll({
    root,
    only: "crane",
    rawRoot,
    reportRoot,
    outputRoot,
  });
  const json = await readGlbJson(record.outputPath);
  await assertOptimizedExtensions(json, { textured: false });
  assert.deepEqual(json.images ?? [], []);
  assert.deepEqual(record.optimizedMetrics, record.rawMetrics);
});

test("a tampered raw input cannot replace an existing published model", async () => {
  const rawRoot = path.join(tempRoot, "raw");
  const reportRoot = path.join(tempRoot, "reports");
  const outputRoot = path.join(tempRoot, "published");
  await exportModel("crane", rawRoot, reportRoot);
  await mkdir(outputRoot, { recursive: true });
  const published = path.join(outputRoot, "crane.glb");
  await writeFile(published, "existing-published-model");
  await appendFile(path.join(rawRoot, "crane.glb"), Buffer.from([0]));

  await assert.rejects(
    optimizeAll({
      root,
      only: "crane",
      rawRoot,
      reportRoot,
      outputRoot,
    }),
    /raw GLB does not match its export attestation/,
  );
  assert.equal(await readFile(published, "utf8"), "existing-published-model");
  await access(published);
});

test("a failed publication transaction restores the previous optimized model", async () => {
  const rawRoot = path.join(tempRoot, "raw");
  const reportRoot = path.join(tempRoot, "reports");
  const outputRoot = path.join(tempRoot, "published");
  await exportModel("crane", rawRoot, reportRoot);
  await mkdir(outputRoot, { recursive: true });
  const published = path.join(outputRoot, "crane.glb");
  await writeFile(published, "previous-optimized-model");

  await assert.rejects(
    optimizeAll(
      {
        root,
        only: "crane",
        rawRoot,
        reportRoot,
        outputRoot,
      },
      {
        promoter: (options) =>
          promoteCandidateArtifacts({
            ...options,
            finalize: async () => {
              throw new Error("injected optimized publication failure");
            },
          }),
      },
    ),
    /injected optimized publication failure/,
  );

  assert.equal(await readFile(published, "utf8"), "previous-optimized-model");
  assert.deepEqual(
    (await readdir(outputRoot)).filter((name) =>
      /\.next\.glb$|\.backup$/.test(name),
    ),
    [],
  );
});
