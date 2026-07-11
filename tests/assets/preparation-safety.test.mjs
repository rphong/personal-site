import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { sha256File } from "../../scripts/assets/lib/manifest.mjs";
import {
  assertFirstCurationSourcesMatchOrigin,
  assertSelectedSourcesMatchOrigin,
  promoteCandidateArtifacts,
  promoteCandidateSources,
  replaceFileAtomically,
} from "../../scripts/assets/prepare-all.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/preparation-safety-test-${process.pid}`,
);

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function createPromotionFixture() {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const sourceA = path.join(tempRoot, "A.blend");
  const sourceB = path.join(tempRoot, "B.blend");
  const candidateA = path.join(tempRoot, "A.next.blend");
  const candidateB = path.join(tempRoot, "B.next.blend");
  const provenance = path.join(tempRoot, "source-provenance.json");
  await Promise.all([
    writeFile(sourceA, "old-a"),
    writeFile(sourceB, "old-b"),
    writeFile(candidateA, "new-a"),
    writeFile(candidateB, "new-b"),
    writeFile(provenance, "stable-provenance"),
  ]);
  return {
    candidates: [
      { candidatePath: candidateA, sourcePath: sourceA },
      { candidatePath: candidateB, sourcePath: sourceB },
    ],
    provenance,
    sourceA,
    sourceB,
  };
}

async function assertFixtureRestored(fixture) {
  assert.equal(await readFile(fixture.sourceA, "utf8"), "old-a");
  assert.equal(await readFile(fixture.sourceB, "utf8"), "old-b");
  assert.equal(await readFile(fixture.provenance, "utf8"), "stable-provenance");
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) => name.endsWith(".backup")),
    [],
  );
}

test("first curation requires the selected import to match its manifest origin", async () => {
  const source = path.join(tempRoot, "assets/blender/Imported.blend");
  await mkdir(path.dirname(source), { recursive: true });
  await writeFile(source, "original-import");
  const model = {
    key: "imported",
    source: "assets/blender/Imported.blend",
    origin: {
      bytes: Buffer.byteLength("original-import"),
      sha256: await sha256File(source),
    },
  };

  await assert.doesNotReject(
    assertFirstCurationSourcesMatchOrigin({
      root: tempRoot,
      selected: [model],
      provenance: { schemaVersion: 1, models: {} },
    }),
  );
  await assert.doesNotReject(
    assertSelectedSourcesMatchOrigin({
      root: tempRoot,
      selected: [model],
    }),
  );

  await writeFile(source, "unreviewed-drift");
  await assert.rejects(
    assertFirstCurationSourcesMatchOrigin({
      root: tempRoot,
      selected: [model],
      provenance: { schemaVersion: 1, models: {} },
    }),
    /first curation source does not match the original import/,
  );
  await assert.rejects(
    assertSelectedSourcesMatchOrigin({
      root: tempRoot,
      selected: [model],
    }),
    /origin rebuild source does not match the original import/,
  );

  await assert.doesNotReject(
    assertFirstCurationSourcesMatchOrigin({
      root: tempRoot,
      selected: [model],
      provenance: { schemaVersion: 1, models: { imported: {} } },
    }),
  );
});

test("candidate promotion rolls every source back before provenance can drift", async () => {
  let fixture = await createPromotionFixture();
  let provenanceWrites = 0;
  await assert.rejects(
    promoteCandidateSources({
      candidates: fixture.candidates,
      renameFile: async (from, to) => {
        if (from === fixture.candidates[1].candidatePath) {
          throw new Error("injected second promotion failure");
        }
        await rename(from, to);
      },
      writeProvenance: async () => {
        provenanceWrites += 1;
      },
    }),
    /injected second promotion failure/,
  );
  assert.equal(provenanceWrites, 0);
  await assertFixtureRestored(fixture);

  fixture = await createPromotionFixture();
  await assert.rejects(
    promoteCandidateSources({
      candidates: fixture.candidates,
      writeProvenance: async () => {
        assert.equal(await readFile(fixture.sourceA, "utf8"), "new-a");
        assert.equal(await readFile(fixture.sourceB, "utf8"), "new-b");
        throw new Error("injected provenance failure");
      },
    }),
    /injected provenance failure/,
  );
  await assertFixtureRestored(fixture);
});

