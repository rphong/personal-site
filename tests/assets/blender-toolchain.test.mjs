import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { zstdCompressSync } from "node:zlib";

import {
  buildBlenderArgs,
  checkBlenderVersion,
  parseBlendHeader,
  parseBlenderVersion,
  resolveBlenderBin,
  runBlenderScript,
} from "../../scripts/assets/lib/blender.mjs";
import { assertAssetNodeRuntime } from "../../scripts/assets/preflight.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/blender-toolchain-test-${process.pid}`,
);

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("bootstrap pins the official Blender archive URL and digest", async () => {
  const source = await readFile(path.join(root, "scripts/assets/bootstrap-blender.ps1"), "utf8");
  const officialUrl = "https://download.blender.org/release/Blender3.6/blender-3.6.23-windows-x64.zip";
  const fallbackUrl = "https://mirror.freedif.org/blender/release/Blender3.6/blender-3.6.23-windows-x64.zip";

  assert.match(source, /blender-3\.6\.23-windows-x64\.zip/);
  assert.ok(source.includes(officialUrl));
  assert.ok(source.includes(fallbackUrl));
  assert.ok(source.indexOf(officialUrl) < source.indexOf(fallbackUrl));
  assert.match(source, /388356346/);
  assert.match(source, /e3296eba7eab32c2e5182459ec7614af32224eee2bd32c9d0a08ffd751c54f3b/);
});

test("Blender binary resolution fails closed on an invalid BLENDER_BIN", async () => {
  const local = path.join(
    tempRoot,
    ".tools/blender-3.6.23-windows-x64/blender.exe",
  );
  await mkdir(path.dirname(local), { recursive: true });
  await writeFile(local, "fixture");

  const explicit = path.join(tempRoot, "custom-blender.exe");
  await writeFile(explicit, "fixture");
  assert.equal(
    resolveBlenderBin({ root: tempRoot, env: { BLENDER_BIN: explicit } }),
    explicit,
  );

  const missing = path.join(tempRoot, "missing-blender.exe");
  assert.throws(
    () =>
      resolveBlenderBin({
        root: tempRoot,
        env: { BLENDER_BIN: missing },
      }),
    /BLENDER_BIN.*existing regular file/i,
  );

  const directory = path.join(tempRoot, "blender-directory");
  await mkdir(directory);
  assert.throws(
    () =>
      resolveBlenderBin({
        root: tempRoot,
        env: { BLENDER_BIN: directory },
      }),
    /BLENDER_BIN.*existing regular file/i,
  );

  assert.equal(resolveBlenderBin({ root: tempRoot, env: {} }), local);
  assert.equal(
    resolveBlenderBin({ root: tempRoot, env: { BLENDER_BIN: "   " } }),
    local,
  );
  assert.equal(
    resolveBlenderBin({
      root: tempRoot,
      env: {},
      exists: (candidate) => candidate === local,
    }),
    local,
  );

  await rm(local);
  assert.throws(
    () => resolveBlenderBin({ root: tempRoot, env: {} }),
    /Run npm run assets:bootstrap/,
  );

  await mkdir(local);
  assert.throws(
    () => resolveBlenderBin({ root: tempRoot, env: {} }),
    /Run npm run assets:bootstrap/,
  );
});

test("version and blend-header parsers accept only the pinned generation", () => {
  assert.equal(parseBlenderVersion("Blender 3.6.23\n"), "3.6.23");
  assert.equal(parseBlendHeader(Buffer.from("BLENDER-v305extra")), "3.5");
  assert.equal(parseBlendHeader(Buffer.from("BLENDER_V306extra")), "3.6");
  assert.equal(
    parseBlendHeader(zstdCompressSync(Buffer.from("BLENDER-v306extra"))),
    "3.6",
  );
  assert.throws(
    () => parseBlendHeader(Buffer.concat([
      Buffer.from([0x28, 0xb5, 0x2f, 0xfd]),
      Buffer.from("malformed"),
    ])),
    /Invalid Zstandard-compressed Blender file/,
  );
  assert.throws(() => parseBlenderVersion("Blender 4.5.0\n"), /Expected Blender 3.6.23/);
  assert.throws(() => parseBlendHeader(Buffer.from("BLENDERv306")), /Invalid Blender file header/);
  assert.throws(() => parseBlendHeader(Buffer.from("BLENDERxv306extra")), /Invalid Blender file header/);
  assert.throws(() => parseBlendHeader(Buffer.from("not-a-blend")), /Invalid Blender file header/);
});

