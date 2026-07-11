import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  resolveBlenderBin,
  runBlenderScript,
} from "../../scripts/assets/lib/blender.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const tempRoot = path.join(
  root,
  `.tmp/assets/export-root-dependencies-test-${process.pid}`,
);
const fixtureScript = path.join(
  root,
  "tests/assets/fixtures/plane_motion_fixture.py",
);
const INERT_ROOT_STATE = {
  animation: null,
  constraints: [],
  data: false,
  deltaLocation: [0, 0, 0],
  deltaRotationEuler: [0, 0, 0],
  deltaRotationQuaternion: [1, 0, 0, 0],
  deltaScale: [1, 1, 1],
  fieldType: null,
  hidden: false,
  hideRender: false,
  hideViewport: false,
  instanceCollection: null,
  instanceType: "NONE",
  inScene: true,
  inViewLayer: true,
  isHoldout: false,
  isInstancer: false,
  isShadowCatcher: false,
  matrixWorld: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
  modifiers: [],
  parent: null,
  particleSystems: [],
  rigidBody: false,
  rigidBodyConstraint: false,
  rotationAxisAngle: [0, 0, 1, 0],
  rotationMode: "XYZ",
  rotationQuaternion: [1, 0, 0, 0],
};

test.beforeEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
  await mkdir(tempRoot, { recursive: true });
});

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

async function inspect(blenderBin, blendFile, name, frames) {
  const reportPath = path.join(tempRoot, `${name}.json`);
  runBlenderScript({
    blenderBin,
    blendFile,
    script: fixtureScript,
    scriptArgs: [
      "--report", reportPath,
      "--frames", frames.join(","),
    ],
    cwd: root,
  });
  return JSON.parse(await readFile(reportPath, "utf8"));
}

function assertMatricesClose(actual, expected, label, tolerance = 1e-5) {
  assert.equal(actual.length, expected.length, `${label} row count`);
  for (let row = 0; row < expected.length; row += 1) {
    assert.equal(actual[row].length, expected[row].length, `${label} column count`);
    for (let column = 0; column < expected[row].length; column += 1) {
      assert.ok(
        Math.abs(actual[row][column] - expected[row][column]) <= tolerance,
        `${label}[${row}][${column}] expected ${expected[row][column]}, got ${actual[row][column]}`,
      );
    }
  }
}

function assertSampledObjectMotion(before, after, objectNames, frames) {
  for (const frame of frames) {
    for (const objectName of objectNames) {
      assertMatricesClose(
        after.samples[String(frame)][objectName].matrixWorld,
        before.samples[String(frame)][objectName].matrixWorld,
        `${objectName} frame ${frame}`,
      );
    }
  }
}

function parseGlb(buffer) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  const binaryHeader = 20 + jsonLength;
  const binaryLength = buffer.readUInt32LE(binaryHeader);
  assert.equal(buffer.readUInt32LE(binaryHeader + 4), 0x004e4942);
  return {
    binary: buffer.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength),
    json,
  };
}

function readFloatAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126);
  assert.equal(view.buffer, 0);
  const components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.ok(components, `unsupported accessor type ${accessor.type}`);
  const stride = view.byteStride ?? components * 4;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = new DataView(
    glb.binary.buffer,
    glb.binary.byteOffset,
    glb.binary.byteLength,
  );
  return Array.from({ length: accessor.count }, (_, index) =>
    Array.from({ length: components }, (_unused, component) =>
      data.getFloat32(start + index * stride + component * 4, true)),
  );
}