test("one failed transaction restores source and texture artifacts together", async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const sourcePath = path.join(tempRoot, "CraneOnLeague.blend");
  const sourceCandidate = path.join(tempRoot, "CraneOnLeague.next.blend");
  const texturePath = path.join(tempRoot, "league-ban-dashboard.png");
  const textureCandidate = path.join(tempRoot, "league-ban-dashboard.next.png");
  await Promise.all([
    writeFile(sourcePath, "old-source"),
    writeFile(sourceCandidate, "new-source"),
    writeFile(texturePath, "old-texture"),
    writeFile(textureCandidate, "new-texture"),
  ]);

  await assert.rejects(
    promoteCandidateArtifacts({
      candidates: [
        { candidatePath: sourceCandidate, outputPath: sourcePath },
        { candidatePath: textureCandidate, outputPath: texturePath },
      ],
      finalize: async () => {
        assert.equal(await readFile(sourcePath, "utf8"), "new-source");
        assert.equal(await readFile(texturePath, "utf8"), "new-texture");
        throw new Error("injected provenance failure");
      },
      operationId: "cross-artifact-rollback",
    }),
    /injected provenance failure/,
  );

  assert.equal(await readFile(sourcePath, "utf8"), "old-source");
  assert.equal(await readFile(texturePath, "utf8"), "old-texture");
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) => name.endsWith(".backup")),
    [],
  );
});

test("a texture promotion failure restores an already promoted source", async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const sourcePath = path.join(tempRoot, "CraneOnLeague.blend");
  const sourceCandidate = path.join(tempRoot, "CraneOnLeague.next.blend");
  const texturePath = path.join(tempRoot, "league-ban-dashboard.png");
  const textureCandidate = path.join(tempRoot, "league-ban-dashboard.next.png");
  await Promise.all([
    writeFile(sourcePath, "old-source"),
    writeFile(sourceCandidate, "new-source"),
    writeFile(texturePath, "old-texture"),
    writeFile(textureCandidate, "new-texture"),
  ]);

  await assert.rejects(
    promoteCandidateArtifacts({
      candidates: [
        { candidatePath: sourceCandidate, outputPath: sourcePath },
        { candidatePath: textureCandidate, outputPath: texturePath },
      ],
      renameFile: async (from, to) => {
        if (from === textureCandidate) {
          throw new Error("injected texture promotion failure");
        }
        await rename(from, to);
      },
      operationId: "texture-promotion-rollback",
    }),
    /injected texture promotion failure/,
  );

  assert.equal(await readFile(sourcePath, "utf8"), "old-source");
  assert.equal(await readFile(texturePath, "utf8"), "old-texture");
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) => name.endsWith(".backup")),
    [],
  );
});

test("a failed first-generation transaction removes newly promoted textures", async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const sourcePath = path.join(tempRoot, "CraneOnLeague.blend");
  const sourceCandidate = path.join(tempRoot, "CraneOnLeague.next.blend");
  const texturePath = path.join(tempRoot, "league-ban-dashboard.png");
  const textureCandidate = path.join(tempRoot, "league-ban-dashboard.next.png");
  await Promise.all([
    writeFile(sourcePath, "old-source"),
    writeFile(sourceCandidate, "new-source"),
    writeFile(textureCandidate, "first-texture"),
  ]);

  await assert.rejects(
    promoteCandidateArtifacts({
      candidates: [
        { candidatePath: sourceCandidate, outputPath: sourcePath },
        { candidatePath: textureCandidate, outputPath: texturePath },
      ],
      finalize: async () => {
        throw new Error("injected first-generation provenance failure");
      },
      operationId: "first-generation-rollback",
    }),
    /injected first-generation provenance failure/,
  );

  assert.equal(await readFile(sourcePath, "utf8"), "old-source");
  await assert.rejects(readFile(texturePath), { code: "ENOENT" });
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) => name.endsWith(".backup")),
    [],
  );
});

