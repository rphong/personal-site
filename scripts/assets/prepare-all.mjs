import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPreflight } from "./preflight.mjs";
import { runBlenderScript } from "./lib/blender.mjs";
import { sha256File, stringifyStable } from "./lib/manifest.mjs";

const ROCKET_SMOKE_BAKE = {
  frame: 60,
  integrityVersion: 2,
  materialPolicy: "principled-static-v1",
  simulationPolicy: "procedural-seeded-static-v1",
  simulationSeeds: {
    engine: 51060,
    ground: 40060,
  },
  simulationStyles: {
    engine: "engine-cone",
    ground: "ground-ring",
  },
  version: 2,
};

const CRANE_WORKOUT_CLEANUP = {
  policy: "remove-hidden-hand-mirror-v1",
  removedData: ["Cylinder.001", "Mirror Frame", "Mirror Lens"],
  removedObject: "Hand Mirror",
  version: 1,
};

const WEB_GROUND_CLEANUP = {
  policy: "remove-authored-shadow-catcher-v1",
  shadowStrategy: "transparent-canvas-contact-shadow-v1",
  version: 1,
};

const WEB_GROUND_BY_MODEL = {
  crane: { mesh: "Plane.001", object: "Shadow Catcher" },
  "crane-making-table": { mesh: "Plane.001", object: "Shadow Catcher" },
  "crane-on-league": { mesh: "Plane.001", object: "Shadow Catcher" },
  "crane-throwing-plane": { mesh: "Plane.001", object: "Shadow Catcher" },
  "crane-workout": { mesh: "Plane.001", object: "Shadow Catcher" },
  rocket: { mesh: "Plane", object: "Ground" },
};

const STATIC_CRANE_POSE_BY_MODEL = {
  "crane-making-table": {
    frame: 2,
    policy: "bake-skinned-mesh-pose-v1",
    version: 1,
  },
  "crane-on-league": {
    frame: 48,
    policy: "bake-skinned-mesh-pose-v1",
    version: 1,
  },
  "crane-throwing-plane": {
    frame: 19,
    policy: "bake-skinned-mesh-pose-v1",
    version: 1,
  },
};

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readSourceProvenance(root) {
  try {
    const source = await readFile(
      path.join(root, "assets/blender/source-provenance.json"),
      "utf8",
    );
    const provenance = JSON.parse(source);
    if (provenance.schemaVersion !== 1 || !provenance.models) {
      throw new Error("source-provenance.json must use schemaVersion 1");
    }
    return provenance;
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1, models: {} };
    throw error;
  }
}

function candidatePathByAuthoredSource(root, textureCandidates = []) {
  return new Map(
    textureCandidates.map((candidate) => [
      candidate.relativePath ?? path.relative(root, candidate.outputPath).replaceAll("\\", "/"),
      candidate.candidatePath,
    ]),
  );
}

async function buildGeneratorInputs({
  root,
  manifest,
  model,
  textureCandidates = [],
}) {
  const generatorInputs = {};
  if ((model.ownedTextures ?? []).length > 0) {
    const candidatePaths = candidatePathByAuthoredSource(root, textureCandidates);
    const ownedTextures = {};
    for (const texture of model.ownedTextures) {
      const texturePath = candidatePaths.get(texture.source) ?? path.join(root, texture.source);
      const [textureStats, sha256] = await Promise.all([
        stat(texturePath),
        sha256File(texturePath),
      ]);
      ownedTextures[texture.name] = {
        bytes: textureStats.size,
        path: texture.source,
        sha256,
      };
    }
    generatorInputs.ownedTextures = ownedTextures;
  }
  if (model.key === "froggie-display") {
    const referencePath = path.join(root, manifest.froggieCapture.source);
    const [referenceStats, referenceSha256] = await Promise.all([
      stat(referencePath),
      sha256File(referencePath),
    ]);
    if (
      referenceStats.size !== manifest.froggieCapture.bytes ||
      referenceSha256 !== manifest.froggieCapture.sha256
    ) {
      throw new Error("froggie-display: reviewed capture input drifted");
    }
    generatorInputs.froggieCapture = manifest.froggieCapture;
  }
  if (model.key === "rocket") {
    generatorInputs.rocketSmokeBake = ROCKET_SMOKE_BAKE;
  }
  if (model.key === "crane-workout") {
    generatorInputs.craneWorkoutCleanup = CRANE_WORKOUT_CLEANUP;
  }
  if (WEB_GROUND_BY_MODEL[model.key]) {
    generatorInputs.webGroundCleanup = {
      ...WEB_GROUND_CLEANUP,
      ...WEB_GROUND_BY_MODEL[model.key],
    };
  }
  if (STATIC_CRANE_POSE_BY_MODEL[model.key]) {
    generatorInputs.staticCranePose = STATIC_CRANE_POSE_BY_MODEL[model.key];
  }
  return Object.keys(generatorInputs).length > 0
    ? { generatorInputs }
    : {};
}

