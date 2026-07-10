import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildBlenderArgs,
  checkBlenderVersion,
  parseBlendHeader,
  parseBlenderVersion,
  resolveBlenderBin,
} from "../../scripts/assets/lib/blender.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, ".tmp/assets/blender-toolchain-test");

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

test("Blender binary resolution prefers BLENDER_BIN and requires an existing file", async () => {
  await mkdir(tempRoot, { recursive: true });
  const explicit = path.join(tempRoot, "custom-blender.exe");
  await writeFile(explicit, "fixture");

  assert.equal(
    resolveBlenderBin({ root, env: { BLENDER_BIN: explicit } }),
    explicit,
  );
  assert.throws(
    () => resolveBlenderBin({ root: tempRoot, env: {} }),
    /Run npm run assets:bootstrap/,
  );
});

test("version and blend-header parsers accept only the pinned generation", () => {
  assert.equal(parseBlenderVersion("Blender 3.6.23\n"), "3.6.23");
  assert.equal(parseBlendHeader(Buffer.from("BLENDER-v305extra")), "3.5");
  assert.equal(parseBlendHeader(Buffer.from("BLENDER-v306extra")), "3.6");
  assert.throws(() => parseBlenderVersion("Blender 4.5.0\n"), /Expected Blender 3.6.23/);
  assert.throws(() => parseBlendHeader(Buffer.from("not-a-blend")), /Invalid Blender file header/);
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
  assert.equal(
    checkBlenderVersion("blender.exe", () => ({ status: 0, stdout: "Blender 3.6.23\n", stderr: "" })),
    "3.6.23",
  );
  assert.throws(
    () => checkBlenderVersion("blender.exe", () => ({ status: 0, stdout: "Blender 3.6.22\n", stderr: "" })),
    /Expected Blender 3.6.23/,
  );
});
