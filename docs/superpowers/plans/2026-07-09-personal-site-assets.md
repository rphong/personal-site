# Personal Site 3D Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, test-first offline pipeline that imports Richard's selected Blender sources, remediates the League workstation textures, authors the Froggie display, exports optimized GLBs, and emits validated manifests for the website runtime.

**Architecture:** An authored JSON manifest maps canonical `.blend` sources to runtime model keys and budgets. A pinned portable Blender 3.6.23 process performs explicit curation and read-only GLB export, after which Node scripts optimize with glTF Transform, validate with Khronos' validator, and atomically publish GLBs plus deterministic metadata. This plan establishes poster source inputs and a capture contract; the persistent Three.js runtime plan owns browser capture and final poster files.

**Tech Stack:** PowerShell 7-compatible scripts, Blender 3.6.23 Python API, Node.js 22.13+, `@gltf-transform/*` 4.4.1, `gltf-validator` 2.0.0-dev.3.10, `meshoptimizer` 1.1.1, `sharp` 0.35.3, and Node's built-in test runner.

## Global Constraints

- Use the exact Windows portable archive `blender-3.6.23-windows-x64.zip`; verify SHA-256 `e3296eba7eab32c2e5182459ec7614af32224eee2bd32c9d0a08ffd751c54f3b` before extraction.
- Keep canonical sources under `assets/blender/`; commit no `.blend1`, Blender executable, download archive, cache, temporary render, or raw intermediate GLB.
- Automated export opens canonical `.blend` files with auto-execution disabled and never saves them. Only the explicit one-time curation and Froggie authoring commands may save canonical Blender files.
- Export meshes, materials, rigs, and clips beneath exactly one `WEB_EXPORT_ROOT`. Do not export Blender cameras or lights; the website scene registry remains authoritative for framing and lighting.
- Treat Blender receiver planes as authoring helpers, not website ground: explicit curation removes only exact `Shadow Catcher` / `Plane.001` nodes and Rocket `Ground` / `Plane`, while retaining `Paper plane`, decorative furniture, and `RocketSmokeGroundBaked`. Bind that cleanup to versioned source provenance; the runtime owns any transparent contact/blob shadow.
- Publish binary GLB only. Every GLB must be smaller than 25 MiB; the Home crane must be smaller than 2 MiB; every other v1 GLB must be smaller than 5 MiB.
- Apply Meshopt compression at `medium` level. Convert embedded raster textures to WebP at a maximum of 1024 by 1024 pixels. Do not introduce KTX2 until a measured runtime result justifies its additional encoder and decoder.
- `CraneOnLeague.blend` may contain exactly the two repository-owned abstract UI screen textures declared by name and path in `assets/scene-sources.json`. Source inspection must hash those two packed PNG payloads; optimized-GLB inspection must require the same two image names and record their WebP payload hashes in the committed model manifest. Do not ship Riot champion art, item art, official logos, or the missing historical Figma raster files. `Rocket.blend` must remain an original rocket diorama: no NASA meatball, worm, seal, logotype, or other official NASA raster/vector asset may survive source curation or GLB export.
- `FroggieDisplay.blend` must be a canonical live Blender scene with the supplied gameplay screenshot embedded on its screen; a CSS or Three.js primitive substitute does not satisfy the requirement.
- Preserve every exported animation clip, but leave playback to the runtime plan. `CraneWorkout.blend` must export at least one named clip.
- Generated manifests contain stable relative paths, sorted keys, SHA-256 values, byte counts, geometry counts, per-image texture names/MIME types/bytes/SHA-256 values, animation names, extension names, and pinned tool versions. They contain no timestamps or absolute machine paths. Normal validation compares committed manifests byte-for-byte; only explicit regeneration commands may replace them.
- `ReferenceImages/Froggie Gameplay.png` is an immutable generator input until its authored manifest bytes/SHA-256/crop contract are intentionally changed. Provenance binds the reference image, deterministic crop, generated PNG, and canonical Froggie blend. Replacing the screenshot requires the explicit reviewed replacement command; normal regeneration may never silently bless a new input.
- Production validation reads committed GLBs and manifests without requiring Blender. The website runtime and browser poster capture are outside this plan.

---

## Focused file map

### Authored inputs

- Create `assets/scene-sources.json`: source-to-model mapping, provenance hashes, output paths, budgets, texture policy, and animation requirements.
- Create `assets/blender/Crane.blend`: curated canonical Home source copied from `C:\Code\Blender Models\Crane.blend`.
- Create `assets/blender/CraneWorkout.blend`: curated canonical Experience/Contact source copied from `C:\Code\Blender Models\CraneWorkout.blend`.
- Create `assets/blender/CraneMakingTable.blend`: curated canonical Projects hero source copied from `C:\Code\Blender Models\CraneMakingTable.blend`.
- Create `assets/blender/CraneOnLeague.blend`: curated canonical League source copied from `C:\Code\Blender Models\CraneOnLeague.blend`, relinked to repository-owned textures.
- Create `assets/blender/CraneThrowingPlane.blend`: curated canonical Experience introduction source copied from `C:\Code\Blender Models\CraneThrowingPlane.blend`.
- Create `assets/blender/Rocket.blend`: curated canonical NASA source copied from `C:\Code\Blender Models\Rocket.blend`.
- Create `assets/blender/FroggieDisplay.blend`: generated canonical low-poly Froggie display.
- Create `assets/blender/textures/league-ban-dashboard.svg`: editable abstract League dashboard art.
- Create `assets/blender/textures/league-match-history.svg`: editable abstract match-history art.
- Create `assets/blender/textures/league-ban-dashboard.png`: deterministic Blender-ready raster generated from the SVG.
- Create `assets/blender/textures/league-match-history.png`: deterministic Blender-ready raster generated from the SVG.
- Create `assets/blender/textures/froggie-gameplay-screen.png`: deterministic 16:9 crop generated from `ReferenceImages/Froggie Gameplay.png`.
- Create `assets/blender/source-provenance.json`: generated original-to-canonical source hashes.
- Create `assets/brand-approvals.json`: source-hash-bound League and Rocket visual approvals.
- Create `assets/poster-sources/eog.svg`: intentional abstract EOG poster-only source with no official logo.
- Create `assets/poster-sources/paycom.svg`: intentional abstract Paycom poster-only source with no official logo.
- Create `assets/poster-contract.json`: scene-to-model/source, breakpoint, dimensions, palette, and output-path contract consumed by the runtime poster capture plan.

### Pipeline implementation

- Create `scripts/assets/lib/manifest.mjs`: load and validate the authored source manifest.
- Create `scripts/assets/lib/blender.mjs`: resolve Blender, parse its version, and run background Python scripts.
- Create `scripts/assets/lib/glb.mjs`: parse GLB headers and JSON chunks and derive stable statistics.
- Create `scripts/assets/bootstrap-blender.ps1`: download, hash-check, and extract portable Blender 3.6.23 under ignored `.tools/`.
- Create `scripts/assets/preflight.mjs`: verify Node, Blender, source headers, source presence, and dependency versions.
- Create `scripts/assets/render-source-textures.mjs`: rasterize the two League SVGs and crop the Froggie screenshot deterministically.
- Create `scripts/assets/prepare-all.mjs`: run explicit one-time source curation and write provenance.
- Create `scripts/assets/record-brand-approval.mjs`: record a dated human approval bound to the reviewed canonical source and owned-texture hashes.
- Create `scripts/assets/blender/prepare_source.py`: add the export root, preserve world transforms, remove exact authored shadow receivers, relink/pack owned images, and save a canonical source.
- Create `scripts/assets/blender/inspect_scene.py`: emit stable source inspection JSON for integration tests.
- Create `scripts/assets/create-froggie-display.mjs`: invoke deterministic Froggie authoring and refresh provenance.
- Create `scripts/assets/blender/create_froggie_display.py`: construct and save the low-poly display source.
- Create `scripts/assets/export-all.mjs`: export all canonical sources into ignored raw GLBs while proving sources are unchanged.
- Create `scripts/assets/blender/export_scene.py`: enforce the export contract and write raw GLB plus inspection JSON without saving the source.
- Create `scripts/assets/optimize.mjs`: apply explicit lossless cleanup, WebP texture conversion, and Meshopt compression, then atomically publish GLBs.
- Create `scripts/assets/validate.mjs`: run Khronos validation, enforce model invariants and budgets, and generate the public model manifest.
- Create `scripts/assets/build-all.mjs`: execute preflight, raw export, optimization, and validation in order without shell-specific chaining.

### Runtime outputs

- Create `public/models/crane.glb`.
- Create `public/models/crane-workout.glb`.
- Create `public/models/crane-making-table.glb`.
- Create `public/models/crane-on-league.glb`.
- Create `public/models/crane-throwing-plane.glb`.
- Create `public/models/rocket.glb`.
- Create `public/models/froggie-display.glb`.
- Create `public/models/assets-manifest.json`: generated runtime asset metadata.

### Tests and repository configuration

- Create `tests/assets/source-manifest.test.mjs`: manifest, provenance, import hash, exclusion, and package pin tests.
- Create `tests/assets/blender-toolchain.test.mjs`: bootstrap constants, binary resolution, version parsing, and preflight tests.
- Create `tests/assets/source-preparation.test.mjs`: deterministic texture and canonical-root integration tests.
- Create `tests/assets/web-ground-cleanup.test.mjs`: exact receiver removal, drift rejection, idempotency, provenance, and similarly named asset-preservation tests.
- Create `tests/assets/froggie-display.test.mjs`: generated source geometry, packing, and complexity tests.
- Create `tests/assets/export-contract.test.mjs`: Blender argument, source immutability, GLB root, animation, and unsupported-feature tests.
- Create `tests/assets/optimization.test.mjs`: WebP and Meshopt output tests.
- Create `tests/assets/validation.test.mjs`: malformed GLB, missing model, external URI, cameras/lights, root, size, manifest, and poster-contract tests.
- Create `tests/assets/repository-hygiene.test.mjs`: tracked-file exclusions and orchestration tests.
- Modify `.gitignore`: ignore portable tools and pipeline intermediates while leaving canonical `.blend` files trackable.
- Modify `package.json`: pin asset dependencies and expose PowerShell-friendly Node/PowerShell entry points.
- Modify `package-lock.json`: lock the exact asset dependency graph.

### Task 1: Lock the authored source manifest and import the six existing Blender files

**Files:**

- Create: `assets/scene-sources.json`
- Create: `assets/blender/Crane.blend`
- Create: `assets/blender/CraneWorkout.blend`
- Create: `assets/blender/CraneMakingTable.blend`
- Create: `assets/blender/CraneOnLeague.blend`
- Create: `assets/blender/CraneThrowingPlane.blend`
- Create: `assets/blender/Rocket.blend`
- Create: `scripts/assets/lib/manifest.mjs`
- Create: `tests/assets/source-manifest.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: `loadSourceManifest({ root }): Promise<SourceManifest>`, `sha256File(path): Promise<string>`, and `stringifyStable(value): string` from `scripts/assets/lib/manifest.mjs`.
- Produces: model keys `crane`, `crane-workout`, `crane-making-table`, `crane-on-league`, `crane-throwing-plane`, `rocket`, and `froggie-display` for every later task.
- Produces: exact toolchain values and byte budgets consumed by preflight, export, optimization, validation, and runtime poster-contract generation.
- Produces: the immutable Froggie reference/crop contract and exact owned-texture policies consumed by rendering, source inspection, export, validation, and replacement workflows.

- [ ] **Step 1: Write the failing manifest and dependency-pin test**

Create `tests/assets/source-manifest.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  loadSourceManifest,
  sha256File,
} from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("source manifest pins the approved models, tools, and budgets", async () => {
  const manifest = await loadSourceManifest({ root });

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.models.map((model) => model.key),
    [
      "crane",
      "crane-workout",
      "crane-making-table",
      "crane-on-league",
      "crane-throwing-plane",
      "rocket",
      "froggie-display",
    ],
  );
  assert.equal(manifest.hardMaxBytes, 25 * 1024 * 1024);
  assert.equal(manifest.models[0].maxBytes, 2 * 1024 * 1024);
  assert.ok(manifest.models.slice(1).every((model) => model.maxBytes === 5 * 1024 * 1024));
  assert.equal(manifest.models.find((model) => model.key === "crane-workout").minimumAnimations, 1);
  assert.deepEqual(
    manifest.models.find((model) => model.key === "crane-on-league").ownedTextures,
    [
      {
        name: "LeagueBanDashboard",
        source: "assets/blender/textures/league-ban-dashboard.png",
      },
      {
        name: "LeagueMatchHistory",
        source: "assets/blender/textures/league-match-history.png",
      },
    ],
  );
  assert.deepEqual(
    manifest.models.find((model) => model.key === "froggie-display").ownedTextures,
    [
      {
        name: "FroggieGameplay",
        source: "assets/blender/textures/froggie-gameplay-screen.png",
      },
    ],
  );
  assert.deepEqual(manifest.froggieCapture, {
    source: "ReferenceImages/Froggie Gameplay.png",
    bytes: 2337398,
    sha256: "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613",
    crop: { left: 254, top: 294, width: 2118, height: 1060 },
    output: {
      path: "assets/blender/textures/froggie-gameplay-screen.png",
      width: 1600,
      height: 900,
      fit: "contain",
      background: "#1C1C1C",
    },
  });
  assert.deepEqual(
    manifest.models.find((model) => model.key === "rocket").forbiddenBrandTerms,
    ["nasa", "meatball", "worm"],
  );
  assert.equal(manifest.toolchain.blender.version, "3.6.23");
  assert.equal(manifest.toolchain.gltfTransform, "4.4.1");
  assert.equal(manifest.toolchain.gltfValidator, "2.0.0-dev.3.10");
  assert.equal(manifest.toolchain.meshoptimizer, "1.1.1");
  assert.equal(manifest.toolchain.sharp, "0.35.3");
});

test("imported Blender files exist and retain either their import or curated hash", async () => {
  const manifest = await loadSourceManifest({ root });
  const provenancePath = path.join(root, "assets/blender/source-provenance.json");
  let provenance = null;

  try {
    provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const model of manifest.models.filter((item) => item.origin)) {
    const sourcePath = path.join(root, model.source);
    await access(sourcePath);
    const actualHash = await sha256File(sourcePath);
    const expectedHash = provenance?.models?.[model.key]?.canonicalSha256 ?? model.origin.sha256;
    assert.equal(actualHash, expectedHash, `${model.source} has an unrecorded change`);
  }
});

test("the source tree contains no Blender backup files", async () => {
  const manifest = await loadSourceManifest({ root });
  assert.ok(manifest.models.every((model) => !model.source.endsWith(".blend1")));
  assert.ok(manifest.models.every((model) => !model.source.includes("RocketExportParticle")));
  assert.ok(manifest.models.every((model) => !model.source.includes("CraneIntepreter")));
  assert.ok(manifest.models.every((model) => !model.source.includes("CubeAnimation")));
});

