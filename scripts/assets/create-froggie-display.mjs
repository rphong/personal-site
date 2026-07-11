import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBlenderScript } from "./lib/blender.mjs";
import { runPreflight } from "./preflight.mjs";
import {
  assertReviewedSourcesUnchanged,
  promoteCandidateArtifacts,
  readSourceProvenance,
  replaceFileAtomically,
  writeSourceProvenance,
} from "./prepare-all.mjs";
import { stageSourceTextures } from "./render-source-textures.mjs";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function assertFroggieReplacementAllowed({
  canonical,
  exists: outputExists,
  replace,
}) {
  if (replace && !canonical) {
    throw new Error("--replace is permitted only for the canonical output");
  }
  if (replace && !outputExists) {
    throw new Error("--replace requires an existing canonical Froggie source");
  }
  if (canonical && outputExists && !replace) {
    throw new Error(
      "FroggieDisplay.blend already exists; use --replace only after reviewing and updating the authored capture contract.",
    );
  }
}

export async function createFroggieDisplay({
  root = process.cwd(),
  output = path.join(root, "assets/blender/FroggieDisplay.blend"),
  writeProvenance = true,
  replace = false,
} = {}, {
  preflight = runPreflight,
  stageTextures = stageSourceTextures,
  blenderRunner = runBlenderScript,
  promoteArtifacts = promoteCandidateArtifacts,
  provenanceReader = readSourceProvenance,
  provenanceWriter = writeSourceProvenance,
  reviewedGuard = assertReviewedSourcesUnchanged,
} = {}) {
  const canonicalOutput = path.join(root, "assets/blender/FroggieDisplay.blend");
  const canonical = path.resolve(output) === path.resolve(canonicalOutput);
  const outputExists = await exists(output);
  assertFroggieReplacementAllowed({ canonical, exists: outputExists, replace });
  if (canonical && !writeProvenance) {
    throw new Error("Canonical Froggie authoring must update source provenance");
  }
  if (!canonical && writeProvenance) {
    throw new Error("Noncanonical Froggie outputs cannot update source provenance");
  }

  const { blenderBin, manifest } = await preflight({
    root,
    allowGeneratedMissing: true,
  });
  const provenance = await provenanceReader(root);
  await reviewedGuard({
    root,
    manifest,
    provenance,
    ignoreKeys: ["froggie-display"],
  });

  const staged = await stageTextures({ root });
  const candidateRoot = path.join(root, ".tmp/assets/curated");
  await mkdir(candidateRoot, { recursive: true });
  const candidatePath = path.join(
    candidateRoot,
    `froggie-display.${staged.operationId}.blend`,
  );
  const textureCandidate = staged.candidates.find(
    (candidate) => candidate.key === "FroggieGameplay",
  );
  if (!textureCandidate) {
    await staged.cleanup();
    throw new Error("Froggie gameplay texture candidate is missing");
  }

  try {
    blenderRunner({
      blenderBin,
      script: path.join(
        root,
        "scripts/assets/blender/create_froggie_display.py",
      ),
      scriptArgs: [
        "--texture",
        textureCandidate.candidatePath,
        "--output",
        candidatePath,
      ],
      cwd: root,
    });

    if (!canonical) {
      await replaceFileAtomically(candidatePath, output);
      return { output, provenance: null };
    }

    const promotion = await promoteArtifacts({
      candidates: [
        { candidatePath, outputPath: output },
        textureCandidate,
      ],
      finalize: () =>
        provenanceWriter({
          root,
          manifest,
          updateKeys: ["froggie-display"],
        }),
      operationId: staged.operationId,
    });
    return { output, provenance: promotion.result };
  } finally {
    await rm(candidatePath, { force: true });
    await staged.cleanup();
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await createFroggieDisplay({
      replace: process.argv.includes("--replace"),
    });
    console.log("canonical Froggie display created");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
