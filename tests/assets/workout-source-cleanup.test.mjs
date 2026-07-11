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
  `.tmp/assets/workout-source-cleanup-test-${process.pid}`,
);

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
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", reportPath],
    cwd: root,
  });
  return JSON.parse(await readFile(reportPath, "utf8"));
}

async function makeLegacyFixture(blenderBin, source, destination) {
  const script = path.join(tempRoot, "make_legacy_workout_fixture.py");
  await writeFile(
    script,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nroot = bpy.data.objects.get("WEB_EXPORT_ROOT")\nif not root:\n    raise RuntimeError("CraneWorkout fixture export root is missing")\nfor key in ("crane_workout_cleanup_version", "crane_workout_cleanup_policy", "crane_workout_removed_object", "crane_workout_removed_data"):\n    if key in root:\n        del root[key]\nmirror = bpy.data.objects.get("Hand Mirror")\nif mirror is None:\n    if bpy.data.meshes.get("Cylinder.001") or bpy.data.materials.get("Mirror Frame") or bpy.data.materials.get("Mirror Lens"):\n        raise RuntimeError("CraneWorkout fixture cleanup state is partial")\n    mesh = bpy.data.meshes.new("Cylinder.001")\n    mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])\n    mirror = bpy.data.objects.new("Hand Mirror", mesh)\n    bpy.context.scene.collection.objects.link(mirror)\n    mirror.hide_render = True\n    frame = bpy.data.materials.new("Mirror Frame")\n    frame.use_nodes = True\n    lens = bpy.data.materials.new("Mirror Lens")\n    lens.use_nodes = True\n    lens.node_tree.nodes.clear()\n    output = lens.node_tree.nodes.new("ShaderNodeOutputMaterial")\n    output.name = "Material Output"\n    glossy = lens.node_tree.nodes.new("ShaderNodeBsdfGlossy")\n    glossy.name = "Glossy BSDF"\n    glossy.location = (10, 300)\n    glossy.distribution = "SHARP"\n    glossy.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1.0)\n    glossy.inputs["Roughness"].default_value = 1.0\n    lens.node_tree.links.new(glossy.outputs["BSDF"], output.inputs["Surface"])\n    mesh.materials.append(frame)\n    mesh.materials.append(lens)\n    mesh.polygons[0].material_index = 1\nelif mirror.data.name != "Cylinder.001":\n    raise RuntimeError("CraneWorkout fixture Hand Mirror mesh drifted")\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: source,
    script,
    scriptArgs: ["--destination", destination],
    cwd: root,
  });
}

test("CraneWorkout removes only the reviewed hidden mirror artifacts", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "CraneWorkout-legacy.blend");
  const cleaned = path.join(tempRoot, "CraneWorkout-cleaned.blend");
  const cleanedAgain = path.join(tempRoot, "CraneWorkout-cleaned-again.blend");
  await makeLegacyFixture(
    blenderBin,
    path.join(root, "assets/blender/CraneWorkout.blend"),
    input,
  );

  const before = await inspect(blenderBin, input, "before");
  assert.ok(before.allObjects.includes("Hand Mirror"));
  assert.ok(before.meshNames.includes("Cylinder.001"));
  assert.ok(before.materialNames.includes("Mirror Frame"));
  assert.ok(before.materialNames.includes("Mirror Lens"));
  assert.ok(before.materialNodeTypes.includes("ShaderNodeBsdfGlossy"));
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", cleaned,
      "--crane-workout-remove-hidden-hand-mirror",
    ],
    cwd: root,
  });
  const first = await inspect(blenderBin, cleaned, "first");

  assert.equal(first.rootCount, before.rootCount);
  assert.deepEqual(first.rootTransform, before.rootTransform);
  assert.deepEqual(first.objects, before.objects);
  assert.deepEqual(first.objectParents, before.objectParents);
  assert.equal(first.triangleEstimate, 836);
  assert.equal(first.triangleEstimate, before.triangleEstimate);
  assert.deepEqual(first.animationDetails, before.animationDetails);
  assert.deepEqual(
    first.allObjects,
    before.allObjects.filter((name) => name !== "Hand Mirror"),
  );
  assert.deepEqual(
    first.allObjectParents,
    Object.fromEntries(
      Object.entries(before.allObjectParents).filter(
        ([name]) => name !== "Hand Mirror",
      ),
    ),
  );
  assert.deepEqual(
    first.meshNames,
    before.meshNames.filter((name) => name !== "Cylinder.001"),
  );
  assert.deepEqual(
    first.materialNames,
    before.materialNames.filter(
      (name) => name !== "Mirror Frame" && name !== "Mirror Lens",
    ),
  );
  assert.ok(!first.materialNodeTypes.includes("ShaderNodeBsdfGlossy"));
  assert.ok(!first.materialNames.includes("Mirror Lens"));
  assert.equal(
    first.rootCustomProperties.crane_workout_cleanup_version,
    1,
  );
  assert.equal(
    first.rootCustomProperties.crane_workout_cleanup_policy,
    "remove-hidden-hand-mirror-v1",
  );
  assert.equal(
    first.rootCustomProperties.crane_workout_removed_object,
    "Hand Mirror",
  );

  runBlenderScript({
    blenderBin,
    blendFile: cleaned,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", cleanedAgain,
      "--crane-workout-remove-hidden-hand-mirror",
    ],
    cwd: root,
  });
  const second = await inspect(blenderBin, cleanedAgain, "second");
  assert.deepEqual(second, first);
});

test("CraneWorkout rejects a partial hidden-mirror cleanup", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const legacy = path.join(tempRoot, "CraneWorkout-legacy.blend");
  const partial = path.join(tempRoot, "CraneWorkout-partial.blend");
  const rejected = path.join(tempRoot, "CraneWorkout-should-not-exist.blend");
  await makeLegacyFixture(
    blenderBin,
    path.join(root, "assets/blender/CraneWorkout.blend"),
    legacy,
  );
  const script = path.join(tempRoot, "make_partial_workout_fixture.py");
  await writeFile(
    script,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nmirror = bpy.data.objects.get("Hand Mirror")\nif not mirror:\n    raise RuntimeError("CraneWorkout partial fixture Hand Mirror is missing")\nbpy.data.objects.remove(mirror, do_unlink=True)\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: legacy,
    script,
    scriptArgs: ["--destination", partial],
    cwd: root,
  });

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: partial,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs: [
          "--destination", rejected,
          "--crane-workout-remove-hidden-hand-mirror",
        ],
        cwd: root,
      }),
    /partial or inconsistent/,
  );
});