test("package.json pins the asset toolchain exactly", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

  assert.equal(pkg.dependencies.meshoptimizer, "1.1.1");
  assert.equal(pkg.devDependencies["@gltf-transform/cli"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/core"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/extensions"], "4.4.1");
  assert.equal(pkg.devDependencies["@gltf-transform/functions"], "4.4.1");
  assert.equal(pkg.devDependencies["gltf-validator"], "2.0.0-dev.3.10");
  assert.equal(pkg.devDependencies.sharp, "0.35.3");
  assert.equal(pkg.scripts["test:assets"], 'node --test --test-concurrency=1 "tests/assets/**/*.test.mjs"');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/assets/source-manifest.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/lib/manifest.mjs`.

- [ ] **Step 3: Create the authored manifest**

Create `assets/scene-sources.json` with this complete content:

```json
{
  "schemaVersion": 1,
  "hardMaxBytes": 26214400,
  "toolchain": {
    "blender": {
      "version": "3.6.23",
      "downloadUrl": "https://download.blender.org/release/Blender3.6/blender-3.6.23-windows-x64.zip",
      "sha256": "e3296eba7eab32c2e5182459ec7614af32224eee2bd32c9d0a08ffd751c54f3b"
    },
    "gltfTransform": "4.4.1",
    "gltfValidator": "2.0.0-dev.3.10",
    "meshoptimizer": "1.1.1",
    "sharp": "0.35.3"
  },
  "froggieCapture": {
    "source": "ReferenceImages/Froggie Gameplay.png",
    "bytes": 2337398,
    "sha256": "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613",
    "crop": {
      "left": 254,
      "top": 294,
      "width": 2118,
      "height": 1060
    },
    "output": {
      "path": "assets/blender/textures/froggie-gameplay-screen.png",
      "width": 1600,
      "height": 900,
      "fit": "contain",
      "background": "#1C1C1C"
    }
  },
  "models": [
    {
      "key": "crane",
      "source": "assets/blender/Crane.blend",
      "output": "public/models/crane.glb",
      "origin": {
        "fileName": "Crane.blend",
        "bytes": 1154308,
        "sha256": "be2adf030ddcd2fe7f5d9f93eb5a2385d59dc840cf3a71f7e56c602c6470437b"
      },
      "maxBytes": 2097152,
      "minimumAnimations": 0,
      "textureMode": "none"
    },
    {
      "key": "crane-workout",
      "source": "assets/blender/CraneWorkout.blend",
      "output": "public/models/crane-workout.glb",
      "origin": {
        "fileName": "CraneWorkout.blend",
        "bytes": 1609068,
        "sha256": "d66c19df5fa3e30b7efbc71553ebb8f2db6bef5be5544005e5da792959941382"
      },
      "maxBytes": 5242880,
      "minimumAnimations": 1,
      "textureMode": "none"
    },
    {
      "key": "crane-making-table",
      "source": "assets/blender/CraneMakingTable.blend",
      "output": "public/models/crane-making-table.glb",
      "origin": {
        "fileName": "CraneMakingTable.blend",
        "bytes": 1406844,
        "sha256": "b3a9addb51fac7bc19944d707d850660a4490a2e6931bcce0846290f9612c2e8"
      },
      "maxBytes": 5242880,
      "minimumAnimations": 0,
      "textureMode": "none"
    },
    {
      "key": "crane-on-league",
      "source": "assets/blender/CraneOnLeague.blend",
      "output": "public/models/crane-on-league.glb",
      "origin": {
        "fileName": "CraneOnLeague.blend",
        "bytes": 1816028,
        "sha256": "f3436f0231b0a599c70b2c24c5ad5bbb167ed62c8ec35c948285a0cddfc9db81"
      },
      "maxBytes": 5242880,
      "minimumAnimations": 0,
      "textureMode": "webp",
      "ownedTextures": [
        {
          "name": "LeagueBanDashboard",
          "source": "assets/blender/textures/league-ban-dashboard.png"
        },
        {
          "name": "LeagueMatchHistory",
          "source": "assets/blender/textures/league-match-history.png"
        }
      ]
    },
    {
      "key": "crane-throwing-plane",
      "source": "assets/blender/CraneThrowingPlane.blend",
      "output": "public/models/crane-throwing-plane.glb",
      "origin": {
        "fileName": "CraneThrowingPlane.blend",
        "bytes": 1384532,
        "sha256": "a8a02d0e0cd02dbdafedccdf37c89d30f5d812785255a9f474070b01f5ab1840"
      },
      "maxBytes": 5242880,
      "minimumAnimations": 0,
      "textureMode": "none"
    },
    {
      "key": "rocket",
      "source": "assets/blender/Rocket.blend",
      "output": "public/models/rocket.glb",
      "origin": {
        "fileName": "Rocket.blend",
        "bytes": 1227028,
        "sha256": "0953bf47975129f879c52b4197188e0b1b6c93de2ebf78a685cf0fcfb6a33010"
      },
      "maxBytes": 5242880,
      "minimumAnimations": 0,
      "textureMode": "none",
      "forbiddenBrandTerms": ["nasa", "meatball", "worm"]
    },
    {
      "key": "froggie-display",
      "source": "assets/blender/FroggieDisplay.blend",
      "output": "public/models/froggie-display.glb",
      "generator": "scripts/assets/blender/create_froggie_display.py",
      "maxBytes": 5242880,
      "minimumAnimations": 0,
      "textureMode": "webp",
      "ownedTextures": [
        {
          "name": "FroggieGameplay",
          "source": "assets/blender/textures/froggie-gameplay-screen.png"
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: Implement strict manifest loading and hashing**

Create `scripts/assets/lib/manifest.mjs` with this complete content:

```js
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const EXPECTED_MODEL_KEYS = [
  "crane",
  "crane-workout",
  "crane-making-table",
  "crane-on-league",
  "crane-throwing-plane",
  "rocket",
  "froggie-display",
];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RELATIVE_PATH_PATTERN = /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/;
const EXPECTED_OWNED_TEXTURES = {
  "crane-on-league": [
    {
      name: "LeagueBanDashboard",
      source: "assets/blender/textures/league-ban-dashboard.png",
    },
    {
      name: "LeagueMatchHistory",
      source: "assets/blender/textures/league-match-history.png",
    },
  ],
  "froggie-display": [
    {
      name: "FroggieGameplay",
      source: "assets/blender/textures/froggie-gameplay-screen.png",
    },
  ],
};

function invariant(condition, message) {
  if (!condition) throw new Error(`Asset manifest: ${message}`);
}

function validateRelativePath(value, label) {
  invariant(typeof value === "string" && RELATIVE_PATH_PATTERN.test(value), `${label} must be repository-relative`);
  invariant(!value.includes("\\"), `${label} must use forward slashes`);
}

function validateModel(model, index) {
  const label = `models[${index}]`;
  invariant(model && typeof model === "object", `${label} must be an object`);
  invariant(model.key === EXPECTED_MODEL_KEYS[index], `${label}.key must be ${EXPECTED_MODEL_KEYS[index]}`);
  validateRelativePath(model.source, `${label}.source`);
  validateRelativePath(model.output, `${label}.output`);
  invariant(model.source.endsWith(".blend"), `${label}.source must end in .blend`);
  invariant(!model.source.endsWith(".blend1"), `${label}.source cannot be a Blender backup`);
  invariant(model.output.endsWith(".glb"), `${label}.output must end in .glb`);
  invariant(Number.isInteger(model.maxBytes) && model.maxBytes > 0, `${label}.maxBytes must be a positive integer`);
  invariant(Number.isInteger(model.minimumAnimations) && model.minimumAnimations >= 0, `${label}.minimumAnimations must be a non-negative integer`);
  invariant(["none", "webp"].includes(model.textureMode), `${label}.textureMode must be none or webp`);
  const expectedOwnedTextures = EXPECTED_OWNED_TEXTURES[model.key] ?? [];
  invariant(
    JSON.stringify(model.ownedTextures ?? []) === JSON.stringify(expectedOwnedTextures),
    `${label}.ownedTextures must match the exact repository-owned image policy`,
  );
  for (const [textureIndex, texture] of expectedOwnedTextures.entries()) {
    invariant(typeof texture.name === "string" && texture.name.length > 0, `${label}.ownedTextures[${textureIndex}].name is invalid`);
    validateRelativePath(texture.source, `${label}.ownedTextures[${textureIndex}].source`);
  }
  const expectedBrandTerms = model.key === "rocket" ? ["nasa", "meatball", "worm"] : [];
  invariant(
    JSON.stringify(model.forbiddenBrandTerms ?? []) === JSON.stringify(expectedBrandTerms),
    `${label}.forbiddenBrandTerms must match the approved brand policy`,
  );
  invariant(Boolean(model.origin) !== Boolean(model.generator), `${label} must define exactly one of origin or generator`);
  if (model.origin) {
    invariant(typeof model.origin.fileName === "string" && model.origin.fileName.endsWith(".blend"), `${label}.origin.fileName must be a .blend file`);
    invariant(Number.isInteger(model.origin.bytes) && model.origin.bytes > 0, `${label}.origin.bytes must be positive`);
    invariant(HASH_PATTERN.test(model.origin.sha256), `${label}.origin.sha256 must be lowercase SHA-256`);
  }
  if (model.generator) validateRelativePath(model.generator, `${label}.generator`);
}

export async function loadSourceManifest({ root = process.cwd() } = {}) {
  const manifestPath = path.join(root, "assets/scene-sources.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  invariant(manifest.schemaVersion === 1, "schemaVersion must be 1");
  invariant(manifest.hardMaxBytes === 25 * 1024 * 1024, "hardMaxBytes must be 25 MiB");
  invariant(manifest.toolchain?.blender?.version === "3.6.23", "Blender must be 3.6.23");
  invariant(HASH_PATTERN.test(manifest.toolchain.blender.sha256), "Blender archive SHA-256 is invalid");
  invariant(manifest.toolchain.gltfTransform === "4.4.1", "glTF Transform must be 4.4.1");
  invariant(manifest.toolchain.gltfValidator === "2.0.0-dev.3.10", "glTF Validator must be 2.0.0-dev.3.10");
  invariant(manifest.toolchain.meshoptimizer === "1.1.1", "Meshoptimizer must be 1.1.1");
  invariant(manifest.toolchain.sharp === "0.35.3", "Sharp must be 0.35.3");
  const capture = manifest.froggieCapture;
  invariant(capture && typeof capture === "object", "froggieCapture must be an object");
  invariant(capture.source === "ReferenceImages/Froggie Gameplay.png", "froggieCapture.source must use the tracked review input");
  invariant(Number.isInteger(capture.bytes) && capture.bytes > 0, "froggieCapture.bytes must be positive");
  invariant(HASH_PATTERN.test(capture.sha256), "froggieCapture.sha256 must be lowercase SHA-256");
  invariant(
    Number.isInteger(capture.crop?.left) && capture.crop.left >= 0 &&
      Number.isInteger(capture.crop?.top) && capture.crop.top >= 0 &&
      Number.isInteger(capture.crop?.width) && capture.crop.width > 0 &&
      Number.isInteger(capture.crop?.height) && capture.crop.height > 0,
    "froggieCapture.crop must contain non-negative integer offsets and positive integer dimensions",
  );
  invariant(
    JSON.stringify(capture.output) === JSON.stringify({
      path: "assets/blender/textures/froggie-gameplay-screen.png",
      width: 1600,
      height: 900,
      fit: "contain",
      background: "#1C1C1C",
    }),
    "froggieCapture.output must match the canonical 1600x900 texture contract",
  );
  invariant(Array.isArray(manifest.models) && manifest.models.length === EXPECTED_MODEL_KEYS.length, "models must contain the seven approved entries");
  manifest.models.forEach(validateModel);
  invariant(new Set(manifest.models.map((model) => model.output)).size === manifest.models.length, "model outputs must be unique");
  return manifest;
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortJsonValue(value[key])]),
    );
  }
  return value;
}

export function stringifyStable(value) {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}
```

- [ ] **Step 5: Copy only the approved Blender sources**

Run these PowerShell commands from the active isolated worktree root. Keep only the approved source paths under `C:\Code\Blender Models` absolute; every relative destination must resolve inside the active worktree:

```powershell
New-Item -ItemType Directory -Force -Path assets\blender | Out-Null
Copy-Item -LiteralPath 'C:\Code\Blender Models\Crane.blend' -Destination 'assets\blender\Crane.blend'
Copy-Item -LiteralPath 'C:\Code\Blender Models\CraneWorkout.blend' -Destination 'assets\blender\CraneWorkout.blend'
Copy-Item -LiteralPath 'C:\Code\Blender Models\CraneMakingTable.blend' -Destination 'assets\blender\CraneMakingTable.blend'
Copy-Item -LiteralPath 'C:\Code\Blender Models\CraneOnLeague.blend' -Destination 'assets\blender\CraneOnLeague.blend'
Copy-Item -LiteralPath 'C:\Code\Blender Models\CraneThrowingPlane.blend' -Destination 'assets\blender\CraneThrowingPlane.blend'
Copy-Item -LiteralPath 'C:\Code\Blender Models\Rocket.blend' -Destination 'assets\blender\Rocket.blend'
```

Expected: six files exist under `assets/blender/`; no `.blend1` file is copied.

- [ ] **Step 6: Add exact repository exclusions**

Append this exact block to `.gitignore`:

```gitignore

# local 3D asset toolchain and intermediates
/.tools/
/.tmp/assets/
/.tmp/posters/
/assets/blender/**/*.blend1
/assets/blender/**/*.blend@
/assets/blender/**/quit.blend
/public/models/*.raw.glb
```

- [ ] **Step 7: Install and pin the asset dependencies and test entry point**

Run:

```powershell
npm install --save-exact meshoptimizer@1.1.1
npm install --save-dev --save-exact '@gltf-transform/cli@4.4.1' '@gltf-transform/core@4.4.1' '@gltf-transform/extensions@4.4.1' '@gltf-transform/functions@4.4.1' 'gltf-validator@2.0.0-dev.3.10' 'sharp@0.35.3'
npm pkg set 'scripts.test:assets=node --test --test-concurrency=1 "tests/assets/**/*.test.mjs"'
```

Expected: `package.json` contains the exact versions asserted by the test and `package-lock.json` records them without caret or tilde ranges.

- [ ] **Step 8: Run the test and verify GREEN**

Run:

```powershell
node --test tests/assets/source-manifest.test.mjs
```

Expected: four tests PASS.

- [ ] **Step 9: Refactor gate**

Run:

```powershell
npm run lint
npm run test:assets
```

Expected: lint succeeds and all current asset tests PASS. Keep the manifest loader unchanged because path validation, model validation, and hashing already have separate responsibilities.

- [ ] **Step 10: Commit the manifest and source import**

Run:

```powershell
git add .gitignore package.json package-lock.json assets/scene-sources.json assets/blender/Crane.blend assets/blender/CraneWorkout.blend assets/blender/CraneMakingTable.blend assets/blender/CraneOnLeague.blend assets/blender/CraneThrowingPlane.blend assets/blender/Rocket.blend scripts/assets/lib/manifest.mjs tests/assets/source-manifest.test.mjs
git commit -m "build: import canonical Blender sources"
```

Expected: commit succeeds and contains no `.blend1` or portable tool files.

### Task 2: Bootstrap and preflight pinned Blender 3.6.23

**Files:**

- Create: `scripts/assets/bootstrap-blender.ps1`
- Create: `scripts/assets/lib/blender.mjs`
- Create: `scripts/assets/preflight.mjs`
- Create: `tests/assets/blender-toolchain.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Consumes: `loadSourceManifest({ root })` from Task 1.
- Produces: `resolveBlenderBin({ root, env, exists })`, `parseBlenderVersion(stdout)`, `buildBlenderArgs({ blendFile, script, scriptArgs })`, `checkBlenderVersion(blenderBin, run)`, and `runBlenderScript(options)` from `scripts/assets/lib/blender.mjs`.
- Produces: `runPreflight({ root, allowGeneratedMissing, env })` from `scripts/assets/preflight.mjs`.
- Establishes: ignored local executable `.tools/blender-3.6.23-windows-x64/blender.exe` or an exact `BLENDER_BIN` override.

- [ ] **Step 1: Write the failing toolchain test**

Create `tests/assets/blender-toolchain.test.mjs` with this complete content:

```js
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
  assert.match(source, /blender-3\.6\.23-windows-x64\.zip/);
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/assets/blender-toolchain.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/lib/blender.mjs`.

- [ ] **Step 3: Implement the portable Blender bootstrap**

Create `scripts/assets/bootstrap-blender.ps1` with this complete content:

```powershell
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$version = '3.6.23'
$archiveName = "blender-$version-windows-x64.zip"
$archiveUrl = "https://download.blender.org/release/Blender3.6/$archiveName"
$expectedSha256 = 'e3296eba7eab32c2e5182459ec7614af32224eee2bd32c9d0a08ffd751c54f3b'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$toolsRoot = Join-Path $repoRoot '.tools'
$installRoot = Join-Path $toolsRoot "blender-$version-windows-x64"
$blenderExe = Join-Path $installRoot 'blender.exe'

if (Test-Path -LiteralPath $blenderExe) {
    $firstLine = (& $blenderExe --version | Select-Object -First 1)
    if ($firstLine -ne "Blender $version") {
        throw "Existing $blenderExe reported '$firstLine'; expected 'Blender $version'."
    }
    Write-Output $blenderExe
    exit 0
}

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
$archivePath = Join-Path $toolsRoot $archiveName
$extractRoot = Join-Path $toolsRoot ("blender-extract-" + [guid]::NewGuid().ToString('N'))

Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archivePath
$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "Blender archive digest mismatch: expected $expectedSha256, got $actualSha256."
}

New-Item -ItemType Directory -Path $extractRoot | Out-Null
Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot
$expandedRoot = Join-Path $extractRoot "blender-$version-windows-x64"
if (-not (Test-Path -LiteralPath (Join-Path $expandedRoot 'blender.exe'))) {
    throw "The verified Blender archive did not contain the expected executable."
}

Move-Item -LiteralPath $expandedRoot -Destination $installRoot
Remove-Item -LiteralPath $extractRoot -Force
Remove-Item -LiteralPath $archivePath -Force

$firstLine = (& $blenderExe --version | Select-Object -First 1)
if ($firstLine -ne "Blender $version") {
    throw "Installed Blender reported '$firstLine'; expected 'Blender $version'."
}

Write-Output $blenderExe
```

- [ ] **Step 4: Implement cross-platform Blender process helpers**

Create `scripts/assets/lib/blender.mjs` with this complete content:

```js
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
```

- [ ] **Step 5: Implement the repository preflight**

Create `scripts/assets/preflight.mjs` with this complete content:

```js
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
```

- [ ] **Step 6: Add exact package entry points**

Run:

```powershell
npm pkg set 'scripts.assets:bootstrap=powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assets/bootstrap-blender.ps1'
npm pkg set 'scripts.assets:preflight=node scripts/assets/preflight.mjs'
```

Expected: `package.json` exposes `assets:bootstrap` and `assets:preflight` with the exact commands above.

- [ ] **Step 7: Run the unit tests and verify GREEN**

Run:

```powershell
node --test tests/assets/blender-toolchain.test.mjs
```

Expected: five tests PASS.

- [ ] **Step 8: Bootstrap the ignored portable executable**

Run:

```powershell
npm run assets:bootstrap
```

Expected: the final line is the absolute path to `.tools\blender-3.6.23-windows-x64\blender.exe`; the verified ZIP is removed after extraction.

- [ ] **Step 9: Run preflight before the generated Froggie source exists**

Run:

```powershell
node scripts/assets/preflight.mjs --allow-generated-missing
```

Expected output includes both lines:

```text
pending generated source: assets/blender/FroggieDisplay.blend
asset preflight ok: Blender 3.6.23
```

- [ ] **Step 10: Refactor gate**

Run:

```powershell
npm run lint
node --test tests/assets/source-manifest.test.mjs tests/assets/blender-toolchain.test.mjs
```

Expected: lint succeeds and all nine tests PASS. Keep binary resolution, argument construction, and process execution as separate exported functions for later test injection.

- [ ] **Step 11: Commit the pinned toolchain bootstrap**

Run:

```powershell
git add package.json package-lock.json scripts/assets/bootstrap-blender.ps1 scripts/assets/lib/blender.mjs scripts/assets/preflight.mjs tests/assets/blender-toolchain.test.mjs
git commit -m "build: pin Blender asset toolchain"
```

Expected: commit succeeds; `git status --short .tools` prints nothing because `.tools/` is ignored.

### Task 3: Curate canonical roots and replace the missing League textures

**Files:**

- Create: `assets/blender/textures/league-ban-dashboard.svg`
- Create: `assets/blender/textures/league-match-history.svg`
- Create: `assets/blender/textures/league-ban-dashboard.png`
- Create: `assets/blender/textures/league-match-history.png`
- Create: `assets/blender/textures/froggie-gameplay-screen.png`
- Create: `assets/blender/source-provenance.json`
- Create: `assets/brand-approvals.json`
- Create: `scripts/assets/render-source-textures.mjs`
- Create: `scripts/assets/prepare-all.mjs`
- Create: `scripts/assets/record-brand-approval.mjs`
- Create: `scripts/assets/blender/prepare_source.py`
- Create: `scripts/assets/blender/inspect_scene.py`
- Create: `tests/assets/source-preparation.test.mjs`
- Modify: `assets/blender/Crane.blend`
- Modify: `assets/blender/CraneWorkout.blend`
- Modify: `assets/blender/CraneMakingTable.blend`
- Modify: `assets/blender/CraneOnLeague.blend`
- Modify: `assets/blender/CraneThrowingPlane.blend`
- Modify: `assets/blender/Rocket.blend`
- Modify: `package.json`

**Interfaces:**

- Consumes: `runPreflight`, `runBlenderScript`, and the seven manifest model records.
- Produces: `renderSourceTextures({ root }): Promise<Record<string, { path: string, sha256: string }>>`.
- Produces: canonical sources containing one identity-transform `WEB_EXPORT_ROOT`; all renderable non-camera/light top-level objects are parented beneath it without changing world transforms.
- Produces: `assets/blender/source-provenance.json` with `originalSha256` and `canonicalSha256` per authorized model update plus exact owned-texture and Froggie generator-input bindings.
- Produces: `assertReviewedSourcesUnchanged({ root, manifest, provenance, ignoreKeys })` and `writeSourceProvenance({ root, manifest, updateKeys })`; neither API may rewrite an unrelated model entry.
- Produces: `assets/brand-approvals.json` with dated human approvals cryptographically bound to reviewed League/Rocket sources and, for League, the exact two owned PNG hashes.
- Produces: stable inspection JSON fields `rootCount`, `rootTransform`, `objects`, `packedImages`, `packedImageSha256`, `imageNames`, `textureNames`, `materialNames`, `externalResources`, `particleSystems`, `volumeObjects`, `triangleEstimate`, `animations`, and `materialNodeTypes`.

- [ ] **Step 1: Write the failing source-preparation integration test**

Create `tests/assets/source-preparation.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { renderSourceTextures } from "../../scripts/assets/render-source-textures.mjs";
import { resolveBlenderBin, runBlenderScript } from "../../scripts/assets/lib/blender.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  writeSourceProvenance,
} from "../../scripts/assets/prepare-all.mjs";
import { buildBrandApproval } from "../../scripts/assets/record-brand-approval.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, ".tmp/assets/source-preparation-test");

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("source textures render to fixed dimensions without third-party raster inputs", async () => {
  await renderSourceTextures({ root });
  const expected = [
    ["assets/blender/textures/league-ban-dashboard.png", 1024, 576],
    ["assets/blender/textures/league-match-history.png", 1024, 576],
    ["assets/blender/textures/froggie-gameplay-screen.png", 1600, 900],
  ];

  for (const [relativePath, width, height] of expected) {
    const metadata = await sharp(path.join(root, relativePath)).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.equal(metadata.format, "png");
  }

  const dashboardSvg = await readFile(path.join(root, "assets/blender/textures/league-ban-dashboard.svg"), "utf8");
  const historySvg = await readFile(path.join(root, "assets/blender/textures/league-match-history.svg"), "utf8");
  assert.doesNotMatch(`${dashboardSvg}${historySvg}`, /riot|champion|item|logo/i);
  assert.doesNotMatch(`${dashboardSvg}${historySvg}`, /<image\b/i);
});

test("League curation replaces broken and canonical packed images, then creates one export root", async () => {
  await renderSourceTextures({ root });
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "CraneOnLeague-input.blend");
  const output = path.join(tempRoot, "CraneOnLeague-curated.blend");
  const report = path.join(tempRoot, "report.json");
  await copyFile(path.join(root, "assets/blender/CraneOnLeague.blend"), input);

  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", output,
      "--league-dashboard", path.join(root, "assets/blender/textures/league-ban-dashboard.png"),
      "--league-history", path.join(root, "assets/blender/textures/league-match-history.png"),
    ],
    cwd: root,
  });
  runBlenderScript({
    blenderBin,
    blendFile: output,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", report],
    cwd: root,
  });

  const inspection = JSON.parse(await readFile(report, "utf8"));
  assert.equal(inspection.rootCount, 1);
  assert.deepEqual(inspection.rootTransform, {
    location: [0, 0, 0],
    rotationEuler: [0, 0, 0],
    scale: [1, 1, 1],
  });
  const expectedPackedImages = {
    LeagueBanDashboard: await sha256File(
      path.join(root, "assets/blender/textures/league-ban-dashboard.png"),
    ),
    LeagueMatchHistory: await sha256File(
      path.join(root, "assets/blender/textures/league-match-history.png"),
    ),
  };
  assert.deepEqual(inspection.packedImages, Object.keys(expectedPackedImages));
  assert.deepEqual(inspection.packedImageSha256, expectedPackedImages);
  assert.deepEqual(inspection.externalResources, []);
  assert.deepEqual(inspection.particleSystems, []);
  assert.deepEqual(inspection.volumeObjects, []);
  assert.ok(inspection.objects.length > 1);

  const replacementDashboard = path.join(tempRoot, "replacement-dashboard.png");
  const replacementHistory = path.join(tempRoot, "replacement-history.png");
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#135946" },
  }).png().toFile(replacementDashboard);
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#4b2e7e" },
  }).png().toFile(replacementHistory);
  const replacementOutput = path.join(tempRoot, "CraneOnLeague-replaced.blend");
  const replacementReport = path.join(tempRoot, "replacement-report.json");
  runBlenderScript({
    blenderBin,
    blendFile: output,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", replacementOutput,
      "--league-dashboard", replacementDashboard,
      "--league-history", replacementHistory,
    ],
    cwd: root,
  });
  runBlenderScript({
    blenderBin,
    blendFile: replacementOutput,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", replacementReport],
    cwd: root,
  });
  const replacementInspection = JSON.parse(
    await readFile(replacementReport, "utf8"),
  );
  const replacementHashes = {
    LeagueBanDashboard: await sha256File(replacementDashboard),
    LeagueMatchHistory: await sha256File(replacementHistory),
  };
  assert.deepEqual(replacementInspection.packedImageSha256, replacementHashes);
  assert.notDeepEqual(
    replacementInspection.packedImageSha256,
    inspection.packedImageSha256,
  );
});

