import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  acquirePosterPipelineLock,
  posterOperationRoot,
  publishPosterCandidates,
} from "./pipeline.mjs";

function parseMode(argument) {
  if (argument === "--write") return "write";
  if (argument === "--check") return "check";
  throw new Error("Usage: node scripts/posters/capture.mjs --write|--check");
}

function assertChildResult(result) {
  if (result.error) {
    throw new Error("Failed to launch the pinned Playwright CLI", {
      cause: result.error,
    });
  }
  if (result.signal) {
    throw new Error(`Poster capture was terminated by ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(`Poster capture exited with status ${result.status}`);
  }
}

export async function runPosterCapture({
  argument = process.argv[2],
  root = process.cwd(),
  spawn = spawnSync,
} = {}) {
  const mode = parseMode(argument);
  const operationId = `${process.pid}-${randomUUID()}`;
  const operationRoot = posterOperationRoot({ root, operationId });
  const releaseLock = await acquirePosterPipelineLock({ root });
  let operationError;
  try {
    await mkdir(path.join(operationRoot, "candidates"), { recursive: true });
    const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
    const result = spawn(
      process.execPath,
      [
        playwrightCli,
        "test",
        "tests/browser/poster-capture.spec.ts",
        "--project=chromium",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          NEXT_PUBLIC_SITE_ENV: "preview",
          PLAYWRIGHT_EXTERNAL_SERVER: "0",
          POSTER_CAPTURE_PORT: "3317",
          POSTER_CAPTURE_MODE: mode,
          POSTER_OPERATION_ID: operationId,
          SCENE_CAPTURE: "1",
          SITE_ENV: "preview",
        },
        shell: false,
        stdio: "inherit",
      },
    );
    assertChildResult(result);

    if (mode === "write") {
      const contract = JSON.parse(
        await readFile(path.join(root, "assets/poster-contract.json"), "utf8"),
      );
      await publishPosterCandidates({
        contract,
        operationId,
        operationRoot,
        root,
      });
    }
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors = [];
  for (const cleanup of [
    () => rm(operationRoot, { force: true, recursive: true }),
    releaseLock,
  ]) {
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (operationError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [operationError, ...cleanupErrors],
      "Poster capture failed and cleanup was incomplete",
    );
  }
  if (operationError) throw operationError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Poster capture succeeded but cleanup was incomplete",
    );
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await runPosterCapture();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