export async function assertFirstCurationSourcesMatchOrigin({
  root,
  selected,
  provenance,
}) {
  for (const model of selected) {
    if (provenance.models?.[model.key]) continue;
    if (!model.origin) {
      throw new Error(`${model.key}: first curation requires original import metadata`);
    }
    const sourcePath = path.join(root, model.source);
    const [sourceStats, sourceSha256] = await Promise.all([
      stat(sourcePath),
      sha256File(sourcePath),
    ]);
    if (
      sourceStats.size !== model.origin.bytes ||
      sourceSha256 !== model.origin.sha256
    ) {
      throw new Error(
        `${model.key}: first curation source does not match the original import`,
      );
    }
  }
}

export async function assertSelectedSourcesMatchOrigin({ root, selected }) {
  for (const model of selected) {
    if (!model.origin) {
      throw new Error(`${model.key}: origin rebuild requires original import metadata`);
    }
    const sourcePath = path.join(root, model.source);
    const [sourceStats, sourceSha256] = await Promise.all([
      stat(sourcePath),
      sha256File(sourcePath),
    ]);
    if (
      sourceStats.size !== model.origin.bytes ||
      sourceSha256 !== model.origin.sha256
    ) {
      throw new Error(
        `${model.key}: origin rebuild source does not match the original import`,
      );
    }
  }
}

export async function assertReviewedSourcesUnchanged({
  root,
  manifest,
  provenance,
  ignoreKeys = [],
  textureCandidates = [],
}) {
  const ignored = new Set(ignoreKeys);
  const byKey = new Map(manifest.models.map((model) => [model.key, model]));
  for (const key of Object.keys(provenance.models ?? {})) {
    if (!byKey.has(key)) {
      throw new Error(`${key}: provenance contains an unknown model`);
    }
  }
  for (const model of manifest.models) {
    const key = model.key;
    if (ignored.has(key)) continue;
    const entry = provenance.models?.[key];
    const sourceExists = await exists(path.join(root, model.source));
    if (!sourceExists) {
      if (model.generator && !entry) continue;
      throw new Error(`${key}: reviewed source is missing`);
    }
    if (!entry) {
      throw new Error(`${key}: reviewed source provenance is missing`);
    }
    if (model.source !== entry.source) {
      throw new Error(`${key}: provenance source does not match the authored manifest`);
    }
    if (await sha256File(path.join(root, model.source)) !== entry.canonicalSha256) {
      throw new Error(`${key}: reviewed source drifted`);
    }
    if (model.origin && entry.originalSha256 !== model.origin.sha256) {
      throw new Error(`${key}: original import provenance drifted`);
    }
    const expectedInputs = await buildGeneratorInputs({
      root,
      manifest,
      model,
    });
    if (
      stringifyStable(entry.generatorInputs ?? {}) !==
      stringifyStable(expectedInputs.generatorInputs ?? {})
    ) {
      throw new Error(`${key}: reviewed generator inputs drifted`);
    }
    if (textureCandidates.length > 0) {
      const stagedInputs = await buildGeneratorInputs({
        root,
        manifest,
        model,
        textureCandidates,
      });
      if (
        stringifyStable(entry.generatorInputs ?? {}) !==
        stringifyStable(stagedInputs.generatorInputs ?? {})
      ) {
        throw new Error(`${key}: staged generator inputs drifted`);
      }
    }
  }
  return provenance;
}

export async function replaceFileAtomically(
  temporaryPath,
  outputPath,
  { removeFile = rm } = {},
) {
  const backupPath = `${outputPath}.${process.pid}.backup`;
  let movedExisting = false;
  try {
    await rename(outputPath, backupPath);
    movedExisting = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (movedExisting) await rename(backupPath, outputPath);
    throw error;
  }

  if (!movedExisting) return { backupPath: null, cleanupError: null };
  try {
    await removeFile(backupPath, { force: true });
    return { backupPath: null, cleanupError: null };
  } catch (cleanupError) {
    console.warn(
      `Replaced ${outputPath}, but could not remove backup ${backupPath}: ${cleanupError.message}`,
    );
    return { backupPath, cleanupError };
  }
}