test("Rocket source names expose no official NASA brand assets", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const report = path.join(tempRoot, "rocket-report.json");
  runBlenderScript({
    blenderBin,
    blendFile: path.join(root, "assets/blender/Rocket.blend"),
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", report],
    cwd: root,
  });

  const inspection = JSON.parse(await readFile(report, "utf8"));
  const namedAssets = [
    ...inspection.objects,
    ...inspection.packedImages,
    ...inspection.imageNames,
    ...inspection.textureNames,
    ...inspection.materialNames,
  ].join("\n");
  assert.doesNotMatch(namedAssets, /nasa|meatball|worm/i);
  assert.deepEqual(inspection.externalResources, []);
});

test("provenance updates only authorized keys and rejects unrelated drift", async () => {
  const fixtureRoot = path.join(tempRoot, "provenance");
  await mkdir(path.join(fixtureRoot, "assets/blender"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "assets/blender/Reviewed.blend"), "reviewed-v1");
  await writeFile(path.join(fixtureRoot, "assets/blender/Updated.blend"), "updated-v1");
  const manifest = {
    models: [
      {
        key: "reviewed",
        source: "assets/blender/Reviewed.blend",
        origin: { sha256: "a".repeat(64) },
        ownedTextures: [],
      },
      {
        key: "updated",
        source: "assets/blender/Updated.blend",
        origin: { sha256: "b".repeat(64) },
        ownedTextures: [],
      },
    ],
  };

  await writeSourceProvenance({
    root: fixtureRoot,
    manifest,
    updateKeys: ["reviewed", "updated"],
  });
  const before = JSON.parse(
    await readFile(
      path.join(fixtureRoot, "assets/blender/source-provenance.json"),
      "utf8",
    ),
  );

  await writeFile(path.join(fixtureRoot, "assets/blender/Updated.blend"), "updated-v2");
  await writeSourceProvenance({
    root: fixtureRoot,
    manifest,
    updateKeys: ["updated"],
  });
  const after = JSON.parse(
    await readFile(
      path.join(fixtureRoot, "assets/blender/source-provenance.json"),
      "utf8",
    ),
  );
  assert.deepEqual(after.models.reviewed, before.models.reviewed);
  assert.notEqual(
    after.models.updated.canonicalSha256,
    before.models.updated.canonicalSha256,
  );
  await assert.rejects(
    assertReviewedSourcesUnchanged({
      root: fixtureRoot,
      manifest,
      provenance: {
        ...after,
        models: { updated: after.models.updated },
      },
      ignoreKeys: ["updated"],
    }),
    /reviewed source provenance is missing/,
  );

  await writeFile(path.join(fixtureRoot, "assets/blender/Reviewed.blend"), "unreviewed-drift");
  await assert.rejects(
    writeSourceProvenance({
      root: fixtureRoot,
      manifest,
      updateKeys: ["updated"],
    }),
    /reviewed source drifted/,
  );
  await assert.rejects(
    assertReviewedSourcesUnchanged({
      root: fixtureRoot,
      manifest,
      provenance: after,
      ignoreKeys: ["updated"],
    }),
    /reviewed source drifted/,
  );
});

