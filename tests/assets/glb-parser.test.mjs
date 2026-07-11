import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  parseGlb,
  readGlbImagePayloads,
  readGlbJson,
  readGlbJsonBuffer,
} from "../../scripts/assets/lib/glb.mjs";

const tempRoot = path.resolve(
  import.meta.dirname,
  `../../.tmp/assets/glb-parser-test-${process.pid}`,
);

test.after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

function pad(buffer, fill) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function makeGlb(json, bin = null) {
  const jsonBytes = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const chunks = [];
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  chunks.push(jsonHeader, jsonBytes);
  if (bin) {
    const binBytes = pad(Buffer.from(bin), 0);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binBytes.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);
    chunks.push(binHeader, binBytes);
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(header.length + body.length, 8);
  return Buffer.concat([header, body]);
}

function validFixture() {
  const bin = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteLength: 4, byteOffset: 0 },
      { buffer: 0, byteLength: 4, byteOffset: 4 },
    ],
    images: [
      { bufferView: 1, mimeType: "image/png", name: "Zulu" },
      { bufferView: 0, mimeType: "image/webp", name: "Alpha" },
    ],
  };
  return { bin, buffer: makeGlb(json, bin), json };
}

test("strict parser reads embedded image payloads in deterministic name order", async () => {
  const { bin, buffer, json } = validFixture();
  assert.deepEqual(readGlbJsonBuffer(buffer), json);
  const parsed = parseGlb(buffer);
  assert.equal(parsed.binChunk.byteLength, bin.length);

  const payloads = readGlbImagePayloads(buffer, json);
  assert.deepEqual(
    payloads.map(({ name, mimeType, byteLength }) => ({
      name,
      mimeType,
      byteLength,
    })),
    [
      { name: "Alpha", mimeType: "image/webp", byteLength: 4 },
      { name: "Zulu", mimeType: "image/png", byteLength: 4 },
    ],
  );
  assert.deepEqual(payloads[0].payload, Buffer.from([1, 2, 3, 4]));
  assert.equal(
    payloads[0].sha256,
    createHash("sha256").update(payloads[0].payload).digest("hex"),
  );

  await mkdir(tempRoot, { recursive: true });
  await writeFile(path.join(tempRoot, "valid.glb"), buffer);
  assert.deepEqual(await readGlbJson(path.join(tempRoot, "valid.glb")), json);
});

test("parser rejects malformed envelopes, chunks, URIs, and binary ranges", () => {
  const { buffer, json } = validFixture();
  const cases = [];

  const badMagic = Buffer.from(buffer);
  badMagic.write("nope", 0, "ascii");
  cases.push([badMagic, /missing glTF magic/]);
  const badVersion = Buffer.from(buffer);
  badVersion.writeUInt32LE(1, 4);
  cases.push([badVersion, /expected version 2/]);
  const badLength = Buffer.from(buffer);
  badLength.writeUInt32LE(buffer.length - 4, 8);
  cases.push([badLength, /declared length/]);
  const badFirstChunk = Buffer.from(buffer);
  badFirstChunk.writeUInt32LE(0x004e4942, 16);
  cases.push([badFirstChunk, /first chunk must be JSON/]);

  cases.push([
    makeGlb({ ...json, buffers: [{ ...json.buffers[0], uri: "mesh.bin" }] }, Buffer.alloc(8)),
    /buffer URI/,
  ]);
  cases.push([
    makeGlb({ ...json, images: [{ uri: "image.png" }] }, Buffer.alloc(8)),
    /image URI/,
  ]);
  cases.push([
    makeGlb({ ...json, bufferViews: [{ buffer: 0, byteLength: 9 }] }, Buffer.alloc(8)),
    /bufferView.*out of bounds/,
  ]);
  cases.push([
    makeGlb(
      {
        ...json,
        accessors: [
          {
            bufferView: 0,
            byteOffset: 4,
            componentType: 5126,
            count: 1,
            type: "SCALAR",
          },
        ],
      },
      Buffer.alloc(8),
    ),
    /accessor.*out of bounds/,
  ]);
  cases.push([
    makeGlb({ ...json, buffers: [{ byteLength: 12 }] }, Buffer.alloc(8)),
    /BIN chunk.*buffer byteLength/,
  ]);
  cases.push([
    makeGlb({ ...json, buffers: [{ byteLength: 1 }] }, Buffer.alloc(8)),
    /BIN padding/,
  ]);

  for (const [candidate, pattern] of cases) {
    assert.throws(() => readGlbJsonBuffer(candidate), pattern);
  }
});
