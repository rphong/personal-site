import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createPublicationCandidates,
  runAssetPipeline,
} from "../../scripts/assets/build-all.mjs";
import { createVinextInvocation } from "../../scripts/run-vinext.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("asset pipeline runs the five stages in strict order", async () => {
  const called = [];
  const makeStep = (name) => async () => {
    called.push(name);
  };
  const result = await runAssetPipeline({
    exporter: makeStep("export"),
    optimizer: makeStep("optimize"),
    preflight: makeStep("preflight"),
    textureRenderer: makeStep("textures"),
    validator: makeStep("validate"),
  });
  assert.deepEqual(called, [
    "preflight",
    "textures",
    "export",
    "optimize",
    "validate",
  ]);
  assert.deepEqual(result, called);
});

test("asset pipeline rejects a concurrent regeneration and releases its lock", async () => {
  let allowFirstToFinish;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => {
    firstStarted = resolve;
  });
  const firstGate = new Promise((resolve) => {
    allowFirstToFinish = resolve;
  });
  const makeStep = () => async () => undefined;
  const first = runAssetPipeline({
    exporter: makeStep(),
    operationId: "repository-hygiene-lock-first",
    optimizer: makeStep(),
    preflight: async () => {
      firstStarted();
      await firstGate;
    },
    root,
    textureRenderer: makeStep(),
    validator: makeStep(),
  });
  await firstStartedPromise;
  await assert.rejects(
    runAssetPipeline({
      exporter: makeStep(),
      operationId: "repository-hygiene-lock-second",
      optimizer: makeStep(),
      preflight: makeStep(),
      root,
      textureRenderer: makeStep(),
      validator: makeStep(),
    }),
    /already running/,
  );
  allowFirstToFinish();
  await first;

  await assert.rejects(
    access(path.join(root, ".tmp/assets/assets-all.lock")),
    { code: "ENOENT" },
  );
});

test("asset pipeline removes staged files after validation fails", async () => {
  const operationId = "repository-hygiene-cleanup";
  const stagingRoot = path.join(root, ".tmp/assets/publish", operationId);
  const makeStep = () => async () => undefined;
  await assert.rejects(
    runAssetPipeline({
      exporter: makeStep(),
      operationId,
      optimizer: async () => {
        await mkdir(stagingRoot, { recursive: true });
        await writeFile(path.join(stagingRoot, "fixture"), "temporary");
      },
      preflight: makeStep(),
      root,
      textureRenderer: makeStep(),
      validator: async () => {
        throw new Error("injected validation failure");
      },
    }),
    /injected validation failure/,
  );
  await assert.rejects(access(stagingRoot), { code: "ENOENT" });
});

test("staged publication binds all seven GLBs and their manifest as one batch", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "assets/scene-sources.json"), "utf8"),
  );
  const stagedModelRoot = path.join(root, ".tmp/assets/publish-fixture/models");
  const candidates = createPublicationCandidates({
    manifest,
    root,
    stagedModelRoot,
  });
  assert.equal(candidates.length, 8);
  assert.deepEqual(
    candidates.map((candidate) =>
      path.relative(root, candidate.outputPath).replaceAll("\\", "/"),
    ),
    [
      ...manifest.models.map((model) => model.output),
      "public/models/assets-manifest.json",
    ],
  );
});

test("package scripts expose one regeneration path and validate production builds", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["assets:all"], "node scripts/assets/build-all.mjs");
  assert.equal(
    pkg.scripts["assets:manifest"],
    "node scripts/assets/validate.mjs --write-manifest",
  );
  assert.equal(pkg.scripts["assets:validate"], "node scripts/assets/validate.mjs");
  assert.equal(pkg.scripts.dev, "node scripts/run-vinext.mjs dev");
  assert.equal(pkg.scripts.start, "node scripts/run-vinext.mjs start");
  assert.equal(
    pkg.scripts.build,
    "node scripts/assets/validate.mjs && node scripts/run-vinext.mjs build",
  );
});

test("Vinext launches the pinned local CLI without a command shell", () => {
  const invocation = createVinextInvocation({
    cwd: root,
    env: { FIXTURE_ENV: "present" },
    forwarded: ["--fixture"],
    mode: "build",
  });
  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args.slice(-2), ["build", "--fixture"]);
  assert.equal(invocation.options.cwd, root);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.env.FIXTURE_ENV, "present");
  assert.equal(
    invocation.options.env.WRANGLER_LOG_PATH,
    path.join(root, ".wrangler/wrangler.log"),
  );
});

test("forbidden Blender backups, binaries, and intermediates are not tracked", () => {
  const git = process.env.GIT_EXECUTABLE ?? "git";
  const result = spawnSync(git, ["ls-files"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const tracked = result.stdout.split(/\r?\n/).filter(Boolean);
  const forbidden = tracked.filter(
    (file) =>
      file.endsWith(".blend1") ||
      file.endsWith(".raw.glb") ||
      file.endsWith("blender.exe") ||
      file.startsWith(".tools/") ||
      file.startsWith(".tmp/assets/") ||
      file.includes("RocketExportParticle") ||
      file.includes("CraneIntepreter") ||
      file.includes("CubeAnimation"),
  );
  assert.deepEqual(forbidden, []);
});
