import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveBlenderBin, runBlenderScript } from "../../scripts/assets/lib/blender.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(root, `.tmp/assets/rocket-bake-test-${process.pid}`);
const legacyFixtureScript = path.join(
  root,
  "tests/assets/fixtures/rocket_legacy_fixture.py",
);

test.afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function inspect(blenderBin, blendFile, name) {
  const reportPath = path.join(tempRoot, `${name}.json`);
  const stdout = runBlenderScript({
    blenderBin,
    blendFile,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", reportPath],
    cwd: root,
  });
  return {
    inspection: JSON.parse(await readFile(reportPath, "utf8")),
    stdout,
  };
}

async function inspectLegacyFixture(blenderBin, blendFile, name) {
  const reportPath = path.join(tempRoot, `${name}-legacy.json`);
  runBlenderScript({
    blenderBin,
    blendFile,
    script: legacyFixtureScript,
    scriptArgs: ["--report", reportPath],
    cwd: root,
  });
  return JSON.parse(await readFile(reportPath, "utf8"));
}

function rocketSmokeSemantics(inspection) {
  const rootProperties = Object.fromEntries(
    Object.entries(inspection.rootCustomProperties)
      .filter(([key]) => key.startsWith("rocket_smoke_")),
  );
  return {
    animation: inspection.animationDetails.RocketAction,
    materialNames: inspection.materialNames,
    materialNodeTypes: inspection.materialNodeTypes,
    objectParents: {
      RocketSmokeEngineBaked:
        inspection.objectParents.RocketSmokeEngineBaked,
      RocketSmokeGroundBaked:
        inspection.objectParents.RocketSmokeGroundBaked,
    },
    rocketAnimationBinding: inspection.objectAnimationBindings.Rocket,
    objectProperties: {
      RocketSmokeEngineBaked:
        inspection.objectCustomProperties.RocketSmokeEngineBaked,
      RocketSmokeGroundBaked:
        inspection.objectCustomProperties.RocketSmokeGroundBaked,
    },
    rootProperties,
    triangleEstimate: inspection.triangleEstimate,
  };
}

function bakeRocketFromLegacy({ blenderBin, input, output }) {
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", output,
      "--rocket-smoke-bake-frame", "60",
    ],
    cwd: root,
  });
}