test("brand approval records bind the reviewed source and exact owned textures", () => {
  const approval = buildBrandApproval({
    key: "league-owned-art",
    reviewedBy: "Richard Phong",
    reviewedOn: "2026-07-09",
    provenance: {
      models: {
        "crane-on-league": {
          canonicalSha256: "c".repeat(64),
          generatorInputs: {
            ownedTextures: {
              LeagueBanDashboard: {
                path: "assets/blender/textures/league-ban-dashboard.png",
                sha256: "d".repeat(64),
              },
              LeagueMatchHistory: {
                path: "assets/blender/textures/league-match-history.png",
                sha256: "e".repeat(64),
              },
            },
          },
        },
      },
    },
  });

  assert.deepEqual(approval, {
    modelKey: "crane-on-league",
    reviewedBy: "Richard Phong",
    reviewedOn: "2026-07-09",
    sourceSha256: "c".repeat(64),
    status: "approved",
    textureSha256: {
      LeagueBanDashboard: "d".repeat(64),
      LeagueMatchHistory: "e".repeat(64),
    },
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/assets/source-preparation.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/render-source-textures.mjs`.

- [ ] **Step 3: Create repository-owned abstract League screen artwork**

Create `assets/blender/textures/league-ban-dashboard.svg` with this complete content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
  <rect width="1024" height="576" fill="#135946"/>
  <rect x="48" y="42" width="928" height="72" rx="24" fill="#9eccc0"/>
  <circle cx="92" cy="78" r="14" fill="#ffffff"/>
  <rect x="126" y="63" width="220" height="30" rx="15" fill="#285d71"/>
  <g transform="translate(72 154)">
    <rect width="260" height="354" rx="28" fill="#fbe5ea"/>
    <rect x="28" y="28" width="204" height="32" rx="16" fill="#722939"/>
    <circle cx="130" cy="126" r="42" fill="#dfa9b5"/>
    <rect x="42" y="194" width="176" height="18" rx="9" fill="#dfa9b5"/>
    <rect x="42" y="230" width="138" height="18" rx="9" fill="#dfa9b5"/>
    <rect x="42" y="288" width="176" height="38" rx="19" fill="#722939"/>
  </g>
  <g transform="translate(382 154)">
    <rect width="260" height="354" rx="28" fill="#ede6fa"/>
    <rect x="28" y="28" width="204" height="32" rx="16" fill="#4b2e7e"/>
    <circle cx="130" cy="126" r="42" fill="#c9bae4"/>
    <rect x="42" y="194" width="176" height="18" rx="9" fill="#c9bae4"/>
    <rect x="42" y="230" width="138" height="18" rx="9" fill="#c9bae4"/>
    <rect x="42" y="288" width="176" height="38" rx="19" fill="#4b2e7e"/>
  </g>
  <g transform="translate(692 154)">
    <rect width="260" height="354" rx="28" fill="#edf7fb"/>
    <rect x="28" y="28" width="204" height="32" rx="16" fill="#285d71"/>
    <circle cx="130" cy="126" r="42" fill="#afd4e1"/>
    <rect x="42" y="194" width="176" height="18" rx="9" fill="#afd4e1"/>
    <rect x="42" y="230" width="138" height="18" rx="9" fill="#afd4e1"/>
    <rect x="42" y="288" width="176" height="38" rx="19" fill="#285d71"/>
  </g>
</svg>
```

Create `assets/blender/textures/league-match-history.svg` with this complete content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
  <rect width="1024" height="576" fill="#edf7fb"/>
  <rect x="0" y="0" width="226" height="576" fill="#285d71"/>
  <circle cx="72" cy="76" r="28" fill="#afd4e1"/>
  <rect x="116" y="58" width="78" height="16" rx="8" fill="#ffffff"/>
  <rect x="116" y="86" width="54" height="12" rx="6" fill="#afd4e1"/>
  <g fill="#afd4e1">
    <rect x="38" y="158" width="150" height="24" rx="12"/>
    <rect x="38" y="212" width="122" height="24" rx="12"/>
    <rect x="38" y="266" width="136" height="24" rx="12"/>
    <rect x="38" y="320" width="108" height="24" rx="12"/>
  </g>
  <g transform="translate(270 42)">
    <rect width="710" height="84" rx="24" fill="#ffffff"/>
    <rect x="30" y="26" width="228" height="24" rx="12" fill="#285d71"/>
    <rect x="546" y="26" width="132" height="32" rx="16" fill="#9eccc0"/>
  </g>
  <g transform="translate(270 154)">
    <rect width="710" height="104" rx="24" fill="#ffffff"/>
    <circle cx="52" cy="52" r="28" fill="#dfa9b5"/>
    <rect x="100" y="28" width="206" height="18" rx="9" fill="#722939"/>
    <rect x="100" y="60" width="154" height="14" rx="7" fill="#dfa9b5"/>
    <rect x="548" y="34" width="118" height="36" rx="18" fill="#fbe5ea"/>
  </g>
  <g transform="translate(270 282)">
    <rect width="710" height="104" rx="24" fill="#ffffff"/>
    <circle cx="52" cy="52" r="28" fill="#c9bae4"/>
    <rect x="100" y="28" width="234" height="18" rx="9" fill="#4b2e7e"/>
    <rect x="100" y="60" width="170" height="14" rx="7" fill="#c9bae4"/>
    <rect x="548" y="34" width="118" height="36" rx="18" fill="#ede6fa"/>
  </g>
  <g transform="translate(270 410)">
    <rect width="710" height="104" rx="24" fill="#ffffff"/>
    <circle cx="52" cy="52" r="28" fill="#9eccc0"/>
    <rect x="100" y="28" width="192" height="18" rx="9" fill="#135946"/>
    <rect x="100" y="60" width="146" height="14" rx="7" fill="#9eccc0"/>
    <rect x="548" y="34" width="118" height="36" rx="18" fill="#edf7fb"/>
  </g>
</svg>
```

- [ ] **Step 4: Implement deterministic source texture rendering**

Create `scripts/assets/render-source-textures.mjs` with this complete content:

```js
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { loadSourceManifest, sha256File } from "./lib/manifest.mjs";

export async function renderSourceTextures({ root = process.cwd() } = {}) {
  const manifest = await loadSourceManifest({ root });
  const textureRoot = path.join(root, "assets/blender/textures");
  await mkdir(textureRoot, { recursive: true });
  const generated = {};

  for (const name of ["league-ban-dashboard", "league-match-history"]) {
    const outputPath = path.join(textureRoot, `${name}.png`);
    await sharp(path.join(textureRoot, `${name}.svg`), { density: 96 })
      .resize(1024, 576, { fit: "fill" })
      .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
      .toFile(outputPath);
    generated[name] = {
      path: path.relative(root, outputPath).replaceAll("\\", "/"),
      sha256: await sha256File(outputPath),
    };
  }

  const capture = manifest.froggieCapture;
  const referencePath = path.join(root, capture.source);
  const referenceStats = await stat(referencePath);
  const referenceSha256 = await sha256File(referencePath);
  if (
    referenceStats.size !== capture.bytes ||
    referenceSha256 !== capture.sha256
  ) {
    throw new Error(
      "Froggie gameplay reference does not match the reviewed bytes/SHA-256 in assets/scene-sources.json.",
    );
  }
  const froggieOutput = path.join(root, capture.output.path);
  await sharp(referencePath)
    .extract(capture.crop)
    .resize(capture.output.width, capture.output.height, {
      fit: capture.output.fit,
      position: "center",
      background: capture.output.background,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
    .toFile(froggieOutput);
  generated.FroggieGameplay = {
    path: capture.output.path,
    sha256: await sha256File(froggieOutput),
  };
  return generated;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await renderSourceTextures();
    console.log("source textures rendered");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Implement explicit one-time Blender source curation**

Create `scripts/assets/blender/prepare_source.py` with this complete content:

```python
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy

EXPECTED_VERSION = (3, 6, 23)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    parser.add_argument("--league-dashboard")
    parser.add_argument("--league-history")
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def resolve_external_image(image):
    return Path(bpy.path.abspath(image.filepath)).resolve()


def relink_owned_images(args):
    replacements = [
        {
            "aliases": ("ban site", "leaguebandashboard", "league-ban-dashboard"),
            "name": "LeagueBanDashboard",
            "path": Path(args.league_dashboard).resolve(),
        } if args.league_dashboard else None,
        {
            "aliases": ("mint", "leaguematchhistory", "league-match-history"),
            "name": "LeagueMatchHistory",
            "path": Path(args.league_history).resolve(),
        } if args.league_history else None,
    ]
    for image in bpy.data.images:
        if image.source != "FILE":
            continue
        identity = f"{image.name} {image.filepath}".lower()
        replacement = next(
            (
                item
                for item in replacements
                if item and any(alias in identity for alias in item["aliases"])
            ),
            None,
        )
        if replacement:
            require(replacement["path"].is_file(), f"Owned texture is missing: {replacement['path']}")
            if image.packed_file:
                image.unpack(method="REMOVE")
            image.name = replacement["name"]
            image.filepath = str(replacement["path"])
            image.reload()
            image.pack()
            continue
        if image.packed_file:
            continue
        resolved = resolve_external_image(image)
        require(resolved.is_file(), f"Unresolved external image: {image.name} -> {resolved}")
        image.pack()

    if args.league_dashboard or args.league_history:
        require(
            args.league_dashboard and args.league_history,
            "League curation requires both repository-owned textures",
        )
        actual = sorted(
            image.name for image in bpy.data.images if image.source == "FILE"
        )
        expected = ["LeagueBanDashboard", "LeagueMatchHistory"]
        require(
            actual == expected,
            f"League source contains non-allowlisted raster images: expected {expected}, got {actual}",
        )


def ensure_export_root():
    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    require(len(roots) <= 1, "More than one WEB_EXPORT_ROOT exists")
    if roots:
        root = roots[0]
    else:
        root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
        bpy.context.scene.collection.objects.link(root)

    root.location = (0.0, 0.0, 0.0)
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root["asset_pipeline_version"] = 1

    eligible = {
        obj
        for obj in bpy.context.scene.objects
        if obj != root and obj.type not in {"CAMERA", "LIGHT"} and not obj.hide_render
    }

    def has_root_ancestor(obj):
        current = obj.parent
        while current:
            if current == root:
                return True
            current = current.parent
        return False

    for obj in sorted(eligible, key=lambda item: item.name):
        if has_root_ancestor(obj):
            continue
        if obj.parent is None or obj.parent not in eligible:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world

    return root


def main():
    args = parse_args()
    require(tuple(bpy.app.version) == EXPECTED_VERSION, f"Expected Blender {EXPECTED_VERSION}, got {tuple(bpy.app.version)}")
    require(bool(bpy.data.filepath), "A source .blend file must be open")
    relink_owned_images(args)
    ensure_export_root()

    linked = [library.filepath for library in bpy.data.libraries if library.filepath]
    require(not linked, f"Linked Blender libraries are not permitted: {json.dumps(linked)}")

    destination = Path(args.destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)
    print(f"curated source: {destination}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Implement stable Blender scene inspection**

Create `scripts/assets/blender/inspect_scene.py` with this complete content:

```python
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def rounded_vector(values):
    return [round(float(value), 6) for value in values]


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def triangle_estimate(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            total += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return total


def packed_image_sha256(image):
    if not image.packed_file:
        return None
    return hashlib.sha256(bytes(image.packed_file.data)).hexdigest()


def main():
    args = parse_args()
    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    root = roots[0] if len(roots) == 1 else None
    export_objects = [root, *descendants(root)] if root else []

    external_resources = []
    packed_images = []
    for image in bpy.data.images:
        if image.source != "FILE":
            continue
        if image.packed_file:
            packed_images.append(image.name)
        else:
            external_resources.append({"kind": "image", "name": image.name, "path": image.filepath})
    for library in bpy.data.libraries:
        if library.filepath:
            external_resources.append({"kind": "library", "name": library.name, "path": library.filepath})

    particle_systems = sorted(
        obj.name for obj in export_objects if obj and len(obj.particle_systems) > 0
    )
    volume_objects = sorted(obj.name for obj in export_objects if obj and obj.type == "VOLUME")
    material_node_types = sorted({
        node.bl_idname
        for material in bpy.data.materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
    })

    report = {
        "animations": sorted(action.name for action in bpy.data.actions),
        "blenderVersion": ".".join(str(part) for part in bpy.app.version),
        "externalResources": sorted(external_resources, key=lambda item: (item["kind"], item["name"])),
        "imageNames": sorted(image.name for image in bpy.data.images),
        "materialNames": sorted(material.name for material in bpy.data.materials),
        "materialNodeTypes": material_node_types,
        "objects": sorted(obj.name for obj in export_objects if obj),
        "packedImages": sorted(packed_images),
        "packedImageSha256": {
            image.name: packed_image_sha256(image)
            for image in sorted(bpy.data.images, key=lambda item: item.name)
            if image.source == "FILE" and image.packed_file
        },
        "particleSystems": particle_systems,
        "rootCount": len(roots),
        "rootTransform": None if not root else {
            "location": rounded_vector(root.location),
            "rotationEuler": rounded_vector(root.rotation_euler),
            "scale": rounded_vector(root.scale),
        },
        "triangleEstimate": triangle_estimate([obj for obj in export_objects if obj]),
        "textureNames": sorted(texture.name for texture in bpy.data.textures),
        "volumeObjects": volume_objects,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"scene inspection: {report_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 7: Implement the one-time curation orchestrator and provenance writer**

Create `scripts/assets/prepare-all.mjs` with this complete content:

```js
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPreflight } from "./preflight.mjs";
import { runBlenderScript } from "./lib/blender.mjs";
import { sha256File, stringifyStable } from "./lib/manifest.mjs";
import { renderSourceTextures } from "./render-source-textures.mjs";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readSourceProvenance(root) {
  try {
    const source = await readFile(
      path.join(root, "assets/blender/source-provenance.json"),
      "utf8",
    );
    const provenance = JSON.parse(source);
    if (provenance.schemaVersion !== 1 || !provenance.models) {
      throw new Error("source-provenance.json must use schemaVersion 1");
    }
    return provenance;
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1, models: {} };
    throw error;
  }
}

async function buildGeneratorInputs({ root, manifest, model }) {
  const generatorInputs = {};
  if ((model.ownedTextures ?? []).length > 0) {
    const ownedTextures = {};
    for (const texture of model.ownedTextures) {
      const texturePath = path.join(root, texture.source);
      const [textureStats, sha256] = await Promise.all([
        stat(texturePath),
        sha256File(texturePath),
      ]);
      ownedTextures[texture.name] = {
        bytes: textureStats.size,
        path: texture.source,
        sha256,
      };
    }
    generatorInputs.ownedTextures = ownedTextures;
  }
  if (model.key === "froggie-display") {
    const referencePath = path.join(root, manifest.froggieCapture.source);
    const [referenceStats, referenceSha256] = await Promise.all([
      stat(referencePath),
      sha256File(referencePath),
    ]);
    if (
      referenceStats.size !== manifest.froggieCapture.bytes ||
      referenceSha256 !== manifest.froggieCapture.sha256
    ) {
      throw new Error("froggie-display: reviewed capture input drifted");
    }
    generatorInputs.froggieCapture = manifest.froggieCapture;
  }
  return Object.keys(generatorInputs).length > 0
    ? { generatorInputs }
    : {};
}

export async function assertReviewedSourcesUnchanged({
  root,
  manifest,
  provenance,
  ignoreKeys = [],
}) {
  const ignored = new Set(ignoreKeys);
  const byKey = new Map(manifest.models.map((model) => [model.key, model]));
  for (const key of Object.keys(provenance.models ?? {})) {
    if (!byKey.has(key)) {
      throw new Error(`${key}: provenance contains an unknown model`);
    }
  }
  for (const model of manifest.models) {
    const key = model.key;
    if (ignored.has(key)) continue;
    const entry = provenance.models?.[key];
    const sourceExists = await exists(path.join(root, model.source));
    if (!sourceExists) {
      if (model.generator && !entry) continue;
      throw new Error(`${key}: reviewed source is missing`);
    }
    if (!entry) {
      throw new Error(`${key}: reviewed source provenance is missing`);
    }
    if (model.source !== entry.source) {
      throw new Error(`${key}: provenance source does not match the authored manifest`);
    }
    if (await sha256File(path.join(root, model.source)) !== entry.canonicalSha256) {
      throw new Error(`${key}: reviewed source drifted`);
    }
    if (model.origin && entry.originalSha256 !== model.origin.sha256) {
      throw new Error(`${key}: original import provenance drifted`);
    }
    const expectedInputs = await buildGeneratorInputs({ root, manifest, model });
    if (
      stringifyStable(entry.generatorInputs ?? {}) !==
      stringifyStable(expectedInputs.generatorInputs ?? {})
    ) {
      throw new Error(`${key}: reviewed generator inputs drifted`);
    }
  }
  return provenance;
}

export async function replaceFileAtomically(temporaryPath, outputPath) {
  const backupPath = `${outputPath}.${process.pid}.backup`;
  let movedExisting = false;
  try {
    await rename(outputPath, backupPath);
    movedExisting = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (movedExisting) await rename(backupPath, outputPath);
    throw error;
  }
  if (movedExisting) await rm(backupPath, { force: true });
}

export async function writeSourceProvenance({
  root,
  manifest,
  updateKeys,
}) {
  const updates = new Set(updateKeys ?? []);
  if (updates.size === 0) {
    throw new Error("writeSourceProvenance requires at least one authorized update key");
  }
  const byKey = new Map(manifest.models.map((model) => [model.key, model]));
  for (const key of updates) {
    if (!byKey.has(key)) throw new Error(`Unknown provenance update key: ${key}`);
  }

  const current = await readSourceProvenance(root);
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance: current,
    ignoreKeys: [...updates],
  });
  const models = { ...current.models };
  for (const key of updates) {
    const model = byKey.get(key);
    const sourcePath = path.join(root, model.source);
    if (!(await exists(sourcePath))) {
      throw new Error(`${key}: authorized source is missing`);
    }
    models[key] = {
      canonicalSha256: await sha256File(sourcePath),
      ...(model.origin ? { originalSha256: model.origin.sha256 } : {}),
      source: model.source,
      ...(await buildGeneratorInputs({ root, manifest, model })),
    };
  }

  const output = { schemaVersion: 1, models };
  const provenancePath = path.join(
    root,
    "assets/blender/source-provenance.json",
  );
  const temporaryPath = `${provenancePath}.${process.pid}.next`;
  await mkdir(path.dirname(provenancePath), { recursive: true });
  await writeFile(temporaryPath, stringifyStable(output));
  await replaceFileAtomically(temporaryPath, provenancePath);
  return output;
}

export async function prepareAll({
  root = process.cwd(),
  only = null,
  replace = false,
} = {}) {
  const { blenderBin, manifest } = await runPreflight({
    root,
    allowGeneratedMissing: true,
  });
  if (replace && !only) {
    throw new Error("--replace requires one explicit --only model key");
  }
  await renderSourceTextures({ root });
  const selected = manifest.models.filter(
    (model) => model.origin && (!only || model.key === only),
  );
  if (only && selected.length !== 1) {
    throw new Error(`Unknown imported model key: ${only}`);
  }
  const current = await readSourceProvenance(root);
  for (const model of selected) {
    if (current.models[model.key] && !replace) {
      throw new Error(
        `${model.key}: canonical source is already reviewed; use --only ${model.key} --replace for an intentional replacement`,
      );
    }
  }
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance: current,
    ignoreKeys: selected.map((model) => model.key),
  });

  const candidateRoot = path.join(root, ".tmp/assets/curated");
  await mkdir(candidateRoot, { recursive: true });
  const candidates = [];
  for (const model of selected) {
    const sourcePath = path.join(root, model.source);
    const candidatePath = path.join(
      candidateRoot,
      `${model.key}.${process.pid}.blend`,
    );
    const scriptArgs = ["--destination", candidatePath];
    if (model.key === "crane-on-league") {
      scriptArgs.push(
        "--league-dashboard",
        path.join(root, "assets/blender/textures/league-ban-dashboard.png"),
        "--league-history",
        path.join(root, "assets/blender/textures/league-match-history.png"),
      );
    }
    runBlenderScript({
      blenderBin,
      blendFile: sourcePath,
      script: path.join(root, "scripts/assets/blender/prepare_source.py"),
      scriptArgs,
      cwd: root,
    });
    candidates.push({ candidatePath, model, sourcePath });
  }
  for (const { candidatePath, model, sourcePath } of candidates) {
    await replaceFileAtomically(candidatePath, sourcePath);
    console.log(`curated ${model.key}`);
  }
  await writeSourceProvenance({
    root,
    manifest,
    updateKeys: selected.map((model) => model.key),
  });
  console.log("source provenance written");
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
  const replace = process.argv.includes("--replace");
  try {
    await prepareAll({ only, replace });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 8: Implement source-bound human brand approvals**

Create `scripts/assets/record-brand-approval.mjs` with this complete content:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSourceManifest, stringifyStable } from "./lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  readSourceProvenance,
  replaceFileAtomically,
} from "./prepare-all.mjs";

const POLICY_MODELS = {
  "league-owned-art": "crane-on-league",
  "rocket-brand-safety": "rocket",
};

export function buildBrandApproval({
  key,
  reviewedBy,
  reviewedOn,
  provenance,
}) {
  const modelKey = POLICY_MODELS[key];
  if (!modelKey) throw new Error(`Unknown brand approval key: ${key}`);
  if (!reviewedBy?.trim()) throw new Error("Brand approval requires a reviewer");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn)) {
    throw new Error("Brand approval date must use YYYY-MM-DD");
  }
  const model = provenance.models?.[modelKey];
  if (!model?.canonicalSha256) {
    throw new Error(`${key}: reviewed source provenance is missing`);
  }
  const approval = {
    modelKey,
    reviewedBy: reviewedBy.trim(),
    reviewedOn,
    sourceSha256: model.canonicalSha256,
    status: "approved",
  };
  if (key === "league-owned-art") {
    const textures = model.generatorInputs?.ownedTextures;
    if (
      JSON.stringify(Object.keys(textures ?? {})) !==
      JSON.stringify(["LeagueBanDashboard", "LeagueMatchHistory"])
    ) {
      throw new Error("League approval requires the exact two owned textures");
    }
    approval.textureSha256 = Object.fromEntries(
      Object.entries(textures).map(([name, entry]) => [name, entry.sha256]),
    );
  }
  return approval;
}

async function readApprovals(filePath) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    if (value.schemaVersion !== 1 || !value.approvals) {
      throw new Error("brand-approvals.json must use schemaVersion 1");
    }
    return value;
  } catch (error) {
    if (error.code === "ENOENT") {
      return { schemaVersion: 1, approvals: {} };
    }
    throw error;
  }
}

export async function recordBrandApproval({
  root = process.cwd(),
  key,
  reviewedBy,
  reviewedOn,
}) {
  const manifest = await loadSourceManifest({ root });
  const provenance = await readSourceProvenance(root);
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance,
  });
  const outputPath = path.join(root, "assets/brand-approvals.json");
  const current = await readApprovals(outputPath);
  const output = {
    schemaVersion: 1,
    approvals: {
      ...current.approvals,
      [key]: buildBrandApproval({
        key,
        reviewedBy,
        reviewedOn,
        provenance,
      }),
    },
  };
  const temporaryPath = `${outputPath}.${process.pid}.next`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(temporaryPath, stringifyStable(output));
  await replaceFileAtomically(temporaryPath, outputPath);
  return output;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await recordBrandApproval({
      key: argument("--asset"),
      reviewedBy: argument("--reviewer"),
      reviewedOn: argument("--approved-on"),
    });
    console.log("brand approval recorded");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 9: Add exact source-generation package commands**

Run:

```powershell
npm pkg set 'scripts.assets:textures=node scripts/assets/render-source-textures.mjs'
npm pkg set 'scripts.assets:prepare=node scripts/assets/prepare-all.mjs'
```

Expected: both scripts appear exactly in `package.json`.

- [ ] **Step 10: Run the pure texture test before generating canonical Blender sources**

Run:

```powershell
node --test --test-name-pattern="source textures render" tests/assets/source-preparation.test.mjs
```

Expected: one test PASS and the other four source-preparation tests are skipped by the name filter. This closes the raster-rendering red/green loop before canonical `.blend` files exist.

- [ ] **Step 11: Render the three canonical source textures**

Run:

```powershell
npm run assets:textures
```

Expected: output is `source textures rendered`; the League PNGs are 1024 by 576 and the Froggie PNG is 1600 by 900.

- [ ] **Step 12: Curate the six imported canonical sources exactly once**

Run:

```powershell
npm run assets:prepare
```

Expected output contains `curated` for all six imported model keys followed by `source provenance written`. The command saves the canonical copies under `assets/blender/`; it never writes to `C:\Code\Blender Models`.

- [ ] **Step 13: Run all source-preparation integration tests and verify GREEN**

Run:

```powershell
node --test tests/assets/source-preparation.test.mjs
```

Expected: five tests PASS. The League test creates and inspects only `.tmp/assets/source-preparation-test/CraneOnLeague-curated.blend`; it does not save the canonical file. The Rocket test reads the canonical source without saving it, the provenance test proves unrelated drift cannot be blessed, and the approval test binds human review to immutable hashes.

- [ ] **Step 14: Verify the League source visually and bind approval to its hashes**

Run:

```powershell
& '.\.tools\blender-3.6.23-windows-x64\blender.exe' --disable-autoexec 'assets\blender\CraneOnLeague.blend'
```

Expected: inspect every visible surface, image datablock, and monitor face. The only raster images are `LeagueBanDashboard` and `LeagueMatchHistory`, both monitor faces show the repository-owned pastel art, no Riot champion/item/logo art is present, no surface is magenta, and the authored crane/workstation composition remains in place. Close Blender without saving.

Only after Richard explicitly approves that visual inspection, run:

```powershell
$approvedOn = (Get-Date).ToString('yyyy-MM-dd')
node scripts/assets/record-brand-approval.mjs --asset league-owned-art --reviewer 'Richard Phong' --approved-on $approvedOn
```

Expected: `brand approval recorded` and `assets/brand-approvals.json` contains `league-owned-art` bound to the current `CraneOnLeague.blend` SHA-256 and both owned PNG SHA-256 values. Do not run the command on Richard's behalf without his explicit visual approval.

- [ ] **Step 15: Prove the Rocket source is exportable and contains no named or visible official NASA asset**

Run:

```powershell
& '.\.tools\blender-3.6.23-windows-x64\blender.exe' --factory-startup --disable-autoexec --background 'assets\blender\Rocket.blend' --python-exit-code 1 --python 'scripts\assets\blender\inspect_scene.py' -- --report '.tmp\assets\rocket-inspection.json'
Get-Content -Raw '.tmp\assets\rocket-inspection.json'
```

Expected: the JSON contains `"particleSystems": []`, `"volumeObjects": []`, `"rootCount": 1`, and an empty `externalResources` array. `objects`, `packedImages`, `imageNames`, `textureNames`, and `materialNames` contain no case-insensitive `nasa`, `meatball`, or `worm`. Any non-empty particle or volume list is a hard stop because Blender particle systems and volume objects cannot be represented by this GLB contract.

Open the same canonical file interactively:

```powershell
& '.\.tools\blender-3.6.23-windows-x64\blender.exe' --disable-autoexec 'assets\blender\Rocket.blend'
```

Expected: inspect every visible side of the rocket, launch structure, and backdrop. There is no NASA meatball, worm, seal, logotype, or recognizable official logo. Close Blender without saving. A named-data scan is necessary but does not replace this visual signoff.

Only after Richard explicitly approves that visual inspection, run:

```powershell
$approvedOn = (Get-Date).ToString('yyyy-MM-dd')
node scripts/assets/record-brand-approval.mjs --asset rocket-brand-safety --reviewer 'Richard Phong' --approved-on $approvedOn
```

Expected: `brand approval recorded` and the second approval is bound to the current `Rocket.blend` SHA-256. Asset validation later rejects either approval if its reviewed source or League texture hashes change.

- [ ] **Step 16: Refactor gate**

Run:

```powershell
npm run lint
node --test tests/assets/source-manifest.test.mjs tests/assets/source-preparation.test.mjs
```

Expected: lint succeeds and nine tests PASS: four source-manifest tests plus five source-preparation tests. Keep source curation separate from export because curation is the only path authorized to save canonical `.blend` files.

- [ ] **Step 17: Commit curated sources, approvals, and owned textures**

Run:

```powershell
git add package.json assets/brand-approvals.json assets/blender/Crane.blend assets/blender/CraneWorkout.blend assets/blender/CraneMakingTable.blend assets/blender/CraneOnLeague.blend assets/blender/CraneThrowingPlane.blend assets/blender/Rocket.blend assets/blender/source-provenance.json assets/blender/textures/league-ban-dashboard.svg assets/blender/textures/league-match-history.svg assets/blender/textures/league-ban-dashboard.png assets/blender/textures/league-match-history.png assets/blender/textures/froggie-gameplay-screen.png scripts/assets/render-source-textures.mjs scripts/assets/prepare-all.mjs scripts/assets/record-brand-approval.mjs scripts/assets/blender/prepare_source.py scripts/assets/blender/inspect_scene.py tests/assets/source-preparation.test.mjs
git commit -m "build: curate Blender sources and League screens"
```

Expected: commit succeeds; no texture path points outside `assets/blender/textures/` and no `.blend1` file is staged.

### Task 4: Author the canonical Froggie display scene

> **2026-07-10 implementation amendment:** The reviewed first pass is a deterministic frog-faced arcade kiosk rather than the older nine-object inline recipe below. The export payload contains thirteen semantically named mesh objects beneath one inert `WEB_EXPORT_ROOT`, including paired frog eyes and pupils, a 3.45 by 1.94 gameplay screen, and applied low-poly bevel geometry. Exact authored palette values are converted from sRGB hex to Blender linear color. A deterministic look-at reference camera and Eevee key light stay outside the export root. The scene contains no ground, receiver, shadow-catcher, particle, volume, animation, or unapplied modifier; website grounding is owned by the transparent WebGL canvas and optional contact/blob shadow. The Node wrapper stages the bound Froggie texture, candidate blend, and provenance as one rollback-safe promotion, and refuses implicit canonical replacement. Focused tests compare two independent semantic builds, enforce the ground-free export contract, and prove blend/texture rollback when provenance finalization fails. The approval preview is rendered in GPU Eevee with transparent film and composited over the exact Projects route blue `#AFD4E1`. This amendment supersedes conflicting geometry, world, camera-Euler, and non-transactional wrapper details in the original inline recipe while preserving its source, provenance, size, command, and approval requirements.

**Files:**

- Create: `assets/blender/FroggieDisplay.blend`
- Create: `scripts/assets/create-froggie-display.mjs`
- Create: `scripts/assets/blender/create_froggie_display.py`
- Create: `tests/assets/froggie-display.test.mjs`
- Modify: `assets/blender/source-provenance.json`
- Modify: `scripts/assets/blender/inspect_scene.py`
- Modify: `package.json`

**Interfaces:**

- Consumes: `assets/blender/textures/froggie-gameplay-screen.png`, `runPreflight`, `runBlenderScript`, and `writeSourceProvenance`.
- Produces: `assertFroggieReplacementAllowed({ canonical, exists, replace })` and `createFroggieDisplay({ root, output, writeProvenance, replace }): Promise<void>`.
- Establishes: `assets:froggie` for first creation and `assets:froggie:replace` as the only command allowed to replace an existing reviewed canonical Froggie source after the authored screenshot/crop manifest is intentionally updated.
- Produces: a packed-texture, sub-2,000-triangle Blender source with exactly one `WEB_EXPORT_ROOT` and stable object names used by tests and later visual review.

- [ ] **Step 1: Write the failing Froggie authoring test**

Create `tests/assets/froggie-display.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertFroggieReplacementAllowed,
  createFroggieDisplay,
} from "../../scripts/assets/create-froggie-display.mjs";
import { resolveBlenderBin, runBlenderScript } from "../../scripts/assets/lib/blender.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, ".tmp/assets/froggie-display-test");

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("Froggie display is a packed, bounded low-poly canonical scene", async () => {
  const output = path.join(tempRoot, "FroggieDisplay.blend");
  const report = path.join(tempRoot, "inspection.json");
  await createFroggieDisplay({ root, output, writeProvenance: false });

  runBlenderScript({
    blenderBin: resolveBlenderBin({ root }),
    blendFile: output,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", report],
    cwd: root,
  });

  const inspection = JSON.parse(await readFile(report, "utf8"));
  assert.equal(inspection.rootCount, 1);
  assert.deepEqual(inspection.externalResources, []);
  assert.deepEqual(inspection.particleSystems, []);
  assert.deepEqual(inspection.volumeObjects, []);
  assert.deepEqual(inspection.packedImages, ["FroggieGameplay"]);
  assert.deepEqual(inspection.packedImageSha256, {
    FroggieGameplay: await sha256File(
      path.join(root, "assets/blender/textures/froggie-gameplay-screen.png"),
    ),
  });
  assert.ok(inspection.objects.includes("ArcadeCabinet"));
  assert.ok(inspection.objects.includes("GameplayScreen"));
  assert.ok(inspection.objects.includes("Joystick"));
  assert.ok(inspection.objects.includes("ActionButtonA"));
  assert.ok(inspection.objects.includes("ActionButtonB"));
  assert.ok(inspection.triangleEstimate > 0);
  assert.ok(inspection.triangleEstimate <= 2000, `triangle estimate was ${inspection.triangleEstimate}`);
});

test("an existing canonical Froggie source requires the explicit replacement path", () => {
  assert.throws(
    () =>
      assertFroggieReplacementAllowed({
        canonical: true,
        exists: true,
        replace: false,
      }),
    /--replace/,
  );
  assert.doesNotThrow(() =>
    assertFroggieReplacementAllowed({
      canonical: true,
      exists: true,
      replace: true,
    }),
  );
  assert.throws(
    () =>
      assertFroggieReplacementAllowed({
        canonical: false,
        exists: false,
        replace: true,
      }),
    /canonical output/,
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/assets/froggie-display.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/create-froggie-display.mjs`.

- [ ] **Step 3: Implement deterministic Froggie Blender authoring**

Create `scripts/assets/blender/create_froggie_display.py` with this complete content:

```python
import argparse
import math
import sys
from pathlib import Path

import bpy

EXPECTED_VERSION = (3, 6, 23)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--texture", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def solid_material(name, color, metallic=0.0, roughness=0.65):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return material


def screen_material(texture_path):
    image = bpy.data.images.load(str(texture_path), check_existing=False)
    image.name = "FroggieGameplay"
    image.filepath = "//textures/froggie-gameplay-screen.png"
    image.pack()
    material = bpy.data.materials.new("GameplayScreenMaterial")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    principled.inputs["Roughness"].default_value = 0.35
    principled.inputs["Emission Strength"].default_value = 0.35
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    links.new(texture.outputs["Color"], principled.inputs["Emission"])
    return material


def add_box(name, dimensions, location, material, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("SoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(material)
    return obj


def add_cylinder(name, radius, depth, location, material, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("SoftEdges", "BEVEL")
    bevel.width = 0.04
    bevel.segments = 2
    return obj


def add_screen(material):
    bpy.ops.mesh.primitive_plane_add(
        size=2.0,
        location=(0.0, -0.286, 3.0),
        rotation=(math.radians(90.0), 0.0, 0.0),
        scale=(1.6, 0.9, 1.0),
    )
    screen = bpy.context.object
    screen.name = "GameplayScreen"
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    screen.data.materials.append(material)
    return screen


def add_joystick(stem_material, ball_material):
    stem = add_cylinder("JoystickStem", 0.07, 0.55, (-0.78, -0.82, 2.22), stem_material, vertices=12)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.18, location=(-0.78, -0.82, 2.53))
    ball = bpy.context.object
    ball.name = "Joystick"
    ball.data.materials.append(ball_material)
    return [stem, ball]


def parent_to_root(root, objects):
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world


def add_reference_camera_and_light():
    bpy.ops.object.camera_add(location=(7.2, -9.4, 6.2), rotation=(math.radians(67), 0.0, math.radians(38)))
    bpy.context.object.name = "ReferenceCamera"
    bpy.context.scene.camera = bpy.context.object
    bpy.ops.object.light_add(type="AREA", location=(2.8, -4.0, 7.5))
    light = bpy.context.object
    light.name = "ReferenceKeyLight"
    light.data.energy = 850
    light.data.shape = "DISK"
    light.data.size = 5.0


def main():
    args = parse_args()
    require(tuple(bpy.app.version) == EXPECTED_VERSION, f"Expected Blender {EXPECTED_VERSION}, got {tuple(bpy.app.version)}")
    texture_path = Path(args.texture).resolve()
    output_path = Path(args.output).resolve()
    require(texture_path.is_file(), f"Froggie screen texture is missing: {texture_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    root = bpy.data.objects.new("WEB_EXPORT_ROOT", None)
    root["asset_pipeline_version"] = 1
    bpy.context.scene.collection.objects.link(root)

    navy = solid_material("CabinetNavy", (0.09, 0.16, 0.18), metallic=0.05, roughness=0.55)
    green = solid_material("FroggieGreen", (0.34, 0.68, 0.12), roughness=0.5)
    clay = solid_material("WarmClay", (0.61, 0.29, 0.22), roughness=0.72)
    cream = solid_material("WarmCream", (0.92, 0.82, 0.61), roughness=0.8)
    pink = solid_material("ActionPink", (0.86, 0.32, 0.42), roughness=0.42)
    screen = screen_material(texture_path)

    objects = [
        add_box("ArcadeBase", (2.8, 1.7, 0.42), (0.0, 0.0, 0.24), navy, 0.12),
        add_box("ArcadePedestal", (1.8, 1.18, 1.65), (0.0, 0.12, 1.24), clay, 0.1),
        add_box("ArcadeCabinet", (4.0, 0.55, 2.5), (0.0, 0.0, 3.0), navy, 0.14),
        add_box("ControlDeck", (3.25, 1.08, 0.25), (0.0, -0.58, 1.94), cream, 0.08),
        add_screen(screen),
        add_cylinder("ActionButtonA", 0.16, 0.1, (0.62, -0.86, 2.11), pink, vertices=16),
        add_cylinder("ActionButtonB", 0.16, 0.1, (1.06, -0.86, 2.11), green, vertices=16),
    ]
    objects.extend(add_joystick(navy, green))
    parent_to_root(root, objects)
    add_reference_camera_and_light()

    bpy.context.scene.world.color = (0.12, 0.18, 0.16)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), check_existing=False, compress=True)
    print(f"Froggie display created: {output_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Implement the Node authoring wrapper**

Create `scripts/assets/create-froggie-display.mjs` with this complete content:

```js
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBlenderScript } from "./lib/blender.mjs";
import { runPreflight } from "./preflight.mjs";
import {
  assertReviewedSourcesUnchanged,
  readSourceProvenance,
  replaceFileAtomically,
  writeSourceProvenance,
} from "./prepare-all.mjs";
import { renderSourceTextures } from "./render-source-textures.mjs";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function createFroggieDisplay({
  root = process.cwd(),
  output = path.join(root, "assets/blender/FroggieDisplay.blend"),
  writeProvenance = true,
  replace = false,
} = {}) {
  const { blenderBin, manifest } = await runPreflight({ root, allowGeneratedMissing: true });
  const canonicalOutput = path.join(root, "assets/blender/FroggieDisplay.blend");
  const canonical = path.resolve(output) === path.resolve(canonicalOutput);
  const outputExists = await exists(output);
  assertFroggieReplacementAllowed({ canonical, exists: outputExists, replace });
  const provenance = await readSourceProvenance(root);
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance,
    ignoreKeys: ["froggie-display"],
  });
  await renderSourceTextures({ root });
  const temporaryOutput = `${output}.${process.pid}.next`;
  runBlenderScript({
    blenderBin,
    script: path.join(root, "scripts/assets/blender/create_froggie_display.py"),
    scriptArgs: [
      "--texture", path.join(root, "assets/blender/textures/froggie-gameplay-screen.png"),
      "--output", temporaryOutput,
    ],
    cwd: root,
  });
  await replaceFileAtomically(temporaryOutput, output);
  if (writeProvenance) {
    await writeSourceProvenance({
      root,
      manifest,
      updateKeys: ["froggie-display"],
    });
  }
}

export function assertFroggieReplacementAllowed({
  canonical,
  exists,
  replace,
}) {
  if (replace && !canonical) {
    throw new Error("--replace is permitted only for the canonical output");
  }
  if (canonical && exists && !replace) {
    throw new Error(
      "FroggieDisplay.blend already exists; use --replace only after reviewing and updating the authored capture contract.",
    );
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await createFroggieDisplay({ replace: process.argv.includes("--replace") });
    console.log("canonical Froggie display created");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Add the exact Froggie authoring command**

Run:

```powershell
npm pkg set 'scripts.assets:froggie=node scripts/assets/create-froggie-display.mjs'
npm pkg set 'scripts.assets:froggie:replace=node scripts/assets/create-froggie-display.mjs --replace'
```

Expected: `package.json` exposes both exact commands. `assets:froggie` refuses to overwrite an existing canonical file; `assets:froggie:replace` is explicit and source-hash-bound.

- [ ] **Step 6: Run the generated-source test and verify GREEN**

Run:

```powershell
node --test tests/assets/froggie-display.test.mjs
```

Expected: two tests PASS and the temporary blend is removed after the test process.

- [ ] **Step 7: Generate the canonical Froggie source and refresh provenance**

Run:

```powershell
npm run assets:froggie
```

Expected output ends with `canonical Froggie display created`; `assets/blender/FroggieDisplay.blend` exists and `source-provenance.json` contains `froggie-display` with a canonical SHA-256.

- [ ] **Step 8: Verify the authored display visually**

Run:

```powershell
& '.\.tools\blender-3.6.23-windows-x64\blender.exe' --disable-autoexec 'assets\blender\FroggieDisplay.blend'
```

Expected: the display is visibly low-poly, the authentic gameplay crop fills the screen without capture-window chrome, and the joystick plus two buttons read clearly from the reference camera. Close Blender without saving.

Future screenshot replacement is deliberately explicit. Replace only the tracked `ReferenceImages/Froggie Gameplay.png`, then record its exact new values:

```powershell
$reference = Get-Item -LiteralPath 'ReferenceImages\Froggie Gameplay.png'
$reference.Length
(Get-FileHash -Algorithm SHA256 -LiteralPath $reference.FullName).Hash.ToLowerInvariant()
```

After reviewing the new frame, update `froggieCapture.bytes`, `froggieCapture.sha256`, and the integer crop in `assets/scene-sources.json`; mirror those exact values in the `manifest.froggieCapture` assertion in `tests/assets/source-manifest.test.mjs`. Run `node --test tests/assets/source-manifest.test.mjs`, then `npm run assets:textures` and inspect `assets/blender/textures/froggie-gameplay-screen.png` before running `npm run assets:froggie:replace`. Reopen the canonical blend and repeat this visual check before committing the reference image, manifest, test assertion, generated PNG, canonical blend, and refreshed provenance together. Normal `assets:all` rerenders and verifies the bound PNG but never replaces `FroggieDisplay.blend`.

- [ ] **Step 9: Run strict preflight now that all seven sources exist**

Run:

```powershell
npm run assets:preflight
```

Expected: `asset preflight ok: Blender 3.6.23` with no pending-source line.

- [ ] **Step 10: Refactor gate**

Run:

```powershell
npm run lint
node --test tests/assets/froggie-display.test.mjs tests/assets/source-manifest.test.mjs
```

Expected: lint succeeds and six tests PASS: two Froggie tests plus four source-manifest tests. Keep deterministic Blender construction in Python and process/provenance concerns in the Node wrapper.

- [ ] **Step 11: Commit the generated canonical scene**

Run:

```powershell
git add package.json assets/blender/FroggieDisplay.blend assets/blender/source-provenance.json scripts/assets/create-froggie-display.mjs scripts/assets/blender/create_froggie_display.py tests/assets/froggie-display.test.mjs
git commit -m "feat: author Froggie display scene"
```

Expected: commit succeeds and the generated source passes the sub-2,000-triangle test.

### Task 5: Export immutable raw GLBs from canonical sources

> **2026-07-11 implementation amendment:** Raw export uses the current shared `inspect_scene.py` contract rather than the stale embedded inspector below. Strict preflight and `assertReviewedSourcesUnchanged` bind all seven canonicals plus their reviewed texture/capture inputs before any export. The ephemeral Blender process temporarily reveals hidden export descendants so required rigs such as Workout's armature are selected without saving source changes; it exports only `WEB_EXPORT_ROOT` and descendants with `export_apply=False`. Source hashes are checked after every Blender attempt, including failures, and again before publication. All GLBs and reports are staged under unique names and promoted as one rollback-safe batch, so a later-model failure cannot partially replace an earlier raw set. Node parses each produced GLB and enforces one `WEB_EXPORT_ROOT` scene root, embedded buffers/images, the exact owned-image allowlist, no cameras/lights, and exact preservation of every canonical action name (including Workout, Plane, and Rocket clips). Each final report is a stable attestation envelope `{ schemaVersion, key, sourceSha256, rawSha256, rawGlb, inspection }`, allowing later optimization to reject swapped or tampered ignored inputs. Only the three material node types present in the reviewed sources are allowed; unreferenced Blender system-viewer images remain harmless. This amendment supersedes conflicting direct-write, success-only hash-check, source-action-count, broad shader allowlist, and report-shape details below.

**Files:**

- Create: `scripts/assets/export-all.mjs`
- Create: `scripts/assets/blender/export_scene.py`
- Create: `tests/assets/export-contract.test.mjs`
- Modify: `package.json`
- Create ignored outputs: `.tmp/assets/raw/*.glb`
- Create ignored reports: `.tmp/assets/reports/*.json`

**Interfaces:**

- Consumes: strict `runPreflight`, canonical SHA-256 values from `source-provenance.json`, and every manifest model record.
- Produces: `assertExportableInspection(inspection, model, provenanceEntry)` and `exportAll({ root, only, rawRoot, reportRoot }): Promise<ExportRecord[]>`.
- Produces: each `ExportRecord` as `{ key, rawPath, reportPath, sourceSha256, inspection }`.
- Guarantees: source hash before export equals source hash after export; raw GLBs contain one root and no cameras/lights; raw files remain ignored.

- [ ] **Step 1: Write the failing export-contract tests**

Create `tests/assets/export-contract.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertExportableInspection,
  exportAll,
} from "../../scripts/assets/export-all.mjs";
import { sha256File } from "../../scripts/assets/lib/manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, ".tmp/assets/export-contract-test");

const validInspection = {
  animations: [],
  externalResources: [],
  materialNodeTypes: ["ShaderNodeBsdfPrincipled", "ShaderNodeOutputMaterial"],
  objects: ["WEB_EXPORT_ROOT", "Crane"],
  packedImages: [],
  packedImageSha256: {},
  particleSystems: [],
  rootCount: 1,
  rootTransform: { location: [0, 0, 0], rotationEuler: [0, 0, 0], scale: [1, 1, 1] },
  triangleEstimate: 12,
  unsupportedMaterialNodes: [],
  volumeObjects: [],
};

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("inspection rejects every unsupported export condition", () => {
  const model = { key: "fixture", minimumAnimations: 0 };
  assert.doesNotThrow(() => assertExportableInspection(validInspection, model));
  assert.throws(() => assertExportableInspection({ ...validInspection, rootCount: 0 }, model), /exactly one WEB_EXPORT_ROOT/);
  assert.throws(() => assertExportableInspection({ ...validInspection, externalResources: [{ kind: "image" }] }, model), /external resources/);
  assert.throws(() => assertExportableInspection({ ...validInspection, particleSystems: ["Smoke"] }, model), /particle systems/);
  assert.throws(() => assertExportableInspection({ ...validInspection, volumeObjects: ["Fog"] }, model), /volume objects/);
  assert.throws(() => assertExportableInspection({ ...validInspection, unsupportedMaterialNodes: ["ShaderNodeTexNoise"] }, model), /unsupported material nodes/);
  assert.throws(() => assertExportableInspection({ ...validInspection, triangleEstimate: 0 }, model), /no triangles/);
  assert.throws(
    () =>
      assertExportableInspection(
        {
          ...validInspection,
          packedImages: ["UnreviewedOfficialArt"],
          packedImageSha256: { UnreviewedOfficialArt: "a".repeat(64) },
        },
        model,
        {},
      ),
    /packed image allowlist/,
  );
  assert.throws(
    () => assertExportableInspection(validInspection, { key: "animated", minimumAnimations: 1 }),
    /at least 1 animation/,
  );
});

test("exporting one source writes a GLB and never changes the canonical blend hash", async () => {
  await mkdir(tempRoot, { recursive: true });
  const sourcePath = path.join(root, "assets/blender/Crane.blend");
  const before = await sha256File(sourcePath);
  const [record] = await exportAll({
    root,
    only: "crane",
    rawRoot: path.join(tempRoot, "raw"),
    reportRoot: path.join(tempRoot, "reports"),
  });
  const after = await sha256File(sourcePath);
  const bytes = await readFile(record.rawPath);

  assert.equal(before, after);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  assert.equal(record.inspection.rootCount, 1);
  assert.deepEqual(record.inspection.externalResources, []);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test tests/assets/export-contract.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/export-all.mjs`.

- [ ] **Step 3: Implement read-only Blender GLB export and source inspection**

Create `scripts/assets/blender/export_scene.py` with this complete content:

```python
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy

EXPECTED_VERSION = (3, 6, 23)
SUPPORTED_MATERIAL_NODES = {
    "ShaderNodeAttribute",
    "ShaderNodeBsdfPrincipled",
    "ShaderNodeCombineColor",
    "ShaderNodeCombineRGB",
    "ShaderNodeEmission",
    "ShaderNodeMapping",
    "ShaderNodeMath",
    "ShaderNodeMix",
    "ShaderNodeMixRGB",
    "ShaderNodeNormalMap",
    "ShaderNodeOutputMaterial",
    "ShaderNodeRGB",
    "ShaderNodeSeparateColor",
    "ShaderNodeSeparateRGB",
    "ShaderNodeTexCoord",
    "ShaderNodeTexImage",
    "ShaderNodeUVMap",
    "ShaderNodeValue",
    "ShaderNodeVectorMath",
    "ShaderNodeVertexColor",
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def triangle_estimate(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            total += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return total


def packed_image_sha256(image):
    if not image.packed_file:
        return None
    return hashlib.sha256(bytes(image.packed_file.data)).hexdigest()


def inspect(root, export_objects):
    external_resources = []
    packed_images = []
    for image in bpy.data.images:
        if image.source != "FILE":
            continue
        if image.packed_file:
            packed_images.append(image.name)
        else:
            external_resources.append({"kind": "image", "name": image.name, "path": image.filepath})
    for library in bpy.data.libraries:
        if library.filepath:
            external_resources.append({"kind": "library", "name": library.name, "path": library.filepath})

    material_node_types = sorted({
        node.bl_idname
        for material in bpy.data.materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
    })
    return {
        "animations": sorted(action.name for action in bpy.data.actions),
        "externalResources": sorted(external_resources, key=lambda item: (item["kind"], item["name"])),
        "materialNodeTypes": material_node_types,
        "objects": sorted(obj.name for obj in export_objects),
        "packedImages": sorted(packed_images),
        "packedImageSha256": {
            image.name: packed_image_sha256(image)
            for image in sorted(bpy.data.images, key=lambda item: item.name)
            if image.source == "FILE" and image.packed_file
        },
        "particleSystems": sorted(obj.name for obj in export_objects if len(obj.particle_systems) > 0),
        "rootCount": 1,
        "rootTransform": {
            "location": [round(float(value), 6) for value in root.location],
            "rotationEuler": [round(float(value), 6) for value in root.rotation_euler],
            "scale": [round(float(value), 6) for value in root.scale],
        },
        "triangleEstimate": triangle_estimate(export_objects),
        "unsupportedMaterialNodes": sorted(set(material_node_types) - SUPPORTED_MATERIAL_NODES),
        "volumeObjects": sorted(obj.name for obj in export_objects if obj.type == "VOLUME"),
    }


def main():
    args = parse_args()
    require(tuple(bpy.app.version) == EXPECTED_VERSION, f"Expected Blender {EXPECTED_VERSION}, got {tuple(bpy.app.version)}")
    require(bool(bpy.data.filepath), "A canonical source .blend must be open")
    roots = [obj for obj in bpy.data.objects if obj.name == "WEB_EXPORT_ROOT"]
    require(len(roots) == 1, f"Expected exactly one WEB_EXPORT_ROOT, found {len(roots)}")
    root = roots[0]
    export_objects = [root, *descendants(root)]
    inspection = inspect(root, export_objects)

    require(inspection["externalResources"] == [], f"External resources are forbidden: {inspection['externalResources']}")
    require(inspection["particleSystems"] == [], f"Particle systems are not exportable: {inspection['particleSystems']}")
    require(inspection["volumeObjects"] == [], f"Volume objects are not exportable: {inspection['volumeObjects']}")
    require(inspection["unsupportedMaterialNodes"] == [], f"Unsupported material nodes: {inspection['unsupportedMaterialNodes']}")
    require(inspection["triangleEstimate"] > 0, "Export root contains no mesh triangles")

    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    output_path = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_frame_range=False,
        export_force_sampling=True,
        export_nla_strips=True,
        export_def_bones=False,
    )
    require(output_path.is_file(), f"Blender did not write {output_path}")
    require(output_path.read_bytes()[:4] == b"glTF", "Blender output is not binary glTF")
    report_path.write_text(json.dumps(inspection, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"raw GLB exported: {output_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Implement source-immutable export orchestration**

Create `scripts/assets/export-all.mjs` with this complete content:

```js
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBlenderScript } from "./lib/blender.mjs";
import { sha256File } from "./lib/manifest.mjs";
import { runPreflight } from "./preflight.mjs";

export function assertExportableInspection(
  inspection,
  model,
  provenanceEntry = {},
) {
  if (inspection.rootCount !== 1) throw new Error(`${model.key}: expected exactly one WEB_EXPORT_ROOT`);
  if (inspection.externalResources.length) throw new Error(`${model.key}: external resources remain`);
  if (inspection.particleSystems.length) throw new Error(`${model.key}: particle systems are unsupported`);
  if (inspection.volumeObjects.length) throw new Error(`${model.key}: volume objects are unsupported`);
  if (inspection.unsupportedMaterialNodes.length) throw new Error(`${model.key}: unsupported material nodes: ${inspection.unsupportedMaterialNodes.join(", ")}`);
  if (inspection.triangleEstimate <= 0) throw new Error(`${model.key}: export root has no triangles`);
  const expectedPackedImageSha256 = Object.fromEntries(
    (model.ownedTextures ?? []).map((texture) => [
      texture.name,
      provenanceEntry.generatorInputs?.ownedTextures?.[texture.name]?.sha256,
    ]),
  );
  if (
    JSON.stringify(inspection.packedImageSha256 ?? {}) !==
    JSON.stringify(expectedPackedImageSha256)
  ) {
    throw new Error(`${model.key}: packed image allowlist or SHA-256 values drifted`);
  }
  if (inspection.animations.length < model.minimumAnimations) {
    throw new Error(`${model.key}: expected at least ${model.minimumAnimations} animation clip(s)`);
  }
}

export async function exportAll({
  root = process.cwd(),
  only = null,
  rawRoot = path.join(root, ".tmp/assets/raw"),
  reportRoot = path.join(root, ".tmp/assets/reports"),
} = {}) {
  const { blenderBin, manifest } = await runPreflight({ root });
  const provenance = JSON.parse(await readFile(path.join(root, "assets/blender/source-provenance.json"), "utf8"));
  const selected = manifest.models.filter((model) => !only || model.key === only);
  if (only && selected.length !== 1) throw new Error(`Unknown model key: ${only}`);
  await mkdir(rawRoot, { recursive: true });
  await mkdir(reportRoot, { recursive: true });

  const records = [];
  for (const model of selected) {
    const sourcePath = path.join(root, model.source);
    const expectedHash = provenance.models?.[model.key]?.canonicalSha256;
    const before = await sha256File(sourcePath);
    if (!expectedHash || before !== expectedHash) {
      throw new Error(`${model.key}: canonical source does not match source-provenance.json`);
    }

    const rawPath = path.join(rawRoot, `${model.key}.glb`);
    const reportPath = path.join(reportRoot, `${model.key}.json`);
    runBlenderScript({
      blenderBin,
      blendFile: sourcePath,
      script: path.join(root, "scripts/assets/blender/export_scene.py"),
      scriptArgs: ["--output", rawPath, "--report", reportPath],
      cwd: root,
    });

    const after = await sha256File(sourcePath);
    if (after !== before) throw new Error(`${model.key}: export changed the canonical .blend file`);
    const inspection = JSON.parse(await readFile(reportPath, "utf8"));
    assertExportableInspection(
      inspection,
      model,
      provenance.models[model.key],
    );
    records.push({ key: model.key, rawPath, reportPath, sourceSha256: before, inspection });
    console.log(`exported ${model.key}`);
  }
  return records;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
  try {
    await exportAll({ only });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Add the exact export command**

Run:

```powershell
npm pkg set 'scripts.assets:export=node scripts/assets/export-all.mjs'
```

Expected: `package.json` exposes `assets:export` exactly.

- [ ] **Step 6: Run the export-contract tests and verify GREEN**

Run:

```powershell
node --test tests/assets/export-contract.test.mjs
```

Expected: two tests PASS; the canonical `Crane.blend` hash is identical before and after the test.

- [ ] **Step 7: Export all seven raw GLBs**

Run:

```powershell
npm run assets:export
```

Expected: seven `exported <model-key>` lines. `.tmp/assets/raw/` contains seven GLBs and `.tmp/assets/reports/` contains seven JSON reports. If this command reports a particle system, volume, missing image, or unsupported procedural material node, keep the failure and revise the canonical source in a dedicated reviewed curation commit; do not weaken the exporter contract.

- [ ] **Step 8: Verify Workout clips survived Blender export**

Run:

```powershell
(Get-Content -Raw '.tmp\assets\reports\crane-workout.json' | ConvertFrom-Json).animations
```

Expected: at least one non-empty animation name is printed.

- [ ] **Step 9: Refactor gate**

Run:

```powershell
npm run lint
node --test tests/assets/export-contract.test.mjs tests/assets/blender-toolchain.test.mjs
```

Expected: lint succeeds and seven tests PASS. Keep Blender-specific inspection in Python and source-hash/orchestration logic in Node.

- [ ] **Step 10: Commit the exporter contract**

Run:

```powershell
git add package.json scripts/assets/export-all.mjs scripts/assets/blender/export_scene.py tests/assets/export-contract.test.mjs
git commit -m "build: export immutable raw GLBs"
```

Expected: commit succeeds; `.tmp/assets/raw` and `.tmp/assets/reports` remain untracked.

### Task 6: Optimize and publish runtime GLBs with WebP and Meshopt

> **2026-07-11 implementation amendment:** Optimization first verifies Node 22.15+, every pinned package, all reviewed source inputs, and the Task 5 `{ key, sourceSha256, rawSha256 }` attestation for each ignored raw GLB. It applies only `dedup({ keepUniqueNames: true })`, preservation-oriented `prune`, bitwise `weld`, zero-tolerance `resample`, WebP quality 88/effort 100/Lanczos3 at a 1024-pixel cap, and Meshopt medium. Meshopt medium includes quantization, so this is intentionally GPU-oriented but not described as lossless; no simplification runs. A strict dependency-free GLB parser validates chunks, physical and Meshopt fallback buffers, buffer views, accessors, embedded image payloads, and URI/range safety. Every candidate must retain one `WEB_EXPORT_ROOT`, exact rendered triangle/primitive totals, animation clip/channel targets, image names, and model byte budgets; Meshopt plus `KHR_mesh_quantization` are used and required for all models, and League/Froggie additionally use and require 1024x576 WebP. Draco, KTX2, and AVIF are forbidden, and a registered decoder must reopen each result. All seven validated candidates are promoted through one rollback-safe transaction, preventing partial `public/models` publication. This amendment supersedes the older per-file replacement, one-textured-model test, Node 22.13, and extension-expectation details below.

**Files:**

- Create: `scripts/assets/lib/glb.mjs`
- Create: `scripts/assets/optimize.mjs`
- Create: `tests/assets/optimization.test.mjs`
- Create: `tests/assets/glb-parser.test.mjs`
- Create: `public/models/crane.glb`
- Create: `public/models/crane-workout.glb`
- Create: `public/models/crane-making-table.glb`
- Create: `public/models/crane-on-league.glb`
- Create: `public/models/crane-throwing-plane.glb`
- Create: `public/models/rocket.glb`
- Create: `public/models/froggie-display.glb`
- Modify: `package.json`

**Interfaces:**

- Consumes: ignored raw GLBs named `<model-key>.glb`, source manifest `textureMode`, and exact optimization dependencies from Task 1.
- Produces: `readGlbJsonBuffer(buffer): object`, `readGlbImagePayloads(buffer, json): ImagePayload[]`, and `readGlbJson(path): Promise<object>`.
- Produces: `optimizeAll({ root, only, rawRoot, outputRoot }): Promise<OptimizedRecord[]>`, where each record is `{ key, outputPath, bytes }`.
- Guarantees: every published model uses `EXT_meshopt_compression`; textured League and Froggie assets embed WebP capped at 1024 by 1024; no geometry simplification runs.

- [ ] **Step 1: Write the failing optimization integration test**

Create `tests/assets/optimization.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportAll } from "../../scripts/assets/export-all.mjs";
import {
  readGlbImagePayloads,
  readGlbJson,
} from "../../scripts/assets/lib/glb.mjs";
import { optimizeAll } from "../../scripts/assets/optimize.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, ".tmp/assets/optimization-test");

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("League optimization embeds WebP and requires Meshopt without simplification", async () => {
  const rawRoot = path.join(tempRoot, "raw");
  const outputRoot = path.join(tempRoot, "published");
  await exportAll({
    root,
    only: "crane-on-league",
    rawRoot,
    reportRoot: path.join(tempRoot, "reports"),
  });
  const [record] = await optimizeAll({ root, only: "crane-on-league", rawRoot, outputRoot });
  const json = await readGlbJson(record.outputPath);

  assert.ok(json.extensionsRequired.includes("EXT_meshopt_compression"));
  assert.ok(json.extensionsUsed.includes("EXT_meshopt_compression"));
  assert.ok(json.extensionsUsed.includes("EXT_texture_webp"));
  assert.ok(json.images.some((image) => image.mimeType === "image/webp"));
  const payloads = readGlbImagePayloads(
    await readFile(record.outputPath),
    json,
  );
  assert.deepEqual(
    payloads.map((payload) => payload.name),
    ["LeagueBanDashboard", "LeagueMatchHistory"],
  );
  assert.ok(
    payloads.every(
      (payload) =>
        payload.mimeType === "image/webp" &&
        payload.bytes > 0 &&
        /^[a-f0-9]{64}$/.test(payload.sha256),
    ),
  );
  assert.ok(record.bytes > 0);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/assets/optimization.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/lib/glb.mjs`.

- [ ] **Step 3: Implement strict binary GLB JSON parsing**

Create `scripts/assets/lib/glb.mjs` with this complete content:

```js
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function readGlbChunks(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("GLB input must be a Buffer");
  if (buffer.length < 20 || buffer.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error("Malformed GLB: missing glTF magic");
  }
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) {
    throw new Error(`Malformed GLB: expected version 2, received ${version}`);
  }
  if (declaredLength !== buffer.length) {
    throw new Error(
      `Malformed GLB: declared ${declaredLength} bytes, received ${buffer.length}`,
    );
  }
  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      throw new Error("Malformed GLB: truncated chunk header");
    }
    const byteLength = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const end = dataOffset + byteLength;
    if (byteLength % 4 !== 0 || end > buffer.length) {
      throw new Error("Malformed GLB: chunk is unaligned or out of bounds");
    }
    chunks.push({ byteLength, dataOffset, type });
    offset = end;
  }
  if (chunks[0]?.type !== JSON_CHUNK_TYPE) {
    throw new Error("Malformed GLB: first chunk must be JSON");
  }
  return chunks;
}

export function readGlbJsonBuffer(buffer) {
  const [jsonChunk] = readGlbChunks(buffer);
  const jsonText = buffer
    .subarray(jsonChunk.dataOffset, jsonChunk.dataOffset + jsonChunk.byteLength)
    .toString("utf8")
    .replace(/[\u0000\u0020]+$/g, "");
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Malformed GLB JSON: ${error.message}`);
  }
}

export function readGlbImagePayloads(
  buffer,
  json = readGlbJsonBuffer(buffer),
) {
  const binChunk = readGlbChunks(buffer).find(
    (chunk) => chunk.type === BIN_CHUNK_TYPE,
  );
  if ((json.images ?? []).length > 0 && !binChunk) {
    throw new Error("Malformed GLB: embedded images require a BIN chunk");
  }
  const payloads = (json.images ?? []).map((image) => {
    if (image.uri !== undefined) {
      throw new Error("Malformed GLB: image payload cannot use a URI");
    }
    const view = json.bufferViews?.[image.bufferView];
    if (!view || (view.buffer ?? 0) !== 0) {
      throw new Error(`Malformed GLB: ${image.name ?? "unnamed image"} has no valid bufferView`);
    }
    const start = binChunk.dataOffset + (view.byteOffset ?? 0);
    const end = start + view.byteLength;
    const binEnd = binChunk.dataOffset + binChunk.byteLength;
    if (start < binChunk.dataOffset || end > binEnd) {
      throw new Error(`Malformed GLB: ${image.name ?? "unnamed image"} payload is out of bounds`);
    }
    const payload = buffer.subarray(start, end);
    return {
      name: image.name ?? "",
      mimeType: image.mimeType ?? "",
      bytes: payload.length,
      sha256: createHash("sha256").update(payload).digest("hex"),
    };
  });
  return payloads.sort((left, right) => left.name.localeCompare(right.name));
}

export async function readGlbJson(filePath) {
  return readGlbJsonBuffer(await readFile(filePath));
}
```

- [ ] **Step 4: Implement explicit optimization without mesh simplification**

Create `scripts/assets/optimize.mjs` with this complete content:

```js
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  meshopt,
  prune,
  resample,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

import { loadSourceManifest } from "./lib/manifest.mjs";

function createIo() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
}

async function replaceFileAtomically(temporaryPath, outputPath) {
  const backupPath = `${outputPath}.${process.pid}.backup`;
  let movedExisting = false;
  try {
    await rename(outputPath, backupPath);
    movedExisting = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (movedExisting) await rename(backupPath, outputPath);
    throw error;
  }
  if (movedExisting) await rm(backupPath, { force: true });
}

export async function optimizeOne({ inputPath, outputPath, textureMode }) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = createIo();
  const document = await io.read(inputPath);
  await document.transform(dedup(), prune(), weld(), resample());
  if (textureMode === "webp") {
    await document.transform(textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [1024, 1024],
      quality: 88,
    }));
  }
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  const outputBytes = Buffer.from(await io.writeBinary(document));
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, outputBytes);
  await replaceFileAtomically(temporaryPath, outputPath);
  return outputBytes.length;
}

export async function optimizeAll({
  root = process.cwd(),
  only = null,
  rawRoot = path.join(root, ".tmp/assets/raw"),
  outputRoot = null,
} = {}) {
  const manifest = await loadSourceManifest({ root });
  const selected = manifest.models.filter((model) => !only || model.key === only);
  if (only && selected.length !== 1) throw new Error(`Unknown model key: ${only}`);
  const records = [];

  for (const model of selected) {
    const inputPath = path.join(rawRoot, `${model.key}.glb`);
    await readFile(inputPath);
    const outputPath = outputRoot
      ? path.join(outputRoot, path.basename(model.output))
      : path.join(root, model.output);
    const bytes = await optimizeOne({ inputPath, outputPath, textureMode: model.textureMode });
    records.push({ key: model.key, outputPath, bytes });
    console.log(`optimized ${model.key}: ${bytes} bytes`);
  }
  return records;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
  try {
    await optimizeAll({ only });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Add the exact optimization command**

Run:

```powershell
npm pkg set 'scripts.assets:optimize=node scripts/assets/optimize.mjs'
```

Expected: `package.json` exposes `assets:optimize` exactly.

- [ ] **Step 6: Run the optimization test and verify GREEN**

Run:

```powershell
node --test tests/assets/optimization.test.mjs
```

Expected: one test PASS. Its temporary optimized League GLB requires Meshopt and embeds WebP.

- [ ] **Step 7: Optimize all seven runtime models**

Run:

```powershell
npm run assets:optimize
```

Expected: seven `optimized <model-key>: <bytes> bytes` lines and seven files under `public/models/`.

- [ ] **Step 8: Inspect the published extension set**

Run:

```powershell
npx --no-install gltf-transform inspect public\models\crane-on-league.glb
npx --no-install gltf-transform inspect public\models\froggie-display.glb
```

Expected: both reports include `EXT_meshopt_compression` and `EXT_texture_webp`; neither report includes Draco or KTX2 extensions.

- [ ] **Step 9: Refactor gate**

Run:

```powershell
npm run lint
node --test tests/assets/optimization.test.mjs tests/assets/export-contract.test.mjs
```

Expected: lint succeeds and three tests PASS. Keep binary parsing dependency-free and keep optimization policy in a single `optimizeOne` function.

- [ ] **Step 10: Commit optimized model artifacts**

Run:

```powershell
git add package.json scripts/assets/lib/glb.mjs scripts/assets/optimize.mjs tests/assets/optimization.test.mjs public/models/crane.glb public/models/crane-workout.glb public/models/crane-making-table.glb public/models/crane-on-league.glb public/models/crane-throwing-plane.glb public/models/rocket.glb public/models/froggie-display.glb
git commit -m "build: optimize runtime GLBs"
```

Expected: commit succeeds and no raw GLB is staged.

### Task 7: Validate GLBs and establish deterministic model/poster manifests

> **2026-07-11 implementation amendment:** Production validation remains Blender-free but begins with the shared Node 22.15+ and exact package-lock/install checks, then verifies every reviewed canonical/provenance/brand approval. The authored model manifest now pins the exact sorted animation names for Workout, Plane, and Rocket instead of relying on minimum counts. Published GLBs must pass the strict range/URI parser, exact root/image/extension/budget/animation/geometry policy, and Khronos validation with an exact warning allowlist: one `NODE_SKINNED_MESH_NON_ROOT` warning for each Crane scene and none for Rocket/Froggie; any drift blocks release. Texture records are mapped to plain `{ name, mimeType, bytes, sha256, width, height }` JSON and never serialize payload buffers. The entire ten-scene poster contract is deep-bound, including routes, exact backgrounds, model/source mappings, and twenty traversal-safe outputs; abstract SVG inputs are safety-checked, while absent WebP captures remain an intentional separate runtime gate. Manifest publication uses a unique same-directory candidate and atomic replacement so a failed rename preserves the prior file and cleans the candidate. This amendment supersedes the stale minimum-animation, blanket-warning, partially bound poster, raw image-record, direct-write, and Node 22.13 details below.

**Files:**

- Create: `assets/poster-sources/eog.svg`
- Create: `assets/poster-sources/paycom.svg`
- Create: `assets/poster-contract.json`
- Create: `scripts/assets/validate.mjs`
- Create: `tests/assets/validation.test.mjs`
- Create: `public/models/assets-manifest.json`
- Modify: `assets/scene-sources.json`
- Modify: `scripts/assets/lib/manifest.mjs`
- Modify: `scripts/assets/export-all.mjs`
- Modify: `scripts/assets/optimize.mjs`
- Modify: `tests/assets/source-manifest.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: seven optimized GLBs, canonical source provenance, `readGlbJsonBuffer`, and the authored source manifest.
- Produces: `validateGlbMetadata({ json, bytes, imagePayloads, model, hardMaxBytes }): string[]`, `validatePosterContract({ contract, manifest, root, requirePosters }): Promise<void>`, and `validateAll({ root, outputPath, requirePosters, writeManifest }): Promise<GeneratedManifest>`.
- Produces: `validateBrandApprovals({ approvals, provenance }): void` and stable `public/models/assets-manifest.json` with exact embedded-image payload metadata, no timestamps, and no absolute paths.
- Establishes: `assets:manifest` as the only model-manifest writer. `assets:validate` and production builds are verify-only and fail on committed manifest drift.
- Produces: `assets/poster-contract.json` for ten scene IDs and two capture variants per scene. Browser rendering of those variants remains the runtime plan's responsibility.

- [ ] **Step 1: Write the failing validation and poster-contract tests**

Create `tests/assets/validation.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadSourceManifest } from "../../scripts/assets/lib/manifest.mjs";
import { readGlbJsonBuffer } from "../../scripts/assets/lib/glb.mjs";
import {
  validateAll,
  validateBrandApprovals,
  validateGlbMetadata,
  validatePosterContract,
} from "../../scripts/assets/validate.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, ".tmp/assets/validation-test");
const model = {
  key: "fixture",
  maxBytes: 5 * 1024 * 1024,
  minimumAnimations: 0,
  textureMode: "none",
};
const validJson = {
  asset: { version: "2.0" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "WEB_EXPORT_ROOT", children: [1] }, { name: "Mesh" }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  accessors: [
    { count: 3, min: [0, 0, 0], max: [1, 1, 0] },
    { count: 3 },
  ],
  buffers: [{ byteLength: 64 }],
  animations: [],
  images: [],
  materials: [],
  extensionsRequired: ["EXT_meshopt_compression"],
  extensionsUsed: ["EXT_meshopt_compression"],
};

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("metadata validation rejects each release-blocking GLB defect", () => {
  assert.deepEqual(validateGlbMetadata({ json: validJson, bytes: 1024, model, hardMaxBytes: 25 * 1024 * 1024 }), []);
  assert.match(validateGlbMetadata({ json: { ...validJson, cameras: [{}] }, bytes: 1024, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /cameras/);
  assert.match(validateGlbMetadata({ json: { ...validJson, extensionsUsed: ["KHR_lights_punctual"] }, bytes: 1024, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /lights/);
  assert.match(validateGlbMetadata({ json: { ...validJson, images: [{ uri: "screen.png" }] }, bytes: 1024, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /external URI/);
  assert.match(validateGlbMetadata({ json: { ...validJson, extensionsRequired: [] }, bytes: 1024, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /Meshopt/);
  assert.match(validateGlbMetadata({ json: { ...validJson, nodes: [{ name: "WrongRoot" }] }, bytes: 1024, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /WEB_EXPORT_ROOT/);
  assert.match(
    validateGlbMetadata({
      json: { ...validJson, materials: [{ name: "NASA meatball decal" }] },
      bytes: 1024,
      model: { ...model, forbiddenBrandTerms: ["nasa", "meatball", "worm"] },
      hardMaxBytes: 25 * 1024 * 1024,
    }).join("\n"),
    /forbidden brand term/i,
  );
  assert.match(validateGlbMetadata({ json: validJson, bytes: model.maxBytes, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /preferred budget/);
  assert.match(validateGlbMetadata({ json: validJson, bytes: 25 * 1024 * 1024, model, hardMaxBytes: 25 * 1024 * 1024 }).join("\n"), /hard limit/);
});

test("metadata validation requires the exact owned GLB image allowlist", () => {
  const league = {
    ...model,
    textureMode: "webp",
    ownedTextures: [
      {
        name: "LeagueBanDashboard",
        source: "assets/blender/textures/league-ban-dashboard.png",
      },
      {
        name: "LeagueMatchHistory",
        source: "assets/blender/textures/league-match-history.png",
      },
    ],
  };
  const json = {
    ...validJson,
    images: [
      { name: "LeagueBanDashboard", mimeType: "image/webp", bufferView: 0 },
      { name: "LeagueMatchHistory", mimeType: "image/webp", bufferView: 1 },
    ],
    extensionsUsed: ["EXT_meshopt_compression", "EXT_texture_webp"],
  };
  const payloads = [
    {
      name: "LeagueBanDashboard",
      mimeType: "image/webp",
      bytes: 10,
      sha256: "a".repeat(64),
    },
    {
      name: "LeagueMatchHistory",
      mimeType: "image/webp",
      bytes: 20,
      sha256: "b".repeat(64),
    },
  ];
  assert.deepEqual(
    validateGlbMetadata({
      json,
      bytes: 1024,
      imagePayloads: payloads,
      model: league,
      hardMaxBytes: 25 * 1024 * 1024,
    }),
    [],
  );
  assert.match(
    validateGlbMetadata({
      json: {
        ...json,
        images: [
          ...json.images,
          { name: "OfficialChampionArt", mimeType: "image/webp", bufferView: 2 },
        ],
      },
      bytes: 1024,
      imagePayloads: [
        ...payloads,
        {
          name: "OfficialChampionArt",
          mimeType: "image/webp",
          bytes: 30,
          sha256: "c".repeat(64),
        },
      ],
      model: league,
      hardMaxBytes: 25 * 1024 * 1024,
    }).join("\n"),
    /owned image allowlist/,
  );
});

test("brand approvals reject stale source and League texture hashes", () => {
  const provenance = {
    models: {
      "crane-on-league": {
        canonicalSha256: "a".repeat(64),
        generatorInputs: {
          ownedTextures: {
            LeagueBanDashboard: { sha256: "b".repeat(64) },
            LeagueMatchHistory: { sha256: "c".repeat(64) },
          },
        },
      },
      rocket: {
        canonicalSha256: "d".repeat(64),
      },
    },
  };
  const approvals = {
    schemaVersion: 1,
    approvals: {
      "league-owned-art": {
        modelKey: "crane-on-league",
        reviewedBy: "Richard Phong",
        reviewedOn: "2026-07-09",
        sourceSha256: "a".repeat(64),
        status: "approved",
        textureSha256: {
          LeagueBanDashboard: "b".repeat(64),
          LeagueMatchHistory: "c".repeat(64),
        },
      },
      "rocket-brand-safety": {
        modelKey: "rocket",
        reviewedBy: "Richard Phong",
        reviewedOn: "2026-07-09",
        sourceSha256: "d".repeat(64),
        status: "approved",
      },
    },
  };
  assert.doesNotThrow(() =>
    validateBrandApprovals({ approvals, provenance }),
  );
  assert.throws(
    () =>
      validateBrandApprovals({
        approvals: {
          ...approvals,
          approvals: {
            ...approvals.approvals,
            "league-owned-art": {
              ...approvals.approvals["league-owned-art"],
              sourceSha256: "e".repeat(64),
            },
          },
        },
        provenance,
      }),
    /stale or incomplete/,
  );
  assert.throws(
    () =>
      validateBrandApprovals({
        approvals: {
          ...approvals,
          approvals: {
            ...approvals.approvals,
            "league-owned-art": {
              ...approvals.approvals["league-owned-art"],
              textureSha256: {
                ...approvals.approvals["league-owned-art"].textureSha256,
                LeagueBanDashboard: "f".repeat(64),
              },
            },
          },
        },
        provenance,
      }),
    /stale or incomplete/,
  );
});

test("binary parser rejects malformed or length-mismatched GLBs", () => {
  assert.throws(() => readGlbJsonBuffer(Buffer.from("not gltf")), /Malformed GLB/);
  const buffer = Buffer.alloc(20);
  buffer.write("glTF", 0, "ascii");
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(999, 8);
  assert.throws(() => readGlbJsonBuffer(buffer), /declared 999 bytes/);
});

test("poster contract covers the ten approved scenes and both fixed variants", async () => {
  const manifest = await loadSourceManifest({ root });
  const contract = JSON.parse(await readFile(path.join(root, "assets/poster-contract.json"), "utf8"));
  await validatePosterContract({ contract, manifest, root, requirePosters: false });
  assert.deepEqual(contract.scenes.map((scene) => scene.id), [
    "home-hero",
    "experience-hero",
    "experience-intro",
    "nasa-rocket",
    "eog-poster",
    "paycom-poster",
    "projects-hero",
    "league-ban",
    "froggie-adventures",
    "contact-hero",
  ]);
  assert.deepEqual(Object.keys(contract.variants), ["desktop", "mobile"]);
});

test("poster-only sources contain abstract vectors and no company logo payload", async () => {
  for (const name of ["eog", "paycom"]) {
    const svg = await readFile(
      path.join(root, `assets/poster-sources/${name}.svg`),
      "utf8",
    );
    assert.doesNotMatch(svg, /<image\b|<text\b|\bhref\s*=|\b(?:eog|paycom|logo)\b/i);
  }
});

test("full validation generates stable relative-only runtime metadata", async () => {
  await mkdir(tempRoot, { recursive: true });
  const outputPath = path.join(tempRoot, "assets-manifest.json");
  const generated = await validateAll({
    root,
    outputPath,
    requirePosters: false,
    writeManifest: true,
  });
  await validateAll({ root, outputPath, requirePosters: false });
  const serialized = await readFile(outputPath, "utf8");
  assert.equal(Object.keys(generated.models).length, 7);
  assert.doesNotMatch(serialized, /[A-Za-z]:\\/);
  assert.doesNotMatch(serialized, /timestamp|generatedAt/i);
  assert.ok(Object.values(generated.models).every((entry) => entry.url.startsWith("/models/")));
  await writeFile(outputPath, serialized.replace('"schemaVersion": 1', '"schemaVersion": 999'));
  await assert.rejects(
    validateAll({ root, outputPath, requirePosters: false }),
    /committed model manifest drifted/,
  );
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test tests/assets/validation.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/validate.mjs`.

- [ ] **Step 3: Create intentional poster-only vector sources**

Create `assets/poster-sources/eog.svg` with this complete content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#dfa9b5"/>
  <path d="M0 760L280 610L520 690L820 510L1120 650L1420 430L1920 640V1080H0Z" fill="#fbe5ea"/>
  <path d="M0 860L340 720L620 810L910 650L1240 780L1540 590L1920 770V1080H0Z" fill="#722939" opacity="0.22"/>
  <g transform="translate(1270 260)" fill="none" stroke="#722939" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0 300H400"/>
    <path d="M70 300V110H330V300"/>
    <path d="M145 110V20H255V110"/>
    <path d="M200 20V-70"/>
  </g>
  <g fill="#722939" opacity="0.7">
    <circle cx="280" cy="260" r="34"/>
    <circle cx="400" cy="210" r="24"/>
    <circle cx="510" cy="300" r="42"/>
    <circle cx="650" cy="235" r="20"/>
  </g>
</svg>
```

Create `assets/poster-sources/paycom.svg` with this complete content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#dfa9b5"/>
  <circle cx="960" cy="590" r="420" fill="#fbe5ea"/>
  <g transform="translate(600 310)" fill="none" stroke="#722939" stroke-width="24" stroke-linejoin="round">
    <path d="M0 150L180 40L360 150L180 270Z" fill="#c98796"/>
    <path d="M0 150V370L180 480V270Z" fill="#dfa9b5"/>
    <path d="M360 150V370L180 480V270Z" fill="#b96e80"/>
    <path d="M400 310H660" stroke-linecap="round"/>
    <path d="M570 230L660 310L570 390" stroke-linecap="round"/>
  </g>
  <g fill="#722939" opacity="0.55">
    <rect x="1240" y="340" width="120" height="120" rx="24"/>
    <rect x="1420" y="500" width="90" height="90" rx="18"/>
    <rect x="1260" y="680" width="150" height="150" rx="30"/>
  </g>
</svg>
```

- [ ] **Step 4: Create the exact poster input/output contract**

Create `assets/poster-contract.json` with this complete content:

```json
{
  "schemaVersion": 1,
  "variants": {
    "desktop": {
      "viewportWidth": 1920,
      "viewportHeight": 1080,
      "deviceScaleFactor": 1
    },
    "mobile": {
      "viewportWidth": 390,
      "viewportHeight": 844,
      "deviceScaleFactor": 1.5
    }
  },
  "scenes": [
    {
      "id": "home-hero",
      "route": "/",
      "background": "#9ECCC0",
      "source": { "kind": "web-scene", "modelKey": "crane" },
      "outputs": { "desktop": "public/posters/home-hero-desktop.webp", "mobile": "public/posters/home-hero-mobile.webp" }
    },
    {
      "id": "experience-hero",
      "route": "/experience",
      "background": "#DFA9B5",
      "source": { "kind": "web-scene", "modelKey": "crane-workout" },
      "outputs": { "desktop": "public/posters/experience-hero-desktop.webp", "mobile": "public/posters/experience-hero-mobile.webp" }
    },
    {
      "id": "experience-intro",
      "route": "/experience",
      "background": "#DFA9B5",
      "source": { "kind": "web-scene", "modelKey": "crane-throwing-plane" },
      "outputs": { "desktop": "public/posters/experience-intro-desktop.webp", "mobile": "public/posters/experience-intro-mobile.webp" }
    },
    {
      "id": "nasa-rocket",
      "route": "/experience",
      "background": "#DFA9B5",
      "source": { "kind": "web-scene", "modelKey": "rocket" },
      "outputs": { "desktop": "public/posters/nasa-rocket-desktop.webp", "mobile": "public/posters/nasa-rocket-mobile.webp" }
    },
    {
      "id": "eog-poster",
      "route": "/experience",
      "background": "#DFA9B5",
      "source": { "kind": "svg", "path": "assets/poster-sources/eog.svg" },
      "outputs": { "desktop": "public/posters/eog-poster-desktop.webp", "mobile": "public/posters/eog-poster-mobile.webp" }
    },
    {
      "id": "paycom-poster",
      "route": "/experience",
      "background": "#DFA9B5",
      "source": { "kind": "svg", "path": "assets/poster-sources/paycom.svg" },
      "outputs": { "desktop": "public/posters/paycom-poster-desktop.webp", "mobile": "public/posters/paycom-poster-mobile.webp" }
    },
    {
      "id": "projects-hero",
      "route": "/projects",
      "background": "#AFD4E1",
      "source": { "kind": "web-scene", "modelKey": "crane-making-table" },
      "outputs": { "desktop": "public/posters/projects-hero-desktop.webp", "mobile": "public/posters/projects-hero-mobile.webp" }
    },
    {
      "id": "league-ban",
      "route": "/projects",
      "background": "#AFD4E1",
      "source": { "kind": "web-scene", "modelKey": "crane-on-league" },
      "outputs": { "desktop": "public/posters/league-ban-desktop.webp", "mobile": "public/posters/league-ban-mobile.webp" }
    },
    {
      "id": "froggie-adventures",
      "route": "/projects",
      "background": "#AFD4E1",
      "source": { "kind": "web-scene", "modelKey": "froggie-display" },
      "outputs": { "desktop": "public/posters/froggie-adventures-desktop.webp", "mobile": "public/posters/froggie-adventures-mobile.webp" }
    },
    {
      "id": "contact-hero",
      "route": "/contact",
      "background": "#C9BAE4",
      "source": { "kind": "web-scene", "modelKey": "crane-workout" },
      "outputs": { "desktop": "public/posters/contact-hero-desktop.webp", "mobile": "public/posters/contact-hero-mobile.webp" }
    }
  ]
}
```

- [ ] **Step 5: Implement complete GLB, budget, manifest, and poster-contract validation**

Create `scripts/assets/validate.mjs` with this complete content:

```js
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import validator from "gltf-validator";

import {
  readGlbImagePayloads,
  readGlbJsonBuffer,
} from "./lib/glb.mjs";
import { loadSourceManifest, sha256File, stringifyStable } from "./lib/manifest.mjs";
import { assertReviewedSourcesUnchanged } from "./prepare-all.mjs";

const EXPECTED_SCENE_IDS = [
  "home-hero",
  "experience-hero",
  "experience-intro",
  "nasa-rocket",
  "eog-poster",
  "paycom-poster",
  "projects-hero",
  "league-ban",
  "froggie-adventures",
  "contact-hero",
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function animationNames(json) {
  return (json.animations ?? []).map((animation) => animation.name ?? "");
}

function countGeometry(json) {
  let triangles = 0;
  let vertices = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessor = json.accessors?.[primitive.attributes?.POSITION];
      const indexAccessor = json.accessors?.[primitive.indices];
      vertices += positionAccessor?.count ?? 0;
      const count = indexAccessor?.count ?? positionAccessor?.count ?? 0;
      const mode = primitive.mode ?? 4;
      if (mode === 4) triangles += Math.floor(count / 3);
      if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  return { triangles, vertices };
}

export function validateGlbMetadata({
  json,
  bytes,
  imagePayloads = [],
  model,
  hardMaxBytes,
}) {
  const errors = [];
  const scene = json.scenes?.[json.scene ?? 0];
  const rootIndices = scene?.nodes ?? [];
  const rootName = rootIndices.length === 1 ? json.nodes?.[rootIndices[0]]?.name : null;
  if (json.asset?.version !== "2.0") errors.push("asset.version must be 2.0");
  if (rootIndices.length !== 1 || rootName !== "WEB_EXPORT_ROOT") errors.push("scene must contain exactly one WEB_EXPORT_ROOT");
  if ((json.cameras ?? []).length) errors.push("Blender cameras are forbidden");
  if ((json.extensionsUsed ?? []).includes("KHR_lights_punctual")) errors.push("Blender lights are forbidden");
  if (!(json.extensionsRequired ?? []).includes("EXT_meshopt_compression")) errors.push("Meshopt must be required");
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((resource) => "uri" in resource)) errors.push("GLB contains an external URI");
  if (bytes >= hardMaxBytes) errors.push(`file meets or exceeds the ${hardMaxBytes}-byte hard limit`);
  if (bytes >= model.maxBytes) errors.push(`file meets or exceeds the ${model.maxBytes}-byte preferred budget`);

  const namedAssets = [
    ...(json.nodes ?? []),
    ...(json.meshes ?? []),
    ...(json.materials ?? []),
    ...(json.images ?? []),
    ...(json.textures ?? []),
  ].map((entry) => entry.name ?? "").join("\n").toLowerCase();
  for (const term of model.forbiddenBrandTerms ?? []) {
    if (namedAssets.includes(term.toLowerCase())) errors.push(`GLB contains forbidden brand term: ${term}`);
  }

  const names = animationNames(json);
  if (names.length < model.minimumAnimations) errors.push(`expected at least ${model.minimumAnimations} animation clip(s)`);
  if (names.some((name) => !name.trim())) errors.push("animation names must be non-empty");
  if (new Set(names).size !== names.length) errors.push("animation names must be unique");

  for (const accessor of json.accessors ?? []) {
    for (const value of [...(accessor.min ?? []), ...(accessor.max ?? [])]) {
      if (!Number.isFinite(value)) errors.push("accessor bounds must be finite");
    }
  }
  const geometry = countGeometry(json);
  if (geometry.triangles <= 0 || geometry.vertices <= 0) errors.push("GLB must contain mesh geometry");

  const images = json.images ?? [];
  const expectedImageNames = (model.ownedTextures ?? [])
    .map((texture) => texture.name)
    .sort();
  const actualImageNames = imagePayloads
    .map((payload) => payload.name)
    .sort();
  if (
    JSON.stringify(actualImageNames) !== JSON.stringify(expectedImageNames) ||
    imagePayloads.length !== images.length
  ) {
    errors.push("embedded images do not match the exact owned image allowlist");
  }
  if (model.textureMode === "webp") {
    if (!images.length || images.some((image) => image.mimeType !== "image/webp")) errors.push("textured model must embed only WebP images");
    if (imagePayloads.some((payload) => payload.mimeType !== "image/webp" || payload.bytes <= 0)) errors.push("WebP image payload metadata is invalid");
    if (!(json.extensionsUsed ?? []).includes("EXT_texture_webp")) errors.push("textured model must use EXT_texture_webp");
  } else if (images.length > 0) {
    errors.push("texture-free model unexpectedly embeds images");
  }
  return errors;
}

export function validateBrandApprovals({ approvals, provenance }) {
  if (approvals.schemaVersion !== 1) {
    throw new Error("Brand approvals schemaVersion must be 1");
  }
  const policies = {
    "league-owned-art": "crane-on-league",
    "rocket-brand-safety": "rocket",
  };
  if (
    stringifyStable(Object.keys(approvals.approvals ?? {})) !==
    stringifyStable(Object.keys(policies))
  ) {
    throw new Error("Brand approvals are stale or incomplete");
  }
  for (const [key, modelKey] of Object.entries(policies)) {
    const approval = approvals.approvals[key];
    const model = provenance.models?.[modelKey];
    const validReview =
      approval?.status === "approved" &&
      approval.modelKey === modelKey &&
      typeof approval.reviewedBy === "string" &&
      approval.reviewedBy.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(approval.reviewedOn) &&
      approval.sourceSha256 === model?.canonicalSha256;
    if (!validReview) {
      throw new Error(`${key}: brand approval is stale or incomplete`);
    }
    if (key === "league-owned-art") {
      const expectedTextureSha256 = Object.fromEntries(
        Object.entries(model.generatorInputs?.ownedTextures ?? {}).map(
          ([name, entry]) => [name, entry.sha256],
        ),
      );
      if (
        stringifyStable(approval.textureSha256 ?? {}) !==
        stringifyStable(expectedTextureSha256)
      ) {
        throw new Error(`${key}: brand approval is stale or incomplete`);
      }
    } else if ("textureSha256" in approval) {
      throw new Error(`${key}: unexpected texture approval payload`);
    }
  }
}

export async function validatePosterContract({ contract, manifest, root, requirePosters }) {
  if (contract.schemaVersion !== 1) throw new Error("Poster contract schemaVersion must be 1");
  if (JSON.stringify(Object.keys(contract.variants)) !== JSON.stringify(["desktop", "mobile"])) {
    throw new Error("Poster contract variants must be desktop then mobile");
  }
  const desktop = contract.variants.desktop;
  const mobile = contract.variants.mobile;
  if (desktop.viewportWidth !== 1920 || desktop.viewportHeight !== 1080 || desktop.deviceScaleFactor !== 1) throw new Error("Desktop poster variant is invalid");
  if (mobile.viewportWidth !== 390 || mobile.viewportHeight !== 844 || mobile.deviceScaleFactor !== 1.5) throw new Error("Mobile poster variant is invalid");
  if (JSON.stringify(contract.scenes.map((scene) => scene.id)) !== JSON.stringify(EXPECTED_SCENE_IDS)) throw new Error("Poster scenes do not match the approved order");

  const modelKeys = new Set(manifest.models.map((model) => model.key));
  const outputs = new Set();
  for (const scene of contract.scenes) {
    if (!/^#[A-F0-9]{6}$/.test(scene.background)) throw new Error(`${scene.id}: background must be an exact uppercase hex color`);
    if (scene.source.kind === "web-scene") {
      if (!modelKeys.has(scene.source.modelKey)) throw new Error(`${scene.id}: unknown model key ${scene.source.modelKey}`);
    } else if (scene.source.kind === "svg") {
      if (!(await exists(path.join(root, scene.source.path)))) throw new Error(`${scene.id}: static poster source is missing`);
    } else {
      throw new Error(`${scene.id}: source kind must be web-scene or svg`);
    }
    for (const variant of ["desktop", "mobile"]) {
      const output = scene.outputs?.[variant];
      if (!output?.startsWith("public/posters/") || !output.endsWith(".webp")) throw new Error(`${scene.id}: ${variant} output is invalid`);
      if (outputs.has(output)) throw new Error(`Duplicate poster output: ${output}`);
      outputs.add(output);
      if (requirePosters && !(await exists(path.join(root, output)))) throw new Error(`Required poster is missing: ${output}`);
    }
  }
}

export async function validateAll({
  root = process.cwd(),
  outputPath = path.join(root, "public/models/assets-manifest.json"),
  requirePosters = false,
  writeManifest = false,
} = {}) {
  const manifest = await loadSourceManifest({ root });
  const provenance = JSON.parse(await readFile(path.join(root, "assets/blender/source-provenance.json"), "utf8"));
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance,
  });
  const brandApprovals = JSON.parse(
    await readFile(path.join(root, "assets/brand-approvals.json"), "utf8"),
  );
  validateBrandApprovals({ approvals: brandApprovals, provenance });
  const posterContract = JSON.parse(await readFile(path.join(root, "assets/poster-contract.json"), "utf8"));
  await validatePosterContract({ contract: posterContract, manifest, root, requirePosters });

  const models = {};
  for (const model of manifest.models) {
    const modelPath = path.join(root, model.output);
    const sourcePath = path.join(root, model.source);
    const buffer = await readFile(modelPath);
    const json = readGlbJsonBuffer(buffer);
    const imagePayloads = readGlbImagePayloads(buffer, json);
    const metadataErrors = validateGlbMetadata({
      json,
      bytes: buffer.length,
      imagePayloads,
      model,
      hardMaxBytes: manifest.hardMaxBytes,
    });
    const validatorReport = await validator.validateBytes(new Uint8Array(buffer), {
      format: "glb",
      maxIssues: 0,
      uri: path.basename(model.output),
      writeTimestamp: false,
    });
    const validatorErrors = validatorReport.issues?.numErrors ?? 0;
    if (metadataErrors.length || validatorErrors) {
      const detail = [...metadataErrors, ...(validatorReport.issues?.messages ?? []).filter((issue) => issue.severity === 0).map((issue) => `${issue.code}: ${issue.message}`)];
      throw new Error(`${model.key} failed validation:\n${detail.join("\n")}`);
    }

    const sourceSha256 = await sha256File(sourcePath);
    if (sourceSha256 !== provenance.models?.[model.key]?.canonicalSha256) throw new Error(`${model.key}: source provenance mismatch`);
    const geometry = countGeometry(json);
    models[model.key] = {
      animations: animationNames(json),
      bytes: buffer.length,
      extensionsRequired: [...(json.extensionsRequired ?? [])].sort(),
      extensionsUsed: [...(json.extensionsUsed ?? [])].sort(),
      materials: (json.materials ?? []).length,
      sha256: await sha256File(modelPath),
      sourceSha256,
      textures: [...imagePayloads].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      triangles: geometry.triangles,
      url: `/${model.output.replace(/^public\//, "")}`,
      validatorWarnings: validatorReport.issues?.numWarnings ?? 0,
      vertices: geometry.vertices,
    };
  }

  const generated = {
    schemaVersion: 1,
    toolchain: {
      blender: manifest.toolchain.blender.version,
      gltfTransform: manifest.toolchain.gltfTransform,
      gltfValidator: manifest.toolchain.gltfValidator,
      meshoptimizer: manifest.toolchain.meshoptimizer,
      sharp: manifest.toolchain.sharp,
    },
    models,
  };
  const serialized = stringifyStable(generated);
  if (writeManifest) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized);
  } else {
    let committed;
    try {
      committed = await readFile(outputPath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          "committed model manifest is missing; run npm run assets:manifest after reviewed regeneration.",
        );
      }
      throw error;
    }
    if (committed !== serialized) {
      throw new Error(
        "committed model manifest drifted; run npm run assets:manifest only after reviewing regenerated GLBs.",
      );
    }
  }
  return generated;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await validateAll({
      requirePosters: process.argv.includes("--require-posters"),
      writeManifest: process.argv.includes("--write-manifest"),
    });
    console.log("asset validation passed");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 6: Add the exact validation command**

Run:

```powershell
npm pkg set 'scripts.assets:validate=node scripts/assets/validate.mjs'
npm pkg set 'scripts.assets:manifest=node scripts/assets/validate.mjs --write-manifest'
```

Expected: `package.json` exposes verify-only `assets:validate` and explicit writer `assets:manifest` exactly.

- [ ] **Step 7: Run validation tests and verify GREEN**

Run:

```powershell
node --test tests/assets/validation.test.mjs
```

Expected: seven tests PASS.

- [ ] **Step 8: Validate every committed GLB and generate the runtime manifest**

Run:

```powershell
npm run assets:manifest
npm run assets:validate
```

Expected: both commands print `asset validation passed`. The first intentionally replaces `public/models/assets-manifest.json`; the second proves the committed bytes exactly describe seven GLBs, including the exact League/Froggie image payload names, MIME types, byte counts, and SHA-256 values, with no timestamp or absolute path.

- [ ] **Step 9: Prove poster absence is a separate runtime-plan gate**

Run:

```powershell
node scripts/assets/validate.mjs --require-posters
```

Expected: FAIL with `Required poster is missing: public/posters/home-hero-desktop.webp`. This failure remains until the runtime plan implements deterministic browser capture and commits all contract outputs.

- [ ] **Step 10: Refactor gate**

Run:

```powershell
npm run lint
node --test tests/assets/validation.test.mjs tests/assets/optimization.test.mjs
```

Expected: lint succeeds and eight tests PASS: seven validation tests plus one optimization test. Keep authored poster inputs separate from generated browser captures and keep validation independent of Blender.

- [ ] **Step 11: Commit the validated manifest and poster inputs**

Run:

```powershell
git add package.json assets/poster-sources/eog.svg assets/poster-sources/paycom.svg assets/poster-contract.json scripts/assets/validate.mjs tests/assets/validation.test.mjs public/models/assets-manifest.json
git commit -m "build: validate models and define poster contract"
```

Expected: commit succeeds; no `public/posters/*.webp` file is invented by this asset-only plan.

### Task 8: Wire reproducible orchestration, repository hygiene, and the build gate

> **Implementation amendment (2026-07-11):** Full regeneration writes all
> seven optimized GLBs and the generated manifest to one repository-local
> staging directory, validates that staged set, and promotes the eight files as
> a single rollback-safe batch. Normal production builds only validate the
> committed files and launch the pinned local Vinext CLI through
> `process.execPath` with `shell: false`; they never resolve or start Blender.
> `validateAll` accepts an explicit staged model root for this workflow. The
> source-texture stage renders and compares candidates without mutating tracked
> PNGs, and an exclusive local lock rejects concurrent regeneration. The npm
> lockfile remains unchanged unless dependency tooling actually changes it.

**Files:**

- Create: `scripts/assets/build-all.mjs`
- Create: `scripts/run-vinext.mjs`
- Create: `tests/assets/repository-hygiene.test.mjs`
- Modify: `tests/starter-cleanup.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Consumes: `runPreflight`, `renderSourceTextures`, `exportAll`, `optimizeAll`, and `validateAll` from prior tasks.
- Produces: `runAssetPipeline({ preflight, textureRenderer, exporter, optimizer, validator }): Promise<string[]>`, with the exact stage order `preflight`, `textures`, `export`, `optimize`, `validate`.
- Produces: cross-platform `dev`, `build`, and `start` commands that set `WRANGLER_LOG_PATH` in the child environment instead of shell syntax.
- Guarantees: `npm run build` validates committed GLBs and metadata without invoking Blender; `npm run assets:all` is the only full offline regeneration command.

- [ ] **Step 1: Write the failing orchestration and hygiene tests**

Create `tests/assets/repository-hygiene.test.mjs` with this complete content:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { runAssetPipeline } from "../../scripts/assets/build-all.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("asset pipeline runs the five stages in strict order", async () => {
  const called = [];
  const makeStep = (name) => async () => { called.push(name); };
  const result = await runAssetPipeline({
    preflight: makeStep("preflight"),
    textureRenderer: makeStep("textures"),
    exporter: makeStep("export"),
    optimizer: makeStep("optimize"),
    validator: makeStep("validate"),
  });
  assert.deepEqual(called, ["preflight", "textures", "export", "optimize", "validate"]);
  assert.deepEqual(result, called);
});

test("package scripts expose regeneration and validate assets before production build", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["assets:all"], "node scripts/assets/build-all.mjs");
  assert.equal(pkg.scripts["assets:manifest"], "node scripts/assets/validate.mjs --write-manifest");
  assert.equal(pkg.scripts["assets:validate"], "node scripts/assets/validate.mjs");
  assert.equal(pkg.scripts.dev, "node scripts/run-vinext.mjs dev");
  assert.equal(pkg.scripts.start, "node scripts/run-vinext.mjs start");
  assert.equal(pkg.scripts.build, "node scripts/assets/validate.mjs && node scripts/run-vinext.mjs build");
});

test("forbidden Blender backups, binaries, and intermediates are not tracked", () => {
  const git = process.env.GIT_EXECUTABLE ?? "git";
  const result = spawnSync(git, ["ls-files"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const tracked = result.stdout.split(/\r?\n/).filter(Boolean);
  const forbidden = tracked.filter((file) =>
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
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test tests/assets/repository-hygiene.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/assets/build-all.mjs`.

- [ ] **Step 3: Implement the shell-independent asset orchestrator**

Create `scripts/assets/build-all.mjs` with this complete content:

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportAll } from "./export-all.mjs";
import { optimizeAll } from "./optimize.mjs";
import { runPreflight } from "./preflight.mjs";
import { renderSourceTextures } from "./render-source-textures.mjs";
import { validateAll } from "./validate.mjs";

export async function runAssetPipeline({
  preflight = () => runPreflight(),
  textureRenderer = () => renderSourceTextures(),
  exporter = () => exportAll(),
  optimizer = () => optimizeAll(),
  validator = () => validateAll({ writeManifest: true }),
} = {}) {
  const completed = [];
  for (const [name, operation] of [
    ["preflight", preflight],
    ["textures", textureRenderer],
    ["export", exporter],
    ["optimize", optimizer],
    ["validate", validator],
  ]) {
    await operation();
    completed.push(name);
    console.log(`asset stage complete: ${name}`);
  }
  return completed;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await runAssetPipeline();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Implement cross-platform Vinext process launching**

Create `scripts/run-vinext.mjs` with this complete content:

```js
import { spawnSync } from "node:child_process";

const [mode, ...forwarded] = process.argv.slice(2);
if (!["dev", "build", "start"].includes(mode)) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start> [...arguments]");
  process.exit(1);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["--no-install", "vinext", mode, ...forwarded], {
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
```

- [ ] **Step 5: Wire exact package commands and the production build gate**

Run:

```powershell
npm pkg set 'scripts.assets:all=node scripts/assets/build-all.mjs'
npm pkg set 'scripts.dev=node scripts/run-vinext.mjs dev'
npm pkg set 'scripts.start=node scripts/run-vinext.mjs start'
npm pkg set 'scripts.build=node scripts/assets/validate.mjs && node scripts/run-vinext.mjs build'
```

Expected: `package.json` contains the four exact values asserted by the test.

- [ ] **Step 6: Update the earlier cross-platform package-script assertion**

In `tests/starter-cleanup.test.ts`, replace the `expect(packageJson.scripts).toMatchObject` call with:

```ts
expect(packageJson.scripts).toMatchObject({
  dev: "node scripts/run-vinext.mjs dev",
  build:
    "node scripts/assets/validate.mjs && node scripts/run-vinext.mjs build",
  start: "node scripts/run-vinext.mjs start",
  test: "npm run test:unit && npm run test:html",
  "test:unit": "vitest run",
  "test:html": "npm run build && node --test tests/rendered-html.test.mjs",
  "validate:production": "tsx scripts/validate-production.ts",
});
```

The surrounding starter-removal and dependency assertions remain unchanged.

- [ ] **Step 7: Run orchestration, hygiene, and starter tests and verify GREEN**

Run:

```powershell
node --test tests/assets/repository-hygiene.test.mjs
npm run test:unit -- tests/starter-cleanup.test.ts
```

Expected: the Node suite reports three tests PASS and Vitest reports the starter-cleanup file PASS.

- [ ] **Step 8: Regenerate the full asset set through the single entry point**

Run:

```powershell
npm run assets:all
```

Expected output ends with these ordered lines:

```text
asset stage complete: preflight
asset stage complete: textures
asset stage complete: export
asset stage complete: optimize
asset stage complete: validate
```

- [ ] **Step 9: Prove regeneration is stable**

Run:

```powershell
git diff --exit-code -- public/models assets/blender/source-provenance.json assets/blender/FroggieDisplay.blend assets/blender/textures/league-ban-dashboard.png assets/blender/textures/league-match-history.png assets/blender/textures/froggie-gameplay-screen.png
```

Expected: exit code 0 and no diff. This covers the committed model manifest/GLBs, all deterministic source PNGs, the canonical Froggie blend, and provenance. A diff means the pinned input/render/export/optimization pipeline is not reproducible and must be corrected before committing this task.

- [ ] **Step 10: Run the complete asset test suite**

Run:

```powershell
npm run test:assets
```

Expected: every test under `tests/assets/` PASS.

- [ ] **Step 11: Verify the production build uses committed assets only**

Run:

```powershell
$savedBlenderBin = $env:BLENDER_BIN
Remove-Item Env:\BLENDER_BIN -ErrorAction SilentlyContinue
npm run build
if ($null -ne $savedBlenderBin) { $env:BLENDER_BIN = $savedBlenderBin }
```

Expected: validation prints `asset validation passed`, Vinext completes a production build, and no Blender process starts.

- [ ] **Step 12: Refactor gate**

Run:

```powershell
npm run lint
npm run test:assets
npm run assets:validate
```

Expected: lint succeeds, all asset tests PASS, and validation prints `asset validation passed`. Keep the full regeneration workflow out of `npm run build`; production consumes committed artifacts.

- [ ] **Step 13: Commit orchestration and the build gate**

Run:

```powershell
git add package.json package-lock.json scripts/assets/build-all.mjs scripts/run-vinext.mjs tests/assets/repository-hygiene.test.mjs tests/starter-cleanup.test.ts public/models assets/blender/source-provenance.json
git commit -m "build: gate production on validated 3D assets"
```

Expected: commit succeeds and `git status --short` shows no generated asset drift.

## Known risks and non-negotiable stop conditions

- Portable Blender is not currently present in the repository or normal installed locations. Task 2 downloads a 388,356,346-byte official ZIP, verifies its published SHA-256, and keeps it ignored. A failed download or digest mismatch stops execution.
- The historical League blend points to two missing files under `..\Figma`. Task 3 deliberately replaces them, renames them to the exact allowlist, hashes their packed bytes, and rejects every third raster image. If another unresolved/packed image or linked library appears, curation stops. Richard's visual approval is source-hash-bound and becomes stale after any source or owned-PNG change.
- Blender particle systems and volume objects do not survive this GLB contract. The selected `Rocket.blend` must report empty particle and volume lists. If it does not, bake reviewed static mesh geometry into the canonical copy; do not switch silently to the excluded 99.72 MiB `RocketExportParticle.blend1`.
- Blender procedural shader graphs can look correct in Blender while exporting incorrectly to glTF. Task 5 rejects non-whitelisted material nodes, and final material fidelity still requires the runtime plan's Three.js visual comparison.
- `CraneWorkout.blend` contains the intended future animation. Both the raw inspection and optimized GLB validation require at least one named clip; a zero-clip export stops the pipeline.
- Re-saving a `.blend` can change its binary hash even when the scene appears unchanged. Explicit curation writes candidates before promotion and updates only the authorized provenance keys. Normal regeneration opens sources read-only, rejects unrelated source/input drift, and proves before/after hashes are identical.
- Byte-identical WebGL poster output across operating systems and GPU drivers is not realistically enforceable. This plan establishes exact sources, dimensions, palettes, model keys, and output paths. The runtime plan must pin Chromium plus SwiftShader and use a tight pixel-difference gate rather than claiming cross-platform byte identity.
- The supplied Froggie image is a captured playback frame pinned at 2,337,398 bytes and SHA-256 `64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613`. The deterministic crop removes the Unity controls and video-player overlay while preserving the HUD, then letterboxes the clean region into the 16:9 screen texture. A replacement requires an intentional, reviewable change to the tracked image plus the matching manifest bytes/SHA-256/crop and test assertion, followed by deterministic texture regeneration, `npm run assets:froggie:replace`, and repeat visual review. `assets:all` never silently replaces the canonical blend.

## Execution handoff

Use `superpowers:subagent-driven-development` and execute Tasks 1 through 8 in order. Each task has its own RED, GREEN, refactor, verification, and commit boundary; stop immediately on any stated hard failure rather than weakening an invariant.