function assertGlbPreservesEmptyMotion(glb, expectedSamples, frames) {
  const emptyIndex = glb.json.nodes.findIndex((node) => node.name === "Empty");
  assert.ok(emptyIndex >= 0, "GLB omits animated Empty node");
  const channelRecord = glb.json.animations
    .flatMap((animation) =>
      animation.channels.map((channel) => ({ animation, channel })))
    .find(({ channel }) =>
      channel.target.node === emptyIndex && channel.target.path === "translation");
  assert.ok(channelRecord, "GLB omits Empty translation animation");
  const sampler = channelRecord.animation.samplers[channelRecord.channel.sampler];
  const times = readFloatAccessor(glb, sampler.input).map(([value]) => value);
  const translations = readFloatAccessor(glb, sampler.output);
  for (const frame of frames) {
    const expectedTime = frame / 24;
    const index = times.findIndex((value) => Math.abs(value - expectedTime) <= 1e-4);
    assert.ok(index >= 0, `GLB has no sampled Empty key for frame ${frame}`);
    const expected = expectedSamples[String(frame)].Empty.translation;
    for (let component = 0; component < 3; component += 1) {
      assert.ok(
        Math.abs(translations[index][component] - expected[component]) <= 1e-4,
        `GLB Empty translation drift at frame ${frame}, component ${component}`,
      );
    }
  }
}

test("export rooting preserves hidden animated ancestors and their constraint targets", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "plane-motion-input.blend");
  const curated = path.join(tempRoot, "plane-motion-curated.blend");
  const rawGlb = path.join(tempRoot, "plane-motion-selected-root.glb");
  const pipelineReport = path.join(tempRoot, "plane-motion-pipeline.json");
  const frames = [1, 19, 33];
  runBlenderScript({
    blenderBin,
    script: fixtureScript,
    scriptArgs: ["--destination", input],
    cwd: root,
  });
  const before = await inspect(blenderBin, input, "fixture-before", frames);

  runBlenderScript({
    blenderBin,
    blendFile: input,
    script: path.join(root, "scripts/assets/blender/prepare_source.py"),
    scriptArgs: ["--destination", curated],
    cwd: root,
  });
  const after = await inspect(blenderBin, curated, "fixture-after", frames);
  runBlenderScript({
    blenderBin,
    blendFile: curated,
    script: path.join(root, "scripts/assets/blender/inspect_scene.py"),
    scriptArgs: ["--report", pipelineReport],
    cwd: root,
  });
  const pipelineInspection = JSON.parse(await readFile(pipelineReport, "utf8"));
  runBlenderScript({
    blenderBin,
    blendFile: curated,
    script: fixtureScript,
    scriptArgs: ["--export-glb", rawGlb],
    cwd: root,
  });
  const glb = parseGlb(await readFile(rawGlb));

  assert.equal(after.rootCount, 1);
  assert.deepEqual(pipelineInspection.rootState, INERT_ROOT_STATE);
  assert.deepEqual(after.rootTransform, {
    location: [0, 0, 0],
    rotationEuler: [0, 0, 0],
    scale: [1, 1, 1],
  });
  assert.equal(after.parents["Paper plane"], "Empty");
  assert.equal(after.parents.Empty, "WEB_EXPORT_ROOT");
  assert.equal(after.parents.BezierCurve, null);
  assert.equal(after.parents.UnrelatedHidden, null);
  assert.deepEqual(after.rootDescendants, [
    "Empty",
    "Paper plane",
  ]);
  assert.equal(after.constraints.Empty[0].type, "FOLLOW_PATH");
  assert.equal(after.constraints.Empty[0].target, "BezierCurve");
  assert.deepEqual(after.constraints.Empty, before.constraints.Empty);
  assert.deepEqual(after.actions.EmptyAction, before.actions.EmptyAction);
  assertSampledObjectMotion(
    before,
    after,
    ["Paper plane", "Empty", "BezierCurve"],
    frames,
  );
  assert.deepEqual(
    glb.json.nodes.map((node) => node.name).sort(),
    ["Empty", "Paper plane", "WEB_EXPORT_ROOT"],
  );
  assert.equal(glb.json.meshes.length, 1);
  assert.ok(!glb.json.nodes.some((node) => /BezierCurve/i.test(node.name ?? "")));
  assert.ok(!glb.json.meshes.some((mesh) => /BezierCurve/i.test(mesh.name ?? "")));
  assertGlbPreservesEmptyMotion(glb, before.samples, frames);
});