test("Rocket legacy smoke is baked deterministically, exportably, and idempotently", async () => {
  await mkdir(tempRoot, { recursive: true });
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "Rocket-input.blend");
  const legacy = path.join(tempRoot, "Rocket-legacy.blend");
  const baked = path.join(tempRoot, "Rocket-baked.blend");
  const bakedIndependent = path.join(
    tempRoot,
    "Rocket-baked-independent.blend",
  );
  const bakedAgain = path.join(tempRoot, "Rocket-baked-again.blend");
  await copyFile(path.join(root, "assets/blender/Rocket.blend"), input);

  const canonical = await inspect(blenderBin, input, "canonical");
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: legacyFixtureScript,
    scriptArgs: ["--destination", legacy],
    cwd: root,
  });
  const before = await inspect(blenderBin, legacy, "before");
  const legacyState = await inspectLegacyFixture(blenderBin, legacy, "before");

  assert.deepEqual(before.inspection.particleSystems, ["Engine Smoke", "Ground Smoke"]);
  assert.deepEqual(legacyState.particleInstances, {
    "Smoke Emitter": 51,
    "Smoke Emitter Outward": 400,
  });
  assert.deepEqual(legacyState.particleRecords, [
    ["Engine Smoke", "Smoke Emitter", "Smoke Particle"],
    ["Ground Smoke", "Smoke Emitter Outward", "Smoke Particle Gray"],
  ]);
  assert.deepEqual(legacyState.forceFields, {
    Turbulence: "TURBULENCE",
    Wind: "WIND",
  });
  assert.deepEqual(legacyState.brownianFactors, {
    "Smoke Emitter": 1,
    "Smoke Emitter Outward": 20,
  });
  assert.deepEqual(legacyState.legacyTextures, ["Horizontal Smoke", "Vertical Smoke"]);
  assert.deepEqual(legacyState.unsupportedNodes, [
    "ShaderNodeBsdfDiffuse",
    "ShaderNodeBsdfTransparent",
    "ShaderNodeMath",
    "ShaderNodeMixShader",
    "ShaderNodeParticleInfo",
    "ShaderNodeValToRGB",
  ]);
  assert.ok(before.inspection.materialNames.includes("Material"));
  assert.ok(before.inspection.materialNames.includes("Material.001"));
  assert.ok(before.inspection.allObjects.includes("Turbulence"));
  assert.ok(before.inspection.allObjects.includes("Wind"));
  assert.ok(!before.inspection.allObjects.includes("RocketSmokeEngineBaked"));
  assert.ok(!before.inspection.allObjects.includes("RocketSmokeGroundBaked"));
  assert.equal(before.inspection.rootCustomProperties.rocket_smoke_bake_frame, undefined);
  assert.equal(before.inspection.rootCustomProperties.rocket_smoke_bake_version, undefined);
  assert.deepEqual(
    before.inspection.animationDetails.RocketAction,
    canonical.inspection.animationDetails.RocketAction,
  );

  bakeRocketFromLegacy({
    blenderBin,
    input: legacy,
    output: baked,
  });
  const first = await inspect(blenderBin, baked, "first");

  bakeRocketFromLegacy({
    blenderBin,
    input: legacy,
    output: bakedIndependent,
  });
  const independent = await inspect(
    blenderBin,
    bakedIndependent,
    "independent",
  );
  assert.deepEqual(
    rocketSmokeSemantics(independent.inspection),
    rocketSmokeSemantics(first.inspection),
  );

  assert.notEqual(first.inspection.sceneFrame, 60);
  assert.equal(first.inspection.rootCount, 1);
  assert.deepEqual(first.inspection.rootTransform, {
    location: [0, 0, 0],
    rotationEuler: [0, 0, 0],
    scale: [1, 1, 1],
  });
  assert.deepEqual(first.inspection.particleSystems, []);
  assert.deepEqual(first.inspection.volumeObjects, []);
  assert.deepEqual(first.inspection.externalResources, []);
  assert.deepEqual(first.inspection.shadowCatchers, []);
  assert.ok(!first.inspection.allObjects.includes("Ground"));
  assert.ok(!first.inspection.meshNames.includes("Plane"));
  assert.doesNotMatch(first.stdout, /dependency cycle/i);
  assert.ok(first.inspection.objects.includes("RocketSmokeEngineBaked"));
  assert.ok(first.inspection.objects.includes("RocketSmokeGroundBaked"));
  assert.equal(
    first.inspection.rootCustomProperties.web_ground_removed_object,
    "Ground",
  );
  assert.equal(
    first.inspection.rootCustomProperties.web_ground_removed_mesh,
    "Plane",
  );
  assert.equal(
    first.inspection.rootCustomProperties.web_ground_shadow_strategy,
    "transparent-canvas-contact-shadow-v1",
  );
  assert.equal(first.inspection.objectParents.RocketSmokeEngineBaked, "Rocket");
  assert.equal(first.inspection.objectParents.RocketSmokeGroundBaked, "WEB_EXPORT_ROOT");
  assert.equal(first.inspection.rootCustomProperties.rocket_smoke_bake_frame, 60);
  assert.equal(first.inspection.rootCustomProperties.rocket_smoke_bake_version, 2);
  assert.equal(
    first.inspection.rootCustomProperties.rocket_smoke_simulation_policy,
    "procedural-seeded-static-v1",
  );
  assert.equal(first.inspection.rootCustomProperties.rocket_smoke_engine_seed, 51060);
  assert.equal(first.inspection.rootCustomProperties.rocket_smoke_ground_seed, 40060);
  assert.equal(
    first.inspection.rootCustomProperties.rocket_smoke_engine_style,
    "engine-cone",
  );
  assert.equal(
    first.inspection.rootCustomProperties.rocket_smoke_ground_style,
    "ground-ring",
  );
  assert.equal(
    first.inspection.objectCustomProperties.RocketSmokeEngineBaked.baked_particle_count,
    51,
  );
  assert.equal(
    first.inspection.objectCustomProperties.RocketSmokeGroundBaked.baked_particle_count,
    400,
  );
  for (const [objectName, prefix] of [
    ["RocketSmokeEngineBaked", "rocket_smoke_engine"],
    ["RocketSmokeGroundBaked", "rocket_smoke_ground"],
  ]) {
    const properties = first.inspection.objectCustomProperties[objectName];
    const expectedProcedural = objectName === "RocketSmokeEngineBaked"
      ? { seed: 51060, style: "engine-cone" }
      : { seed: 40060, style: "ground-ring" };
    assert.equal(properties.procedural_seed, expectedProcedural.seed);
    assert.equal(properties.procedural_style, expectedProcedural.style);
    assert.match(properties.geometry_sha256, /^[a-f0-9]{64}$/);
    assert.match(properties.material_sha256, /^[a-f0-9]{64}$/);
    assert.ok(properties.geometry_vertex_count > 0);
    assert.ok(properties.geometry_edge_count > 0);
    assert.ok(properties.geometry_polygon_count > 0);
    assert.ok(properties.geometry_triangle_count > 0);
    assert.equal(
      first.inspection.rootCustomProperties[`${prefix}_geometry_sha256`],
      properties.geometry_sha256,
    );
    assert.equal(
      first.inspection.rootCustomProperties[`${prefix}_material_sha256`],
      properties.material_sha256,
    );
  }
  assert.ok(first.inspection.triangleEstimate >= 9_300);
  assert.ok(first.inspection.triangleEstimate <= 9_400);
  assert.equal(first.inspection.triangleEstimate, canonical.inspection.triangleEstimate);
  assert.deepEqual(
    first.inspection.animationDetails.RocketAction,
    before.inspection.animationDetails.RocketAction,
  );
  assert.deepEqual(first.inspection.objectAnimationBindings.Rocket, {
    action: "RocketAction",
    drivers: 0,
    nlaTracks: 0,
  });
  assert.doesNotMatch(
    first.inspection.materialNodeTypes.join("\n"),
    /ShaderNode(?:ParticleInfo|BsdfDiffuse|BsdfTransparent|Math|MixShader|ValToRGB)/,
  );

  runBlenderScript({
    blenderBin,
    blendFile: baked,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", bakedAgain,
      "--rocket-smoke-bake-frame", "60",
    ],
    cwd: root,
  });
  const second = await inspect(blenderBin, bakedAgain, "second");
  assert.doesNotMatch(second.stdout, /dependency cycle/i);
  assert.equal(second.inspection.triangleEstimate, first.inspection.triangleEstimate);
  assert.deepEqual(second.inspection.objects, first.inspection.objects);
  assert.deepEqual(second.inspection.animationDetails, first.inspection.animationDetails);
  assert.deepEqual(second.inspection.particleSystems, []);
  assert.deepEqual(second.inspection.materialNodeTypes, first.inspection.materialNodeTypes);
});