export async function promoteCandidateArtifacts({
  candidates,
  finalize = async () => undefined,
  renameFile = rename,
  removeFile = rm,
  operationId = process.pid,
}) {
  if (typeof finalize !== "function") {
    throw new Error("Candidate promotion finalizer must be a function");
  }
  const promotions = candidates.map((candidate, index) => ({
    ...candidate,
    outputPath: candidate.outputPath ?? candidate.sourcePath,
    backupMoved: false,
    candidateMoved: false,
    backupPath: `${candidate.outputPath ?? candidate.sourcePath}.${operationId}.${index}.backup`,
  }));

  const outputPaths = new Set();
  for (const promotion of promotions) {
    if (!promotion.candidatePath || !promotion.outputPath) {
      throw new Error("Candidate promotion requires candidatePath and outputPath");
    }
    if (outputPaths.has(promotion.outputPath)) {
      throw new Error(`Duplicate candidate promotion output: ${promotion.outputPath}`);
    }
    outputPaths.add(promotion.outputPath);
    if (await exists(promotion.backupPath)) {
      throw new Error(`Stale promotion backup exists: ${promotion.backupPath}`);
    }
  }

  let result;
  try {
    for (const promotion of promotions) {
      try {
        await renameFile(promotion.outputPath, promotion.backupPath);
        promotion.backupMoved = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await renameFile(promotion.candidatePath, promotion.outputPath);
      promotion.candidateMoved = true;
    }
    result = await finalize();
  } catch (error) {
    const rollbackErrors = [];
    for (const promotion of [...promotions].reverse()) {
      try {
        if (promotion.candidateMoved) {
          await removeFile(promotion.outputPath, { force: true });
        }
        if (promotion.backupMoved) {
          await renameFile(promotion.backupPath, promotion.outputPath);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Candidate promotion failed and rollback was incomplete",
      );
    }
    throw error;
  }

  const cleanupErrors = [];
  for (const promotion of promotions) {
    if (!promotion.backupMoved) continue;
    try {
      await removeFile(promotion.backupPath, { force: true });
    } catch (error) {
      cleanupErrors.push({ backupPath: promotion.backupPath, error });
      console.warn(
        `Artifact backup cleanup failed: ${promotion.backupPath}: ${error.message}`,
      );
    }
  }
  return { cleanupErrors, result };
}

export async function promoteCandidateSources({
  candidates,
  writeProvenance,
  ...options
}) {
  if (typeof writeProvenance !== "function") {
    throw new Error("Candidate promotion requires a provenance writer");
  }
  const promotion = await promoteCandidateArtifacts({
    candidates,
    finalize: writeProvenance,
    ...options,
  });
  if (
    promotion.cleanupErrors.length > 0 &&
    promotion.result &&
    typeof promotion.result === "object"
  ) {
    return {
      ...promotion.result,
      artifactCleanupErrors: promotion.cleanupErrors,
    };
  }
  return promotion.result;
}

export async function writeSourceProvenance({
  root,
  manifest,
  updateKeys,
}) {
  const updates = new Set(updateKeys ?? []);
  if (updates.size === 0) {
    throw new Error("writeSourceProvenance requires at least one authorized update key");
  }
  const byKey = new Map(manifest.models.map((model) => [model.key, model]));
  for (const key of updates) {
    if (!byKey.has(key)) throw new Error(`Unknown provenance update key: ${key}`);
  }

  const current = await readSourceProvenance(root);
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance: current,
    ignoreKeys: [...updates],
  });
  const models = { ...current.models };
  for (const key of updates) {
    const model = byKey.get(key);
    const sourcePath = path.join(root, model.source);
    if (!(await exists(sourcePath))) {
      throw new Error(`${key}: authorized source is missing`);
    }
    models[key] = {
      canonicalSha256: await sha256File(sourcePath),
      ...(model.origin ? { originalSha256: model.origin.sha256 } : {}),
      source: model.source,
      ...(await buildGeneratorInputs({ root, manifest, model })),
    };
  }

  const output = { schemaVersion: 1, models };
  const provenancePath = path.join(
    root,
    "assets/blender/source-provenance.json",
  );
  const temporaryPath = `${provenancePath}.${process.pid}.next`;
  await mkdir(path.dirname(provenancePath), { recursive: true });
  try {
    await writeFile(temporaryPath, stringifyStable(output));
    await replaceFileAtomically(temporaryPath, provenancePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return output;
}

export async function prepareAll({
  root = process.cwd(),
  only = null,
  replace = false,
  replaceAllFromOrigin = false,
} = {}, {
  preflight = runPreflight,
  stageTextures = null,
  blenderRunner = runBlenderScript,
  promoteArtifacts = promoteCandidateArtifacts,
  provenanceWriter = writeSourceProvenance,
} = {}) {
  const { blenderBin, manifest } = await preflight({
    root,
    allowGeneratedMissing: true,
  });
  if (replaceAllFromOrigin && (replace || only)) {
    throw new Error(
      "--replace-all-from-origin cannot be combined with --replace or --only",
    );
  }
  if (replace && !only) {
    throw new Error("--replace requires explicit --only model keys");
  }
  const onlyKeys = only
    ? new Set(Array.isArray(only) ? only : String(only).split(","))
    : null;
  const selected = manifest.models.filter(
    (model) => model.origin && (!onlyKeys || onlyKeys.has(model.key)),
  );
  if (onlyKeys && selected.length !== onlyKeys.size) {
    const known = new Set(selected.map((model) => model.key));
    const unknown = [...onlyKeys].filter((key) => !known.has(key));
    throw new Error(`Unknown imported model key: ${unknown.join(",")}`);
  }
  const candidateRoot = path.join(root, ".tmp/assets/curated");
  await mkdir(candidateRoot, { recursive: true });
  const candidates = [];
  let stagedTextures = null;
  try {
    const textureStager = stageTextures ??
      (await import("./render-source-textures.mjs")).stageSourceTextures;
    stagedTextures = await textureStager({ root });
    const current = await readSourceProvenance(root);
    await assertFirstCurationSourcesMatchOrigin({
      root,
      selected,
      provenance: current,
    });
    if (replaceAllFromOrigin) {
      await assertSelectedSourcesMatchOrigin({ root, selected });
    }
    for (const model of selected) {
      if (current.models[model.key] && !replace && !replaceAllFromOrigin) {
        throw new Error(
          `${model.key}: canonical source is already reviewed; use --only ${model.key} --replace for an intentional replacement`,
        );
      }
    }
    await assertReviewedSourcesUnchanged({
      root,
      manifest,
      provenance: current,
      ignoreKeys: selected.map((model) => model.key),
      textureCandidates: stagedTextures.candidates,
    });
    const stagedTextureBySource = new Map(
      stagedTextures.candidates.map((candidate) => [
        candidate.relativePath,
        candidate.candidatePath,
      ]),
    );
    for (const model of selected) {
      const sourcePath = path.join(root, model.source);
      const candidatePath = path.join(
        candidateRoot,
        `${model.key}.${process.pid}.blend`,
      );
      const candidate = { candidatePath, model, sourcePath };
      candidates.push(candidate);
      const scriptArgs = ["--destination", candidatePath];
      if (WEB_GROUND_BY_MODEL[model.key]) {
        scriptArgs.push("--remove-web-ground");
      }
      if (model.key === "crane-on-league") {
        scriptArgs.push(
          "--league-dashboard",
          stagedTextureBySource.get(
            "assets/blender/textures/league-ban-dashboard.png",
          ),
          "--league-history",
          stagedTextureBySource.get(
            "assets/blender/textures/league-match-history.png",
          ),
        );
      }
      if (model.key === "rocket") {
        scriptArgs.push(
          "--rocket-smoke-bake-frame",
          String(ROCKET_SMOKE_BAKE.frame),
        );
      }
      if (model.key === "crane-workout") {
        scriptArgs.push("--crane-workout-remove-hidden-hand-mirror");
      }
      if (STATIC_CRANE_POSE_BY_MODEL[model.key]) {
        scriptArgs.push(
          "--static-crane-pose-frame",
          String(STATIC_CRANE_POSE_BY_MODEL[model.key].frame),
        );
      }
      blenderRunner({
        blenderBin,
        blendFile: sourcePath,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs,
        cwd: root,
      });
    }
    await promoteArtifacts({
      candidates: [...candidates, ...stagedTextures.candidates],
      finalize: () =>
        provenanceWriter({
          root,
          manifest,
          updateKeys: selected.map((model) => model.key),
        }),
    });
    for (const { model } of candidates) {
      console.log(`curated ${model.key}`);
    }
    console.log("source provenance written");
  } finally {
    for (const { candidatePath } of candidates) {
      await rm(candidatePath, { force: true });
    }
    await stagedTextures?.cleanup();
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
  const replace = process.argv.includes("--replace");
  const replaceAllFromOrigin = process.argv.includes(
    "--replace-all-from-origin",
  );
  try {
    await prepareAll({ only, replace, replaceAllFromOrigin });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
