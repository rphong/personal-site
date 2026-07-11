import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as zlib from "node:zlib";

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

export const ASSET_NODE_MIN_VERSION = "22.15.0";

export function assertAssetNodeRuntime({
  version = process.versions.node,
  zstdAvailable = typeof zlib.zstdDecompressSync === "function",
} = {}) {
  if (compareVersions(version, ASSET_NODE_MIN_VERSION) < 0) {
    throw new Error(
      `Node ${ASSET_NODE_MIN_VERSION} or newer is required for compressed Blender sources; received ${version}.`,
    );
  }
  if (!zstdAvailable) {
    throw new Error(
      `Node ${ASSET_NODE_MIN_VERSION} or newer with Zstandard support is required for compressed Blender sources.`,
    );
  }
}

function assetPackageSpecs(manifest) {
  return [
    {
      name: "meshoptimizer",
      section: "dependencies",
      version: manifest.toolchain.meshoptimizer,
    },
    {
      name: "@gltf-transform/cli",
      section: "devDependencies",
      version: manifest.toolchain.gltfTransform,
    },
    {
      name: "@gltf-transform/core",
      section: "devDependencies",
      version: manifest.toolchain.gltfTransform,
    },
    {
      name: "@gltf-transform/extensions",
      section: "devDependencies",
      version: manifest.toolchain.gltfTransform,
    },
    {
      name: "@gltf-transform/functions",
      section: "devDependencies",
      version: manifest.toolchain.gltfTransform,
    },
    {
      name: "gltf-validator",
      section: "devDependencies",
      version: manifest.toolchain.gltfValidator,
    },
    {
      name: "sharp",
      section: "devDependencies",
      version: manifest.toolchain.sharp,
    },
  ];
}

function npmArchiveUrl(name, version) {
  const archiveName = name.split("/").at(-1);
  return `https://registry.npmjs.org/${name}/-/${archiveName}-${version}.tgz`;
}

function isSha512Integrity(value) {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(value ?? "");
  return Boolean(match && Buffer.from(match[1], "base64").length === 64);
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readRequiredJson({ filePath, label, readJson }) {
  try {
    return await readJson(filePath);
  } catch (error) {
    throw new Error(
      `Asset preflight: ${label} is missing or invalid: ${error.message}`,
      { cause: error },
    );
  }
}

export async function verifyAssetPackages({
  root = process.cwd(),
  manifest,
  readJson = readJsonFile,
} = {}) {
  const specs = assetPackageSpecs(manifest);
  const packageJson = await readRequiredJson({
    filePath: path.join(root, "package.json"),
    label: "package.json",
    readJson,
  });
  const packageLock = await readRequiredJson({
    filePath: path.join(root, "package-lock.json"),
    label: "package-lock.json",
    readJson,
  });
  const lockRoot = packageLock.packages?.[""];
  if (!lockRoot) {
    throw new Error(
      "Asset preflight: package-lock.json is missing its root package entry",
    );
  }

  const expectedNodeEngine = `>=${ASSET_NODE_MIN_VERSION}`;
  if (packageJson.engines?.node !== expectedNodeEngine) {
    throw new Error(
      `Asset preflight: package.json engines.node must be exactly ${expectedNodeEngine}`,
    );
  }
  if (lockRoot.engines?.node !== expectedNodeEngine) {
    throw new Error(
      `Asset preflight: package-lock.json root engines.node must be exactly ${expectedNodeEngine}`,
    );
  }

  const verified = {};
  for (const { name, section, version } of specs) {
    const otherSection =
      section === "dependencies" ? "devDependencies" : "dependencies";
    const declared = packageJson[section]?.[name];
    if (
      declared !== version ||
      Object.hasOwn(packageJson[otherSection] ?? {}, name)
    ) {
      throw new Error(
        `Asset preflight: package.json declaration for ${name} must be exactly ${version} in ${section}`,
      );
    }

    const lockDeclared = lockRoot[section]?.[name];
    if (
      lockDeclared !== version ||
      Object.hasOwn(lockRoot[otherSection] ?? {}, name)
    ) {
      throw new Error(
        `Asset preflight: package-lock.json root declaration for ${name} must be exactly ${version} in ${section}`,
      );
    }

    const lockEntry = packageLock.packages?.[`node_modules/${name}`];
    if (lockEntry?.version !== version) {
      throw new Error(
        `Asset preflight: package-lock.json direct resolution for ${name} must be exactly ${version}`,
      );
    }
    if (
      lockEntry.link === true ||
      lockEntry.resolved !== npmArchiveUrl(name, version) ||
      !isSha512Integrity(lockEntry.integrity)
    ) {
      throw new Error(
        `Asset preflight: package-lock.json direct resolution for ${name} must use the exact integrity-checked npm registry archive`,
      );
    }

    const installed = await readRequiredJson({
      filePath: path.join(root, "node_modules", name, "package.json"),
      label: `installed package ${name} package.json`,
      readJson,
    });
    if (installed.version !== version) {
      throw new Error(
        `Asset preflight: installed package ${name} must be exactly ${version}; received ${installed.version ?? "missing"}`,
      );
    }
    verified[name] = version;
  }

  return verified;
}

export async function runPreflight({ root = process.cwd(), allowGeneratedMissing = false, env = process.env } = {}) {
  assertAssetNodeRuntime();

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
  await verifyAssetPackages({ root, manifest });

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
