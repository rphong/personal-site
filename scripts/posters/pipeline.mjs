import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import { promoteCandidateArtifacts } from "../assets/prepare-all.mjs";

const POSTER_LOCK = "posters.lock";
const TRANSIENT_RENAME_DELAYS_MS = [25, 50, 100, 200, 400, 800, 1_600];
const TRANSIENT_RENAME_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function renamePosterFileWithRetry(
  from,
  to,
  {
    delays = TRANSIENT_RENAME_DELAYS_MS,
    pause = wait,
    renameFile = rename,
  } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await renameFile(from, to);
    } catch (error) {
      const delay = delays[attempt];
      if (!TRANSIENT_RENAME_CODES.has(error.code) || delay === undefined) {
        throw error;
      }
      await pause(delay);
    }
  }
}

export function assertSafePosterOperationId(operationId) {
  if (
    typeof operationId !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(operationId)
  ) {
    throw new Error("Poster operationId must be path-safe");
  }
}

export function posterOperationRoot({ root, operationId }) {
  assertSafePosterOperationId(operationId);
  return path.resolve(root, ".tmp/posters/operations", operationId);
}

export async function acquirePosterPipelineLock({ root }) {
  const lockPath = path.resolve(root, ".tmp/posters", POSTER_LOCK);
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    await mkdir(lockPath);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `Another poster capture is already running. If it crashed, remove ${lockPath} only after confirming no capture process remains.`,
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

export function createPosterPublicationCandidates({
  contract,
  operationRoot,
  root,
}) {
  const candidateRoot = path.join(operationRoot, "candidates");
  const candidates = [];
  for (const scene of contract.scenes) {
    for (const variant of ["desktop", "mobile"]) {
      const output = scene.outputs[variant];
      candidates.push({
        candidatePath: path.join(candidateRoot, path.basename(output)),
        outputPath: path.join(root, output),
      });
    }
  }
  candidates.push({
    candidatePath: path.join(candidateRoot, "poster-manifest.json"),
    outputPath: path.join(root, "public/posters/poster-manifest.json"),
  });
  return candidates;
}

export async function publishPosterCandidates({
  contract,
  operationId,
  operationRoot,
  promoter = promoteCandidateArtifacts,
  root,
}) {
  const candidates = createPosterPublicationCandidates({
    contract,
    operationRoot,
    root,
  });
  for (const candidate of candidates) {
    await readFile(candidate.candidatePath);
  }
  const publication = await promoter({
    candidates,
    operationId,
    renameFile: renamePosterFileWithRetry,
  });
  if (publication?.cleanupErrors?.length > 0) {
    throw new AggregateError(
      publication.cleanupErrors.map(({ error }) => error),
      "Poster publication succeeded but backup cleanup was incomplete",
    );
  }
  return publication;
}