test("artifact promotion succeeds for existing and first-generation outputs", async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const existingPath = path.join(tempRoot, "existing.png");
  const existingCandidate = path.join(tempRoot, "existing.next.png");
  const generatedPath = path.join(tempRoot, "generated.png");
  const generatedCandidate = path.join(tempRoot, "generated.next.png");
  await Promise.all([
    writeFile(existingPath, "old-existing"),
    writeFile(existingCandidate, "stable-existing"),
    writeFile(generatedCandidate, "stable-generated"),
  ]);

  await promoteCandidateArtifacts({
    candidates: [
      { candidatePath: existingCandidate, outputPath: existingPath },
      { candidatePath: generatedCandidate, outputPath: generatedPath },
    ],
    operationId: "artifact-success",
  });

  assert.equal(await readFile(existingPath, "utf8"), "stable-existing");
  assert.equal(await readFile(generatedPath, "utf8"), "stable-generated");
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) => name.endsWith(".backup")),
    [],
  );
});

test("post-commit artifact backup cleanup failures are diagnostic and do not reject", async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const sourceA = path.join(tempRoot, "A.blend");
  const sourceB = path.join(tempRoot, "B.png");
  const candidateA = path.join(tempRoot, "A.next.blend");
  const candidateB = path.join(tempRoot, "B.next.png");
  await Promise.all([
    writeFile(sourceA, "stable-a"),
    writeFile(sourceB, "stable-b"),
    writeFile(candidateA, "new-a"),
    writeFile(candidateB, "new-b"),
  ]);
  const cleanupError = new Error("injected artifact backup cleanup failure");
  const attemptedCleanup = [];
  const warnings = [];
  const originalWarn = console.warn;
  let promotion;
  try {
    console.warn = (...values) => warnings.push(values.join(" "));
    promotion = await promoteCandidateArtifacts({
      candidates: [
        { candidatePath: candidateA, outputPath: sourceA },
        { candidatePath: candidateB, outputPath: sourceB },
      ],
      finalize: async () => ({ committed: true }),
      operationId: "artifact-cleanup-failure",
      removeFile: async (filePath, options) => {
        attemptedCleanup.push(filePath);
        if (filePath.endsWith("artifact-cleanup-failure.0.backup")) {
          throw cleanupError;
        }
        await rm(filePath, options);
      },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(promotion.result, { committed: true });
  assert.equal(promotion.cleanupErrors.length, 1);
  assert.equal(promotion.cleanupErrors[0].error, cleanupError);
  assert.match(
    promotion.cleanupErrors[0].backupPath,
    /artifact-cleanup-failure\.0\.backup$/,
  );
  assert.equal(await readFile(sourceA, "utf8"), "new-a");
  assert.equal(await readFile(sourceB, "utf8"), "new-b");
  assert.equal(
    await readFile(promotion.cleanupErrors[0].backupPath, "utf8"),
    "stable-a",
  );
  await assert.rejects(
    readFile(`${sourceB}.artifact-cleanup-failure.1.backup`),
    { code: "ENOENT" },
  );
  assert.equal(attemptedCleanup.length, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /backup cleanup failed/i);
});

test("provenance backup cleanup failure cannot roll promoted sources back", async () => {
  const fixture = await createPromotionFixture();
  const nextProvenance = `${fixture.provenance}.next`;
  const cleanupError = new Error("injected provenance backup cleanup failure");
  await writeFile(nextProvenance, "new-provenance");

  const result = await promoteCandidateSources({
    candidates: fixture.candidates,
    operationId: "cleanup-failure",
    writeProvenance: () =>
      replaceFileAtomically(nextProvenance, fixture.provenance, {
        removeFile: async (filePath, options) => {
          if (filePath.endsWith(".backup")) throw cleanupError;
          await rm(filePath, options);
        },
      }),
  });

  assert.equal(await readFile(fixture.sourceA, "utf8"), "new-a");
  assert.equal(await readFile(fixture.sourceB, "utf8"), "new-b");
  assert.equal(await readFile(fixture.provenance, "utf8"), "new-provenance");
  assert.equal(result.cleanupError, cleanupError);
  assert.equal(
    await readFile(result.backupPath, "utf8"),
    "stable-provenance",
  );
  assert.deepEqual(
    (await readdir(tempRoot)).filter((name) =>
      name.endsWith("cleanup-failure.0.backup") ||
      name.endsWith("cleanup-failure.1.backup")
    ),
    [],
  );
});
