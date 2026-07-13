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
  `.tmp/assets/static-crane-pose-test-${process.pid}`,
);

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function inspect(blenderBin, blendFile, name) {
  const report = path.join(tempRoot, `${name}.json`);
  const script = path.join(tempRoot, "inspect_static_pose.py");
  await writeFile(
    script,
    `import json, sys\nfrom pathlib import Path\nimport bpy\nargv=sys.argv[sys.argv.index("--")+1:]\nreport=Path(argv[argv.index("--report")+1]).resolve()\nroot=bpy.data.objects["WEB_EXPORT_ROOT"]\nmesh=bpy.data.objects.get(root.get("static_crane_pose_mesh", ""))\nreport.write_text(json.dumps({"armatures":sorted(obj.name for obj in root.children_recursive if obj.type=="ARMATURE"),"meshModifiers":[] if mesh is None else sorted(mod.type for mod in mesh.modifiers),"meshParent":None if mesh is None or mesh.parent is None else mesh.parent.name,"metadata":{k:root[k] for k in root.keys() if k.startswith("static_crane_pose_")}}),encoding="utf8")\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile,
    script,
    scriptArgs: ["--report", report],
    cwd: root,
  });
  return JSON.parse(await readFile(report, "utf8"));
}

test("static crane pose curation bakes the reviewed skinned mesh idempotently", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(root, "assets/blender/CraneMakingTable.blend");
  const firstPath = path.join(tempRoot, "first.blend");
  const secondPath = path.join(tempRoot, "second.blend");
  const prepare = path.join(root, "scripts/assets/blender/prepare_source.py");

  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: prepare,
    scriptArgs: [
      "--destination",
      firstPath,
      "--static-crane-pose-frame",
      "2",
    ],
    cwd: root,
  });
  const first = await inspect(blenderBin, firstPath, "first");
  assert.deepEqual(first, {
    armatures: [],
    meshModifiers: [],
    meshParent: "WEB_EXPORT_ROOT",
    metadata: {
      static_crane_pose_bake_policy: "bake-skinned-mesh-pose-v1",
      static_crane_pose_bake_version: 1,
      static_crane_pose_frame: 2,
      static_crane_pose_mesh: "Crane",
    },
  });

  runBlenderScript({
    blenderBin,
    blendFile: firstPath,
    script: prepare,
    scriptArgs: [
      "--destination",
      secondPath,
      "--static-crane-pose-frame",
      "2",
    ],
    cwd: root,
  });
  assert.deepEqual(await inspect(blenderBin, secondPath, "second"), first);
});
