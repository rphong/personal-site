import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runPosterCapture } from "../../scripts/posters/capture.mjs";
import { posterOperationRoot } from "../../scripts/posters/pipeline.mjs";

const PLAYWRIGHT_CLI = fileURLToPath(
  import.meta.resolve("@playwright/test/cli"),
);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fixture(prefix = "poster-capture-runner-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const canonicalRoot = path.join(root, "public/posters");
  await mkdir(canonicalRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(canonicalRoot, "home-hero-desktop.webp"),
      "canonical-desktop",
    ),
    writeFile(
      path.join(canonicalRoot, "poster-manifest.json"),
      "canonical-manifest",
    ),
  ]);
  return { canonicalRoot, root };
}

async function assertCleaned(root, operationId) {
  assert.equal(
    await exists(posterOperationRoot({ root, operationId })),
    false,
    "operation staging directory should be removed",
  );
  assert.equal(
    await exists(path.join(root, ".tmp/posters/posters.lock")),
    false,
    "poster pipeline lock should be released",
  );
}

test("check mode launches the pinned Playwright test without publishing candidates", async () => {
  const state = await fixture();
  let invocation;
  try {
    await runPosterCapture({
      argument: "--check",
      root: state.root,
      spawn(command, arguments_, options) {
        invocation = { arguments_, command, options };
        const candidateRoot = path.join(
          posterOperationRoot({
            root: state.root,
            operationId: options.env.POSTER_OPERATION_ID,
          }),
          "candidates",
        );
        mkdirSync(candidateRoot, { recursive: true });
        writeFileSync(
          path.join(candidateRoot, "home-hero-desktop.webp"),
          "unchecked-candidate",
        );
        writeFileSync(
          path.join(candidateRoot, "home-hero-mobile.webp"),
          "new-only-candidate",
        );
        writeFileSync(
          path.join(candidateRoot, "poster-manifest.json"),
          "unchecked-manifest",
        );
        return { error: undefined, signal: null, status: 0 };
      },
    });

    assert.ok(invocation);
    assert.equal(invocation.command, process.execPath);
    assert.deepEqual(invocation.arguments_, [
      PLAYWRIGHT_CLI,
      "test",
      "tests/browser/poster-capture.spec.ts",
      "--project=chromium",
    ]);
    assert.equal(invocation.options.cwd, state.root);
    assert.equal(invocation.options.shell, false);
    assert.equal(invocation.options.stdio, "inherit");
    assert.equal(invocation.options.env.POSTER_CAPTURE_MODE, "check");
    assert.equal(invocation.options.env.NEXT_PUBLIC_SITE_ENV, "preview");
    assert.equal(invocation.options.env.PLAYWRIGHT_EXTERNAL_SERVER, "0");
    assert.equal(invocation.options.env.POSTER_CAPTURE_PORT, "3317");
    assert.equal(invocation.options.env.SCENE_CAPTURE, "1");
    assert.equal(invocation.options.env.SITE_ENV, "preview");
    assert.match(
      invocation.options.env.POSTER_OPERATION_ID,
      new RegExp(`^${process.pid}-[a-f0-9-]{36}$`, "i"),
    );

    assert.equal(
      await readFile(
        path.join(state.canonicalRoot, "home-hero-desktop.webp"),
        "utf8",
      ),
      "canonical-desktop",
    );
    assert.equal(
      await readFile(
        path.join(state.canonicalRoot, "poster-manifest.json"),
        "utf8",
      ),
      "canonical-manifest",
    );
    await assert.rejects(
      readFile(path.join(state.canonicalRoot, "home-hero-mobile.webp")),
      { code: "ENOENT" },
    );
    await assertCleaned(
      state.root,
      invocation.options.env.POSTER_OPERATION_ID,
    );
  } finally {
    await rm(state.root, { force: true, recursive: true });
  }
});

for (const scenario of [
  {
    name: "non-zero exit status",
    result: { error: undefined, signal: null, status: 9 },
    pattern: /exited with status 9/,
  },
  {
    name: "termination signal",
    result: { error: undefined, signal: "SIGTERM", status: null },
    pattern: /terminated by SIGTERM/,
  },
]) {
  test(`propagates ${scenario.name} and cleans staging state`, async () => {
    const state = await fixture(`poster-capture-${scenario.name.replaceAll(" ", "-")}-`);
    let operationId;
    try {
      await assert.rejects(
        runPosterCapture({
          argument: "--check",
          root: state.root,
          spawn(_command, _arguments, options) {
            operationId = options.env.POSTER_OPERATION_ID;
            return scenario.result;
          },
        }),
        scenario.pattern,
      );
      assert.ok(operationId);
      await assertCleaned(state.root, operationId);
    } finally {
      await rm(state.root, { force: true, recursive: true });
    }
  });
}

test("propagates spawn errors with their cause and cleans staging state", async () => {
  const state = await fixture("poster-capture-spawn-error-");
  const childError = new Error("spawnSync ENOENT");
  let operationId;
  try {
    await assert.rejects(
      runPosterCapture({
        argument: "--check",
        root: state.root,
        spawn(_command, _arguments, options) {
          operationId = options.env.POSTER_OPERATION_ID;
          return { error: childError, signal: null, status: null };
        },
      }),
      (error) => {
        assert.match(error.message, /Failed to launch the pinned Playwright CLI/);
        assert.equal(error.cause, childError);
        return true;
      },
    );
    assert.ok(operationId);
    await assertCleaned(state.root, operationId);
  } finally {
    await rm(state.root, { force: true, recursive: true });
  }
});
