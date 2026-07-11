import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportAll } from "./export-all.mjs";
import {
  loadSourceManifest,
  sha256File,
} from "./lib/manifest.mjs";
import { optimizeAll } from "./optimize.mjs";
import {
  promoteCandidateArtifacts,
} from "./prepare-all.mjs";
import { runPreflight } from "./preflight.mjs";
import { stageSourceTextures } from "./render-source-textures.mjs";
import { validateAll } from "./validate.mjs";

const PUBLICATION_MANIFEST = "assets-manifest.json";
const PIPELINE_LOCK = "assets-all.lock";

function assertSafeOperationId(operationId) {
  if (
    typeof operationId !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(operationId)
  ) {
    throw new Error("Asset publication operationId must be path-safe");
  }
}

function assertSafeStagingRoot({ publishRoot, stagingRoot }) {
  const relative = path.relative(publishRoot, stagingRoot);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes(path.sep)
  ) {
    throw new Error("Refusing to clean an unsafe asset staging path");
  }
}

export function createPublicationCandidates({
  manifest,
  root,
  stagedModelRoot,
}) {
  return [
    ...manifest.models.map((model) => ({
      candidatePath: path.join(
        stagedModelRoot,
        path.basename(model.output),
      ),
      outputPath: path.join(root, model.output),
    })),
    {
      candidatePath: path.join(stagedModelRoot, PUBLICATION_MANIFEST),
      outputPath: path.join(
        root,
        "public/models",
        PUBLICATION_MANIFEST,
      ),
    },
  ];
}

export async function acquireAssetPipelineLock({ root }) {
  const lockPath = path.resolve(root, ".tmp/assets", PIPELINE_LOCK);
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    await mkdir(lockPath);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `Another asset regeneration is already running. If it crashed, remove ${lockPath} after confirming no asset process remains.`,
        { cause: error },
      );
    }
    throw error;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await rm(lockPath, { force: true, recursive: true });
  };
}

export async function verifySourceTextures({ root }) {
  const staged = await stageSourceTextures({ root });
  let verificationError;
  try {
    for (const candidate of staged.candidates) {
      const generated = staged.generated[candidate.key];
      const committedSha256 = await sha256File(candidate.outputPath);
      if (committedSha256 !== generated.sha256) {
        throw new Error(
          `${generated.path}: deterministic source texture drifted; review and curate it before full regeneration.`,
        );
      }
    }
  } catch (error) {
    verificationError = error;
  }
  try {
    await staged.cleanup();
  } catch (cleanupError) {
    if (verificationError) {
      throw new AggregateError(
        [verificationError, cleanupError],
        "Source texture verification failed and cleanup was incomplete",
      );
    }
    throw cleanupError;
  }
  if (verificationError) throw verificationError;
  return staged.generated;
}

export async function publishValidatedAssets({
  manifest,
  operationId,
  promoter = promoteCandidateArtifacts,
  root,
  stagedModelRoot,
}) {
  const candidates = createPublicationCandidates({
    manifest,
    root,
    stagedModelRoot,
  });
  const publication = await promoter({ candidates, operationId });
  if (publication?.cleanupErrors?.length > 0) {
    throw new AggregateError(
      publication.cleanupErrors.map(({ error }) => error),
      "Asset publication succeeded but backup cleanup was incomplete",
    );
  }
  return publication;
}

export async function runAssetPipeline({
  exporter,
  operationId = `${process.pid}-${randomUUID()}`,
  optimizer,
  preflight,
  promoter = promoteCandidateArtifacts,
  root = process.cwd(),
  textureRenderer,
  validator,
} = {}) {
  assertSafeOperationId(operationId);
  const publishRoot = path.resolve(root, ".tmp/assets/publish");
  const stagingRoot = path.join(publishRoot, operationId);
  const stagedModelRoot = path.join(stagingRoot, "models");
  assertSafeStagingRoot({ publishRoot, stagingRoot });
  const releaseLock = await acquireAssetPipelineLock({ root });
  const completed = [];
  let pipelineError;
  try {
    const manifest = await loadSourceManifest({ root });
    const operations = [
      ["preflight", preflight ?? (() => runPreflight({ root }))],
      [
        "textures",
        textureRenderer ?? (() => verifySourceTextures({ root })),
      ],
      ["export", exporter ?? (() => exportAll({ root }))],
      [
        "optimize",
        optimizer ??
          (() => optimizeAll({ root, outputRoot: stagedModelRoot })),
      ],
      [
        "validate",
        validator ??
          (async () => {
            await mkdir(stagedModelRoot, { recursive: true });
            await validateAll({
              modelRoot: stagedModelRoot,
              outputPath: path.join(stagedModelRoot, PUBLICATION_MANIFEST),
              root,
              writeManifest: true,
            });
            await publishValidatedAssets({
              manifest,
              operationId,
              promoter,
              root,
              stagedModelRoot,
            });
          }),
      ],
    ];
    for (const [name, operation] of operations) {
      await operation();
      completed.push(name);
      console.log(`asset stage complete: ${name}`);
    }
  } catch (error) {
    pipelineError = error;
  }

  const cleanupErrors = [];
  for (const cleanup of [
    () => rm(stagingRoot, { force: true, recursive: true }),
    releaseLock,
  ]) {
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (pipelineError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [pipelineError, ...cleanupErrors],
      "Asset regeneration failed and cleanup was incomplete",
    );
  }
  if (pipelineError) throw pipelineError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Asset regeneration succeeded but cleanup was incomplete",
    );
  }
  return completed;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await runAssetPipeline();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
