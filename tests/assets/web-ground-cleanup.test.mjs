import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  resolveBlenderBin,
  runBlenderScript,
} from "../../scripts/assets/lib/blender.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/web-ground-cleanup-test-${process.pid}`,
);
const prepareScript = path.join(
  root,
  "scripts/assets/blender/prepare_source.py",
);
const inspectScript = path.join(
  root,
  "scripts/assets/blender/inspect_scene.py",
);

const importedModels = {
  crane: {
    file: "Crane.blend",
    mesh: "Plane.001",
    object: "Shadow Catcher",
  },
  "crane-making-table": {
    file: "CraneMakingTable.blend",
    mesh: "Plane.001",
    object: "Shadow Catcher",
  },
  "crane-on-league": {
    file: "CraneOnLeague.blend",
    mesh: "Plane.001",
    object: "Shadow Catcher",
  },
  "crane-throwing-plane": {
    file: "CraneThrowingPlane.blend",
    mesh: "Plane.001",
    object: "Shadow Catcher",
  },
  "crane-workout": {
    file: "CraneWorkout.blend",
    mesh: "Plane.001",
    object: "Shadow Catcher",
  },
  rocket: {
    file: "Rocket.blend",
    mesh: "Plane",
    object: "Ground",
  },
};

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function inspect(blenderBin, blendFile, name) {
  const reportPath = path.join(tempRoot, `${name}.json`);
  runBlenderScript({
    blenderBin,
    blendFile,
    script: inspectScript,
    scriptArgs: ["--report", reportPath],
    cwd: root,
  });
  return JSON.parse(await readFile(reportPath, "utf8"));
}

function runGroundCleanup(blenderBin, input, output) {
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: prepareScript,
    scriptArgs: ["--destination", output, "--remove-web-ground"],
    cwd: root,
  });
}

test("authored shadow catcher cleanup is exact and idempotent", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const legacy = path.join(tempRoot, "Crane-legacy-ground.blend");
  const cleaned = path.join(tempRoot, "Crane-cleaned-ground.blend");
  const cleanedAgain = path.join(tempRoot, "Crane-cleaned-ground-again.blend");
  const fixtureScript = path.join(tempRoot, "make_legacy_ground.py");
  await writeFile(
    fixtureScript,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nroot = bpy.data.objects["WEB_EXPORT_ROOT"]\nfor key in list(root.keys()):\n    if key.startswith("web_ground_"):\n        del root[key]\nobj = bpy.data.objects.get("Shadow Catcher")\nif obj is None:\n    if bpy.data.meshes.get("Plane.001") is not None:\n        raise RuntimeError("legacy ground mesh is unexpectedly occupied")\n    mesh = bpy.data.meshes.new("Plane.001")\n    mesh.from_pydata([(-1.0, -1.0, 0.0), (1.0, -1.0, 0.0), (1.0, 1.0, 0.0), (-1.0, 1.0, 0.0)], [], [(0, 1, 2, 3)])\n    mesh.update()\n    obj = bpy.data.objects.new("Shadow Catcher", mesh)\n    bpy.context.scene.collection.objects.link(obj)\n    obj.parent = root\n    obj.is_shadow_catcher = True\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: path.join(root, "assets/blender/Crane.blend"),
    script: fixtureScript,
    scriptArgs: ["--destination", legacy],
    cwd: root,
  });
  const before = await inspect(blenderBin, legacy, "before");
  assert.deepEqual(before.shadowCatchers, [
    {
      mesh: "Plane.001",
      modifiers: [],
      name: "Shadow Catcher",
      parent: "WEB_EXPORT_ROOT",
    },
  ]);

  runGroundCleanup(blenderBin, legacy, cleaned);
  const first = await inspect(blenderBin, cleaned, "first");
  assert.deepEqual(first.shadowCatchers, []);
  assert.ok(!first.allObjects.includes("Shadow Catcher"));
  assert.ok(!first.meshNames.includes("Plane.001"));
  assert.equal(first.triangleEstimate, before.triangleEstimate - 2);
  assert.equal(first.rootCustomProperties.web_ground_cleanup_version, 1);
  assert.equal(
    first.rootCustomProperties.web_ground_cleanup_policy,
    "remove-authored-shadow-catcher-v1",
  );
  assert.equal(
    first.rootCustomProperties.web_ground_shadow_strategy,
    "transparent-canvas-contact-shadow-v1",
  );
  assert.equal(
    first.rootCustomProperties.web_ground_removed_object,
    "Shadow Catcher",
  );
  assert.equal(first.rootCustomProperties.web_ground_removed_mesh, "Plane.001");

  runGroundCleanup(blenderBin, cleaned, cleanedAgain);
  assert.deepEqual(await inspect(blenderBin, cleanedAgain, "second"), first);
});

