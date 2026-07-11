import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { promoteCandidateArtifacts } from "../../scripts/assets/prepare-all.mjs";
import {
  acquirePosterPipelineLock,
  createPosterPublicationCandidates,
  posterOperationRoot,
  publishPosterCandidates,
} from "../../scripts/posters/pipeline.mjs";

const contract = {
  scenes: [
    {
      id: "home-hero",
      outputs: {
        desktop: "public/posters/home-hero-desktop.webp",
        mobile: "public/posters/home-hero-mobile.webp",
      },
    },
  ],
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "poster-pipeline-"));
  const operationId = "test-operation";
  const operationRoot = posterOperationRoot({ root, operationId });
  const candidateRoot = path.join(operationRoot, "candidates");
  const canonicalRoot = path.join(root, "public/posters");
  await Promise.all([
    mkdir(candidateRoot, { recursive: true }),
    mkdir(canonicalRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(candidateRoot, "home-hero-desktop.webp"), "new-desktop"),
    writeFile(path.join(candidateRoot, "home-hero-mobile.webp"), "new-mobile"),
    writeFile(path.join(candidateRoot, "poster-manifest.json"), "new-manifest"),
    writeFile(path.join(canonicalRoot, "home-hero-desktop.webp"), "old-desktop"),
    writeFile(path.join(canonicalRoot, "poster-manifest.json"), "old-manifest"),
  ]);
  return { root, operationId, operationRoot, canonicalRoot };
}

test("poster publication keeps the manifest last and promotes one complete set", async () => {
  const state = await fixture();
  try {
    const candidates = createPosterPublicationCandidates({
      contract,
      operationRoot: state.operationRoot,
      root: state.root,
    });
    assert.equal(path.basename(candidates.at(-1).outputPath), "poster-manifest.json");

    await publishPosterCandidates({ contract, ...state });
    assert.equal(
      await readFile(path.join(state.canonicalRoot, "home-hero-desktop.webp"), "utf8"),
      "new-desktop",
    );
    assert.equal(
      await readFile(path.join(state.canonicalRoot, "home-hero-mobile.webp"), "utf8"),
      "new-mobile",
    );
    assert.equal(
      await readFile(path.join(state.canonicalRoot, "poster-manifest.json"), "utf8"),
      "new-manifest",
    );
  } finally {
    await rm(state.root, { force: true, recursive: true });
  }
});

test("a mid-publication failure restores old files and removes new-only outputs", async () => {
  const state = await fixture();
  let renames = 0;
  try {
    await assert.rejects(
      publishPosterCandidates({
        contract,
        ...state,
        promoter: (options) =>
          promoteCandidateArtifacts({
            ...options,
            renameFile: async (...arguments_) => {
              renames += 1;
              if (renames === 4) throw new Error("injected publication failure");
              const { rename } = await import("node:fs/promises");
              return rename(...arguments_);
            },
          }),
      }),
      /injected publication failure/,
    );
    assert.equal(
      await readFile(path.join(state.canonicalRoot, "home-hero-desktop.webp"), "utf8"),
      "old-desktop",
    );
    await assert.rejects(
      readFile(path.join(state.canonicalRoot, "home-hero-mobile.webp")),
      { code: "ENOENT" },
    );
    assert.equal(
      await readFile(path.join(state.canonicalRoot, "poster-manifest.json"), "utf8"),
      "old-manifest",
    );
  } finally {
    await rm(state.root, { force: true, recursive: true });
  }
});

test("the poster lock rejects overlap and releases idempotently", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "poster-lock-"));
  try {
    const release = await acquirePosterPipelineLock({ root });
    await assert.rejects(acquirePosterPipelineLock({ root }), /already running/);
    await release();
    await release();
    const releaseAgain = await acquirePosterPipelineLock({ root });
    await releaseAgain();
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("operation IDs cannot escape the poster staging root", () => {
  assert.throws(
    () => posterOperationRoot({ root: process.cwd(), operationId: "../escape" }),
    /path-safe/,
  );
});
