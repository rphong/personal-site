import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSourceManifest, sha256File } from "./lib/manifest.mjs";
import {
  checkBlenderVersion,
  parseBlendHeader,
  resolveBlenderBin,
} from "./lib/blender.mjs";

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export async function runPreflight({ root = process.cwd(), allowGeneratedMissing = false, env = process.env } = {}) {
  if (compareVersions(process.versions.node, "22.13.0") < 0) {
    throw new Error(`Node 22.13.0 or newer is required; received ${process.versions.node}.`);
  }

  const manifest = await loadSourceManifest({ root });
  const froggieReference = path.join(root, manifest.froggieCapture.source);
  const [froggieStats, froggieSha256] = await Promise.all([
    stat(froggieReference),
    sha256File(froggieReference),
  ]);
  if (
    froggieStats.size !== manifest.froggieCapture.bytes ||
    froggieSha256 !== manifest.froggieCapture.sha256
  ) {
    throw new Error(
      "Froggie gameplay reference changed. Review the new crop, then intentionally update froggieCapture bytes and SHA-256 before replacement.",
    );
  }
  const blenderBin = resolveBlenderBin({ root, env });
  checkBlenderVersion(blenderBin);

  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const expectedPackages = {
    "@gltf-transform/cli": manifest.toolchain.gltfTransform,
    "@gltf-transform/core": manifest.toolchain.gltfTransform,
    "@gltf-transform/extensions": manifest.toolchain.gltfTransform,
    "@gltf-transform/functions": manifest.toolchain.gltfTransform,
    "gltf-validator": manifest.toolchain.gltfValidator,
    "meshoptimizer": manifest.toolchain.meshoptimizer,
    "sharp": manifest.toolchain.sharp,
  };
  for (const [name, version] of Object.entries(expectedPackages)) {
    const actual = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
    if (actual !== version) throw new Error(`${name} must be pinned to ${version}; received ${actual ?? "missing"}.`);
  }

  const pending = [];
  for (const model of manifest.models) {
    const sourcePath = path.join(root, model.source);
    let header;
    try {
      header = await readFile(sourcePath);
    } catch (error) {
      if (error.code === "ENOENT" && model.generator && allowGeneratedMissing) {
        pending.push(model.source);
        continue;
      }
      throw new Error(`Required source is missing: ${model.source}`);
    }
    const authoredVersion = parseBlendHeader(header);
    if (compareVersions(authoredVersion, "3.6") > 0) {
      throw new Error(`${model.source} was authored by Blender ${authoredVersion}, newer than the pinned exporter.`);
    }
  }

  return { blenderBin, manifest, pending };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const allowGeneratedMissing = process.argv.includes("--allow-generated-missing");
  try {
    const result = await runPreflight({ allowGeneratedMissing });
    for (const source of result.pending) console.log(`pending generated source: ${source}`);
    console.log(`asset preflight ok: Blender ${result.manifest.toolchain.blender.version}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