test("Rocket smoke bake rejects partial state instead of blessing it", async () => {
  await mkdir(tempRoot, { recursive: true });
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "Rocket-input.blend");
  const partial = path.join(tempRoot, "Rocket-partial.blend");
  const rejectedOutput = path.join(tempRoot, "Rocket-should-not-exist.blend");
  const partialScript = path.join(tempRoot, "make_partial.py");
  await copyFile(path.join(root, "assets/blender/Rocket.blend"), input);
  await writeFile(
    partialScript,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nroot = bpy.data.objects.get("WEB_EXPORT_ROOT")\nexisting = bpy.data.objects.get("RocketSmokeGroundBaked")\nif existing:\n    bpy.data.objects.remove(existing, do_unlink=True)\nelse:\n    mesh = bpy.data.meshes.new("PartialRocketSmokeMesh")\n    partial = bpy.data.objects.new("RocketSmokeEngineBaked", mesh)\n    bpy.context.scene.collection.objects.link(partial)\n    partial.parent = root\n    root["rocket_smoke_bake_frame"] = 60\n    root["rocket_smoke_bake_version"] = 2\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: partialScript,
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
          "--destination", rejectedOutput,
          "--rocket-smoke-bake-frame", "60",
        ],
        cwd: root,
      }),
    /partial or inconsistent|state is unknown/,
  );
});

