import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const BLENDER_VERSION = "3.6.23";

export function resolveBlenderBin({ root = process.cwd(), env = process.env, exists = existsSync } = {}) {
  const candidates = [
    env.BLENDER_BIN,
    path.join(root, ".tools/blender-3.6.23-windows-x64/blender.exe"),
  ].filter(Boolean).map((candidate) => path.resolve(candidate));
  const resolved = candidates.find((candidate) => exists(candidate));
  if (!resolved) {
    throw new Error("Blender 3.6.23 was not found. Run npm run assets:bootstrap or set BLENDER_BIN to the exact portable executable.");
  }
  return resolved;
}

export function parseBlenderVersion(stdout) {
  const match = /^Blender (\d+\.\d+\.\d+)/m.exec(stdout);
  if (!match || match[1] !== BLENDER_VERSION) {
    throw new Error(`Expected Blender ${BLENDER_VERSION}; received ${match?.[1] ?? "unparseable output"}.`);
  }
  return match[1];
}

export function parseBlendHeader(buffer) {
  const header = buffer.subarray(0, 12).toString("ascii");
  if (!/^BLENDER[-_]?[vV]\d{3}$/.test(header)) {
    throw new Error(`Invalid Blender file header: ${JSON.stringify(header)}`);
  }
  const digits = header.slice(-3);
  return `${Number(digits.slice(0, 1))}.${Number(digits.slice(1))}`;
}

export function checkBlenderVersion(blenderBin, run = (command, args) => spawnSync(command, args, { encoding: "utf8" })) {
  const result = run(blenderBin, ["--version"]);
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

export function runBlenderScript({ blenderBin, blendFile, script, scriptArgs = [], cwd = process.cwd() }) {
  const args = buildBlenderArgs({ blendFile, script, scriptArgs });
  const result = spawnSync(blenderBin, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Blender script failed (${result.status}): ${detail}`);
  }
  return result.stdout;
}
