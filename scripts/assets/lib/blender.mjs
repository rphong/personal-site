import { statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as zlib from "node:zlib";

export const BLENDER_VERSION = "3.6.23";
export const BLENDER_VERSION_TIMEOUT_MS = 30_000;
export const BLENDER_SCRIPT_TIMEOUT_MS = 30 * 60 * 1000;
export const MAX_BLEND_DECOMPRESSED_BYTES = 64 * 1024 * 1024;
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function isRegularFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function resolveBlenderBin({
  root = process.cwd(),
  env = process.env,
  exists = isRegularFile,
} = {}) {
  const override = env.BLENDER_BIN?.trim();
  if (override) {
    const resolvedOverride = path.resolve(override);
    if (!exists(resolvedOverride)) {
      throw new Error(
        `BLENDER_BIN must point to an existing regular file: ${resolvedOverride}`,
      );
    }
    return resolvedOverride;
  }

  const portable = path.resolve(
    root,
    ".tools/blender-3.6.23-windows-x64/blender.exe",
  );
  if (!exists(portable)) {
    throw new Error("Blender 3.6.23 was not found. Run npm run assets:bootstrap or set BLENDER_BIN to the exact portable executable.");
  }
  return portable;
}

export function parseBlenderVersion(stdout) {
  const match = /^Blender (\d+\.\d+\.\d+)/m.exec(stdout);
  if (!match || match[1] !== BLENDER_VERSION) {
    throw new Error(`Expected Blender ${BLENDER_VERSION}; received ${match?.[1] ?? "unparseable output"}.`);
  }
  return match[1];
}

export function parseBlendHeader(buffer) {
  let contents = buffer;
  if (buffer.subarray(0, ZSTD_MAGIC.length).equals(ZSTD_MAGIC)) {
    if (typeof zlib.zstdDecompressSync !== "function") {
      throw new Error(
        "Zstandard-compressed Blender sources require Node 22.15.0 or newer",
      );
    }
    try {
      contents = zlib.zstdDecompressSync(buffer, {
        maxOutputLength: MAX_BLEND_DECOMPRESSED_BYTES,
      });
    } catch (error) {
      throw new Error(`Invalid Zstandard-compressed Blender file: ${error.message}`, {
        cause: error,
      });
    }
  }
  const header = contents.subarray(0, 12).toString("ascii");
  if (!/^BLENDER[-_][vV]\d{3}$/.test(header)) {
    throw new Error(`Invalid Blender file header: ${JSON.stringify(header)}`);
  }
  const digits = header.slice(-3);
  return `${Number(digits.slice(0, 1))}.${Number(digits.slice(1))}`;
}

function spawnFailure(result, timeoutMs) {
  if (!result || typeof result !== "object") {
    return "did not return a process result";
  }
  if (result.error?.code === "ETIMEDOUT") {
    return `timed out after ${timeoutMs} ms: ${result.error.message}`;
  }
  if (result.error) {
    return `could not start: ${result.error.message}`;
  }
  if (result.signal) {
    return `terminated by signal ${result.signal}`;
  }
  if (result.status === null || result.status === undefined) {
    return "terminated without an exit status";
  }
  return null;
}

export function checkBlenderVersion(blenderBin, run = spawnSync) {
  const result = run(blenderBin, ["--version"], {
    encoding: "utf8",
    timeout: BLENDER_VERSION_TIMEOUT_MS,
  });
  const failure = spawnFailure(result, BLENDER_VERSION_TIMEOUT_MS);
  if (failure) {
    throw new Error(`Could not execute ${blenderBin}: ${failure}`);
  }
  if (result.status !== 0) {
    throw new Error(`Could not execute ${blenderBin}: ${result.stderr || result.stdout}`);
  }
  return parseBlenderVersion(result.stdout);
}

export function buildBlenderArgs({ blendFile, script, scriptArgs = [] }) {
  const args = ["--factory-startup", "--disable-autoexec", "--background"];
  if (blendFile) args.push(blendFile);
  args.push("--python-exit-code", "1", "--python", script, "--", ...scriptArgs);
  return args;
}

export function runBlenderScript({
  blenderBin,
  blendFile,
  script,
  scriptArgs = [],
  cwd = process.cwd(),
  run = spawnSync,
}) {
  const args = buildBlenderArgs({ blendFile, script, scriptArgs });
  const result = run(blenderBin, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: BLENDER_SCRIPT_TIMEOUT_MS,
  });
  const failure = spawnFailure(result, BLENDER_SCRIPT_TIMEOUT_MS);
  if (failure) {
    throw new Error(`Blender script failed: ${failure}`);
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Blender script failed (${result.status}): ${detail}`);
  }
  return result.stdout;
}