test("asset runtime requires Node with native Zstandard support", () => {
  assert.doesNotThrow(() =>
    assertAssetNodeRuntime({ version: "22.15.0", zstdAvailable: true }),
  );
  assert.throws(
    () => assertAssetNodeRuntime({ version: "22.14.0", zstdAvailable: true }),
    /Node 22\.15\.0 or newer/,
  );
  assert.throws(
    () => assertAssetNodeRuntime({ version: "24.0.0", zstdAvailable: false }),
    /Zstandard support/,
  );
});

test("background Blender arguments disable auto-execution and preserve script arguments", () => {
  assert.deepEqual(
    buildBlenderArgs({
      blendFile: "assets/blender/Crane.blend",
      script: "scripts/assets/blender/inspect_scene.py",
      scriptArgs: ["--report", ".tmp/report.json"],
    }),
    [
      "--factory-startup",
      "--disable-autoexec",
      "--background",
      "assets/blender/Crane.blend",
      "--python-exit-code",
      "1",
      "--python",
      "scripts/assets/blender/inspect_scene.py",
      "--",
      "--report",
      ".tmp/report.json",
    ],
  );
});

test("version check rejects any executable that is not exactly 3.6.23", () => {
  let spawnOptions;
  assert.equal(
    checkBlenderVersion("blender.exe", (_command, _args, options) => {
      spawnOptions = options;
      return { status: 0, stdout: "Blender 3.6.23\n", stderr: "" };
    }),
    "3.6.23",
  );
  assert.equal(spawnOptions.timeout, 30_000);
  assert.throws(
    () => checkBlenderVersion("blender.exe", () => ({ status: 0, stdout: "Blender 3.6.22\n", stderr: "" })),
    /Expected Blender 3.6.23/,
  );
});

test("Blender process helpers report launch errors, signals, and timeouts", () => {
  const launchError = Object.assign(new Error("spawn exploded"), {
    code: "ENOENT",
  });
  const timeoutError = Object.assign(new Error("operation timed out"), {
    code: "ETIMEDOUT",
  });

  assert.throws(
    () =>
      checkBlenderVersion("blender.exe", () => ({
        error: launchError,
        status: null,
        signal: null,
        stderr: "",
        stdout: "",
      })),
    /spawn exploded/,
  );
  assert.throws(
    () =>
      checkBlenderVersion("blender.exe", () => ({
        status: null,
        signal: "SIGTERM",
        stderr: "",
        stdout: "",
      })),
    /signal SIGTERM/,
  );
  assert.throws(
    () =>
      checkBlenderVersion("blender.exe", () => ({
        error: timeoutError,
        status: null,
        signal: "SIGTERM",
        stderr: "",
        stdout: "",
      })),
    /timed out after 30000 ms/,
  );

  let scriptSpawnOptions;
  assert.equal(
    runBlenderScript({
      blenderBin: "blender.exe",
      script: "script.py",
      run: (_command, _args, options) => {
        scriptSpawnOptions = options;
        return {
          status: 0,
          signal: null,
          stderr: "",
          stdout: "script complete",
        };
      },
    }),
    "script complete",
  );
  assert.equal(scriptSpawnOptions.timeout, 30 * 60 * 1000);

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin: "blender.exe",
        script: "script.py",
        run: () => ({
          error: launchError,
          status: null,
          signal: null,
          stderr: "",
          stdout: "",
        }),
      }),
    /spawn exploded/,
  );
  assert.throws(
    () =>
      runBlenderScript({
        blenderBin: "blender.exe",
        script: "script.py",
        run: () => ({
          status: null,
          signal: "SIGKILL",
          stderr: "",
          stdout: "",
        }),
      }),
    /signal SIGKILL/,
  );
});