test("an existing contaminated WEB_EXPORT_ROOT is rejected without output", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "contaminated-root-input.blend");
  const curated = path.join(tempRoot, "contaminated-root-curated.blend");
  const frames = [1, 19, 33];
  runBlenderScript({
    blenderBin,
    script: fixtureScript,
    scriptArgs: ["--contaminated-root-destination", input],
    cwd: root,
  });
  const before = await inspect(blenderBin, input, "root-before", frames);
  assert.notDeepEqual(before.rootState.matrixWorld, [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]);
  assert.equal(before.rootState.parent, "UnrelatedHidden");
  assert.ok(before.rootState.constraints.length > 0);
  assert.equal(before.rootState.animation.action, "RootDriftAction");
  assert.equal(before.rootState.animation.drivers, 1);
  const inputBytes = await readFile(input);

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: input,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs: ["--destination", curated],
        cwd: root,
      }),
    /WEB_EXPORT_ROOT.*(?:parent|constraint|animation|driver|identity|inert)/i,
  );
  await assert.rejects(readFile(curated), { code: "ENOENT" });
  assert.deepEqual(await readFile(input), inputBytes);
});

test("an identity WEB_EXPORT_ROOT with collection instancing is rejected", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "instanced-root-input.blend");
  const curated = path.join(tempRoot, "instanced-root-curated.blend");
  runBlenderScript({
    blenderBin,
    script: fixtureScript,
    scriptArgs: ["--instanced-root-destination", input],
    cwd: root,
  });

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: input,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs: ["--destination", curated],
        cwd: root,
      }),
    /WEB_EXPORT_ROOT.*(?:instance|collection|inert|evaluative)/i,
  );
  await assert.rejects(readFile(curated), { code: "ENOENT" });
});

test("an identity WEB_EXPORT_ROOT outside the active scene is rejected", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const input = path.join(tempRoot, "unlinked-root-input.blend");
  const curated = path.join(tempRoot, "unlinked-root-curated.blend");
  runBlenderScript({
    blenderBin,
    script: fixtureScript,
    scriptArgs: ["--unlinked-root-destination", input],
    cwd: root,
  });

  assert.throws(
    () =>
      runBlenderScript({
        blenderBin,
        blendFile: input,
        script: path.join(root, "scripts/assets/blender/prepare_source.py"),
        scriptArgs: ["--destination", curated],
        cwd: root,
      }),
    /WEB_EXPORT_ROOT.*(?:active scene|view layer|linked)/i,
  );
  await assert.rejects(readFile(curated), { code: "ENOENT" });
});

test("no-op curation preserves sampled semantics for every current animated source", async () => {
  const blenderBin = resolveBlenderBin({ root });
  const cases = [
    ["crane-workout", "CraneWorkout.blend", [1, 40, 80]],
    ["crane-throwing-plane", "CraneThrowingPlane.blend", [1, 19, 33]],
    ["rocket", "Rocket.blend", [1, 60, 100]],
  ];
  for (const [key, fileName, frames] of cases) {
    const input = path.join(tempRoot, `${key}-input.blend`);
    const output = path.join(tempRoot, `${key}-curated.blend`);
    await copyFile(path.join(root, "assets/blender", fileName), input);
    const before = await inspect(blenderBin, input, `${key}-before`, frames);
    assert.deepEqual(before.shadowCatchers, [], `${key} retained a web ground`);
    runBlenderScript({
      blenderBin,
      blendFile: input,
      script: path.join(root, "scripts/assets/blender/prepare_source.py"),
      scriptArgs: ["--destination", output],
      cwd: root,
    });
    const after = await inspect(blenderBin, output, `${key}-after`, frames);
    assert.deepEqual(after.shadowCatchers, [], `${key} restored a web ground`);
    assert.deepEqual(after.actions, before.actions, `${key} actions drifted`);
    assert.deepEqual(
      after.objectAnimationBindings,
      before.objectAnimationBindings,
      `${key} animation bindings drifted`,
    );
    assert.deepEqual(after.constraints, before.constraints, `${key} constraints drifted`);
    assert.deepEqual(after.samples, before.samples, `${key} sampled motion drifted`);
    assert.deepEqual(
      after.rootDescendants,
      before.rootDescendants,
      `${key} export hierarchy drifted`,
    );
  }
});