test("completed cleanup rejects a receiver reintroduced behind its metadata", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const source = path.join(root, "assets/blender/Crane.blend");
  const contaminated = path.join(tempRoot, "Crane-reintroduced-ground.blend");
  const rejected = path.join(tempRoot, "Crane-ground-should-not-exist.blend");
  const script = path.join(tempRoot, "reintroduce_ground.py");
  await writeFile(
    script,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nroot = bpy.data.objects["WEB_EXPORT_ROOT"]\nif "web_ground_cleanup_version" not in root:\n    raise RuntimeError("canonical cleanup metadata is missing")\nmesh = bpy.data.meshes.new("Plane.001")\nmesh.from_pydata([(-1.0, -1.0, 0.0), (1.0, -1.0, 0.0), (1.0, 1.0, 0.0), (-1.0, 1.0, 0.0)], [], [(0, 1, 2, 3)])\nobj = bpy.data.objects.new("Shadow Catcher", mesh)\nbpy.context.scene.collection.objects.link(obj)\nobj.parent = root\nobj.is_shadow_catcher = True\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: source,
    script,
    scriptArgs: ["--destination", contaminated],
    cwd: root,
  });
  assert.throws(
    () => runGroundCleanup(blenderBin, contaminated, rejected),
    /Web ground cleanup is partial.*Shadow Catcher/i,
  );
  await assert.rejects(readFile(rejected), { code: "ENOENT" });
});

test("all imported canonicals omit only the authored receivers and bind provenance", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const provenance = JSON.parse(
    await readFile(
      path.join(root, "assets/blender/source-provenance.json"),
      "utf8",
    ),
  );
  for (const [key, expected] of Object.entries(importedModels)) {
    const scene = await inspect(
      blenderBin,
      path.join(root, "assets/blender", expected.file),
      `canonical-${key}`,
    );
    assert.deepEqual(scene.shadowCatchers, [], `${key} retained a shadow catcher`);
    assert.ok(!scene.allObjects.includes(expected.object));
    assert.ok(!scene.meshNames.includes(expected.mesh));
    assert.equal(
      scene.rootCustomProperties.web_ground_removed_object,
      expected.object,
    );
    assert.equal(
      scene.rootCustomProperties.web_ground_removed_mesh,
      expected.mesh,
    );
    assert.deepEqual(provenance.models[key].generatorInputs.webGroundCleanup, {
      mesh: expected.mesh,
      object: expected.object,
      policy: "remove-authored-shadow-catcher-v1",
      shadowStrategy: "transparent-canvas-contact-shadow-v1",
      version: 1,
    });
  }

  const rocket = await inspect(
    blenderBin,
    path.join(root, "assets/blender/Rocket.blend"),
    "canonical-rocket-kept-ground-smoke",
  );
  assert.ok(rocket.allObjects.includes("RocketSmokeGroundBaked"));
  assert.deepEqual(rocket.objectAnimationBindings.Rocket, {
    action: "RocketAction",
    drivers: 0,
    nlaTracks: 0,
  });
});