test("Rocket completed bake rejects export-affecting static-state corruption", async () => {
  await mkdir(tempRoot, { recursive: true });
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "Rocket-integrity-input.blend");
  const legacy = path.join(tempRoot, "Rocket-integrity-legacy.blend");
  const baked = path.join(tempRoot, "Rocket-integrity-baked.blend");
  const corruptionScript = path.join(tempRoot, "corrupt_baked_rocket.py");
  await copyFile(path.join(root, "assets/blender/Rocket.blend"), input);
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: legacyFixtureScript,
    scriptArgs: ["--destination", legacy],
    cwd: root,
  });
  runBlenderScript({
    blenderBin,
    blendFile: legacy,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: [
      "--destination", baked,
      "--rocket-smoke-bake-frame", "60",
    ],
    cwd: root,
  });
  await writeFile(
    corruptionScript,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nmode = argv[argv.index("--mode") + 1]\nobj = bpy.data.objects["RocketSmokeEngineBaked"]\nmesh = obj.data\nmaterial = mesh.materials[0]\nprincipled = next(node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")\nif mode == "geometry":\n    mesh.vertices[0].co.x += 0.125\nelif mode == "material":\n    principled.inputs["Roughness"].default_value = 0.125\nelif mode == "smooth":\n    mesh.polygons[0].use_smooth = True\nelif mode == "custom-normals":\n    mesh.use_auto_smooth = True\n    mesh.normals_split_custom_set_from_vertices([(0.0, 0.0, 1.0)] * len(mesh.vertices))\nelif mode == "uv":\n    mesh.uv_layers[0].data[0].uv.x += 0.125\nelif mode == "modifier":\n    obj.modifiers.new("Corrupt Displace", "DISPLACE")\nelif mode == "constraint":\n    obj.constraints.new("LIMIT_LOCATION")\nelif mode == "shape-key":\n    obj.shape_key_add(name="Basis", from_mix=False)\nelif mode == "object-animation":\n    obj["corrupt_driver"] = 0.0\n    obj.driver_add('["corrupt_driver"]').driver.expression = "1.0"\nelif mode == "mesh-animation":\n    mesh.animation_data_create()\n    mesh.animation_data.action = bpy.data.actions.new("CorruptMeshAction")\nelif mode == "material-animation":\n    material.animation_data_create()\n    material.animation_data.action = bpy.data.actions.new("CorruptMaterialAction")\nelif mode == "node-animation":\n    material.node_tree.animation_data_create()\n    material.node_tree.animation_data.action = bpy.data.actions.new("CorruptNodeAction")\nelif mode == "material-flag":\n    material.use_backface_culling = not material.use_backface_culling\nelif mode == "node-mute":\n    principled.mute = True\nelif mode == "visibility":\n    obj.hide_render = True\nelse:\n    raise RuntimeError(f"unknown corruption mode: {mode}")\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );

  for (const mode of [
    "geometry",
    "material",
    "smooth",
    "custom-normals",
    "uv",
    "modifier",
    "constraint",
    "shape-key",
    "object-animation",
    "mesh-animation",
    "material-animation",
    "node-animation",
    "material-flag",
    "node-mute",
    "visibility",
  ]) {
    const corrupted = path.join(tempRoot, `Rocket-${mode}-corrupted.blend`);
    const rejected = path.join(tempRoot, `Rocket-${mode}-should-not-exist.blend`);
    runBlenderScript({
      blenderBin,
      blendFile: baked,
      script: corruptionScript,
      scriptArgs: ["--destination", corrupted, "--mode", mode],
      cwd: root,
    });
    assert.throws(
      () =>
        runBlenderScript({
          blenderBin,
          blendFile: corrupted,
          script: path.join(root, "scripts/assets/blender/prepare_source.py"),
          scriptArgs: [
            "--destination", rejected,
            "--rocket-smoke-bake-frame", "60",
          ],
          cwd: root,
        }),
      /RocketSmokeEngine.*(?:animation|constraint|custom|driver|geometry|integrity|material|modifier|mute|normal|Principled|Roughness|shape|smooth|static|UV|visibility)/i,
    );
    await assert.rejects(readFile(rejected), { code: "ENOENT" });
  }
});

test("Rocket completed bake rejects a smoke object outside the active scene", async () => {
  await mkdir(tempRoot, { recursive: true });
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(root, "assets/blender/Rocket.blend");
  const corrupted = path.join(tempRoot, "Rocket-unlinked-smoke.blend");
  const rejected = path.join(tempRoot, "Rocket-unlinked-smoke-should-not-exist.blend");
  const corruptionScript = path.join(tempRoot, "unlink_baked_rocket.py");
  await writeFile(
    corruptionScript,
    `import sys\nfrom pathlib import Path\nimport bpy\nargv = sys.argv[sys.argv.index("--") + 1:]\ndestination = Path(argv[argv.index("--destination") + 1]).resolve()\nobj = bpy.data.objects["RocketSmokeEngineBaked"]\nfor collection in list(obj.users_collection):\n    collection.objects.unlink(obj)\nobj.use_fake_user = True\nbpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False, compress=True)\n`,
    "utf8",
  );
  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: corruptionScript,
    scriptArgs: ["--destination", corrupted],
    cwd: root,
  });

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: corrupted,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs: [
          "--destination", rejected,
          "--rocket-smoke-bake-frame", "60",
        ],
        cwd: root,
      }),
    /RocketSmokeEngineBaked.*(?:active scene|view layer|linked)/i,
  );
  await assert.rejects(readFile(rejected), { code: "ENOENT" });
});
