import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { verifyAssetPackages } from "../../scripts/assets/preflight.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/preflight-packages-test-${process.pid}`,
);
const manifest = {
  toolchain: {
    gltfTransform: "4.4.1",
    gltfValidator: "2.0.0-dev.3.10",
    meshoptimizer: "1.1.1",
    sharp: "0.35.3",
  },
};
const packageSpecs = [
  { name: "meshoptimizer", section: "dependencies", version: "1.1.1" },
  {
    name: "@gltf-transform/cli",
    section: "devDependencies",
    version: "4.4.1",
  },
  {
    name: "@gltf-transform/core",
    section: "devDependencies",
    version: "4.4.1",
  },
  {
    name: "@gltf-transform/extensions",
    section: "devDependencies",
    version: "4.4.1",
  },
  {
    name: "@gltf-transform/functions",
    section: "devDependencies",
    version: "4.4.1",
  },
  {
    name: "gltf-validator",
    section: "devDependencies",
    version: "2.0.0-dev.3.10",
  },
  { name: "sharp", section: "devDependencies", version: "0.35.3" },
];

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writePackageFixture() {
  await rm(tempRoot, { force: true, recursive: true });
  const packageJson = {
    dependencies: {},
    devDependencies: {},
    engines: { node: ">=22.15.0" },
  };
  const lockRoot = {
    dependencies: {},
    devDependencies: {},
    engines: { node: ">=22.15.0" },
  };
  const packageLock = {
    lockfileVersion: 3,
    packages: { "": lockRoot },
  };

  for (const spec of packageSpecs) {
    packageJson[spec.section][spec.name] = spec.version;
    lockRoot[spec.section][spec.name] = spec.version;
    packageLock.packages[`node_modules/${spec.name}`] = {
      version: spec.version,
      resolved: `https://registry.npmjs.org/${spec.name}/-/${path.basename(spec.name)}-${spec.version}.tgz`,
      integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
    };
    await writeJson(
      path.join(tempRoot, "node_modules", spec.name, "package.json"),
      { name: spec.name, version: spec.version },
    );
  }

  await writeJson(path.join(tempRoot, "package.json"), packageJson);
  await writeJson(path.join(tempRoot, "package-lock.json"), packageLock);
  return { packageJson, packageLock };
}

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("asset package verification accepts exact declarations, lock entries, and installs", async () => {
  await writePackageFixture();

  assert.deepEqual(
    await verifyAssetPackages({ root: tempRoot, manifest }),
    Object.fromEntries(packageSpecs.map(({ name, version }) => [name, version])),
  );
});

test("asset package verification requires the Zstandard-capable Node engine", async () => {
  const { packageJson } = await writePackageFixture();
  packageJson.engines.node = ">=22.13.0";
  await writeJson(path.join(tempRoot, "package.json"), packageJson);
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package\.json.*engines\.node.*22\.15\.0/i,
  );

  const { packageLock } = await writePackageFixture();
  packageLock.packages[""].engines.node = ">=22.14.0";
  await writeJson(path.join(tempRoot, "package-lock.json"), packageLock);
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package-lock\.json.*engines\.node.*22\.15\.0/i,
  );
});

test("asset package verification rejects declaration drift for every package", async () => {
  for (const spec of packageSpecs) {
    const { packageJson } = await writePackageFixture();
    packageJson[spec.section][spec.name] = `^${spec.version}`;
    await writeJson(path.join(tempRoot, "package.json"), packageJson);

    await assert.rejects(
      verifyAssetPackages({ root: tempRoot, manifest }),
      new RegExp(`package\\.json.*${escaped(spec.name)}`, "i"),
    );
  }

  const { packageJson } = await writePackageFixture();
  delete packageJson.dependencies.meshoptimizer;
  packageJson.devDependencies.meshoptimizer = "1.1.1";
  await writeJson(path.join(tempRoot, "package.json"), packageJson);
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package\.json.*meshoptimizer/i,
  );
});

test("asset package verification rejects missing or drifted lock resolution", async () => {
  for (const spec of packageSpecs) {
    const { packageLock } = await writePackageFixture();
    packageLock.packages[""][spec.section][spec.name] = `^${spec.version}`;
    await writeJson(path.join(tempRoot, "package-lock.json"), packageLock);

    await assert.rejects(
      verifyAssetPackages({ root: tempRoot, manifest }),
      new RegExp(`package-lock.*${escaped(spec.name)}`, "i"),
    );

    const refreshed = await writePackageFixture();
    refreshed.packageLock.packages[`node_modules/${spec.name}`].version =
      `${spec.version}-drift`;
    await writeJson(
      path.join(tempRoot, "package-lock.json"),
      refreshed.packageLock,
    );
    await assert.rejects(
      verifyAssetPackages({ root: tempRoot, manifest }),
      new RegExp(`package-lock.*${escaped(spec.name)}`, "i"),
    );
  }

  await writePackageFixture();
  await rm(path.join(tempRoot, "package-lock.json"));
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package-lock\.json.*missing|missing.*package-lock\.json/i,
  );

  const { packageLock } = await writePackageFixture();
  delete packageLock.packages["node_modules/meshoptimizer"];
  await writeJson(path.join(tempRoot, "package-lock.json"), packageLock);
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package-lock.*meshoptimizer/i,
  );

  const hostileResolution = await writePackageFixture();
  hostileResolution.packageLock.packages[
    "node_modules/meshoptimizer"
  ].resolved = "https://evil.invalid/meshoptimizer-1.1.1.tgz";
  await writeJson(
    path.join(tempRoot, "package-lock.json"),
    hostileResolution.packageLock,
  );
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package-lock.*meshoptimizer/i,
  );

  const malformedIntegrity = await writePackageFixture();
  malformedIntegrity.packageLock.packages[
    "node_modules/meshoptimizer"
  ].integrity = "not-an-sri";
  await writeJson(
    path.join(tempRoot, "package-lock.json"),
    malformedIntegrity.packageLock,
  );
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /package-lock.*meshoptimizer/i,
  );
});

test("asset package verification rejects missing or drifted top-level installs", async () => {
  for (const spec of packageSpecs) {
    await writePackageFixture();
    await writeJson(
      path.join(tempRoot, "node_modules", spec.name, "package.json"),
      { name: spec.name, version: `${spec.version}-drift` },
    );

    await assert.rejects(
      verifyAssetPackages({ root: tempRoot, manifest }),
      new RegExp(`installed.*${escaped(spec.name)}`, "i"),
    );
  }

  await writePackageFixture();
  await rm(path.join(tempRoot, "node_modules", "meshoptimizer"), {
    force: true,
    recursive: true,
  });
  await assert.rejects(
    verifyAssetPackages({ root: tempRoot, manifest }),
    /installed.*meshoptimizer/i,
  );
});
