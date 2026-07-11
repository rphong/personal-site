import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const COMPONENT_BYTES = new Map([
  [5120, 1],
  [5121, 1],
  [5122, 2],
  [5123, 2],
  [5125, 4],
  [5126, 4],
]);
const ACCESSOR_SHAPES = new Map([
  ["SCALAR", [1, 1]],
  ["VEC2", [1, 2]],
  ["VEC3", [1, 3]],
  ["VEC4", [1, 4]],
  ["MAT2", [2, 2]],
  ["MAT3", [3, 3]],
  ["MAT4", [4, 4]],
]);

function safeInteger(value, label, { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`Malformed GLB: ${label} must be an integer >= ${min}`);
  }
  return value;
}

function parseJsonChunk(buffer, chunk) {
  const source = buffer
    .subarray(chunk.dataOffset, chunk.dataOffset + chunk.byteLength)
    .toString("utf8")
    .replace(/[\u0000\u0020]+$/g, "");
  try {
    const json = JSON.parse(source);
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error("root value must be an object");
    }
    return json;
  } catch (error) {
    throw new Error(`Malformed GLB JSON: ${error.message}`, { cause: error });
  }
}

export function parseGlb(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("GLB input must be a Buffer");
  }
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
      `Malformed GLB: declared length ${declaredLength}, received ${buffer.length}`,
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
  if (offset !== buffer.length) {
    throw new Error("Malformed GLB: chunk table does not cover the file");
  }
  if (chunks[0]?.type !== JSON_CHUNK_TYPE) {
    throw new Error("Malformed GLB: first chunk must be JSON");
  }
  if (chunks.filter((chunk) => chunk.type === JSON_CHUNK_TYPE).length !== 1) {
    throw new Error("Malformed GLB: expected exactly one JSON chunk");
  }
  const binChunks = chunks.filter((chunk) => chunk.type === BIN_CHUNK_TYPE);
  if (binChunks.length > 1) {
    throw new Error("Malformed GLB: expected at most one BIN chunk");
  }
  if (
    chunks.length > 2 ||
    (chunks.length === 2 && chunks[1].type !== BIN_CHUNK_TYPE)
  ) {
    throw new Error("Malformed GLB: unsupported or misplaced chunk");
  }
  const jsonChunk = chunks[0];
  const binChunk = binChunks[0] ?? null;
  const json = parseJsonChunk(buffer, jsonChunk);
  return { binChunk, chunks, json, jsonChunk };
}

function bufferContract(json, parsed) {
  const buffers = json.buffers ?? [];
  if (!Array.isArray(buffers)) {
    throw new Error("Malformed GLB: buffers must be an array");
  }
  if (buffers.some((buffer) => buffer.uri !== undefined)) {
    throw new Error("Malformed GLB: buffer URI is forbidden");
  }
  if (buffers.length === 0) {
    if (parsed.binChunk) {
      throw new Error("Malformed GLB: BIN chunk has no declared buffer");
    }
    return { byteLengths: [] };
  }
  const byteLengths = buffers.map((buffer, index) => {
    const byteLength = safeInteger(
      buffer.byteLength,
      `buffer ${index} byteLength`,
    );
    if (
      index > 0 &&
      buffer.extensions?.EXT_meshopt_compression?.fallback !== true
    ) {
      throw new Error(
        `Malformed GLB: buffer ${index} is not an embedded Meshopt fallback`,
      );
    }
    return byteLength;
  });
  if (!parsed.binChunk) {
    throw new Error("Malformed GLB: declared buffer requires a BIN chunk");
  }
  if (parsed.binChunk.byteLength < byteLengths[0]) {
    throw new Error(
      "Malformed GLB: BIN chunk is shorter than the declared buffer byteLength",
    );
  }
  if (parsed.binChunk.byteLength - byteLengths[0] > 3) {
    throw new Error("Malformed GLB: BIN padding exceeds three bytes");
  }
  return { byteLengths };
}

function validateBufferView(json, view, index, declaredBufferBytes) {
  if (!view || typeof view !== "object" || Array.isArray(view)) {
    throw new Error(`Malformed GLB: bufferView ${index} must be an object`);
  }
  const bufferIndex = view.buffer ?? 0;
  if (
    !Number.isSafeInteger(bufferIndex) ||
    bufferIndex < 0 ||
    bufferIndex >= declaredBufferBytes.length
  ) {
    throw new Error(`Malformed GLB: bufferView ${index} buffer is invalid`);
  }
  const byteOffset = safeInteger(
    view.byteOffset ?? 0,
    `bufferView ${index} byteOffset`,
  );
  const byteLength = safeInteger(
    view.byteLength,
    `bufferView ${index} byteLength`,
    { min: 1 },
  );
  if (byteOffset + byteLength > declaredBufferBytes[bufferIndex]) {
    throw new Error(`Malformed GLB: bufferView ${index} is out of bounds`);
  }
  if (view.byteStride !== undefined) {
    const stride = safeInteger(
      view.byteStride,
      `bufferView ${index} byteStride`,
      { min: 4 },
    );
    if (stride > 252 || stride % 4 !== 0) {
      throw new Error(`Malformed GLB: bufferView ${index} byteStride is invalid`);
    }
  }
  const meshopt = view.extensions?.EXT_meshopt_compression;
  if (meshopt) {
    if (
      !Number.isSafeInteger(meshopt.buffer) ||
      meshopt.buffer < 0 ||
      meshopt.buffer >= declaredBufferBytes.length
    ) {
      throw new Error(
        `Malformed GLB: bufferView ${index} Meshopt buffer is invalid`,
      );
    }
    const compressedOffset = safeInteger(
      meshopt.byteOffset ?? 0,
      `bufferView ${index} Meshopt byteOffset`,
    );
    const compressedLength = safeInteger(
      meshopt.byteLength,
      `bufferView ${index} Meshopt byteLength`,
      { min: 1 },
    );
    if (
      compressedOffset + compressedLength >
      declaredBufferBytes[meshopt.buffer]
    ) {
      throw new Error(
        `Malformed GLB: bufferView ${index} Meshopt payload is out of bounds`,
      );
    }
    safeInteger(meshopt.byteStride, `bufferView ${index} Meshopt byteStride`, {
      min: 1,
    });
    safeInteger(meshopt.count, `bufferView ${index} Meshopt count`, { min: 1 });
  }
  return { byteLength, byteOffset };
}

function accessorElementBytes(accessor, index) {
  const componentBytes = COMPONENT_BYTES.get(accessor.componentType);
  if (!componentBytes) {
    throw new Error(`Malformed GLB: accessor ${index} componentType is invalid`);
  }
  const shape = ACCESSOR_SHAPES.get(accessor.type);
  if (!shape) {
    throw new Error(`Malformed GLB: accessor ${index} type is invalid`);
  }
  const [columns, rows] = shape;
  if (columns === 1) return componentBytes * rows;
  const columnBytes = componentBytes * rows;
  const alignedColumnBytes = Math.ceil(columnBytes / 4) * 4;
  return alignedColumnBytes * columns;
}

function rangeWithinView({
  byteOffset,
  count,
  elementBytes,
  stride,
  view,
  label,
}) {
  if (count === 0) return;
  const lastByte = byteOffset + (count - 1) * stride + elementBytes;
  if (lastByte > view.byteLength) {
    throw new Error(`Malformed GLB: ${label} is out of bounds`);
  }
}

function validateSparseAccessor(json, accessor, index, elementBytes) {
  const sparse = accessor.sparse;
  if (!sparse) return;
  const count = safeInteger(sparse.count, `accessor ${index} sparse count`, {
    min: 1,
  });
  if (count > accessor.count) {
    throw new Error(`Malformed GLB: accessor ${index} sparse count is invalid`);
  }
  const indices = sparse.indices;
  const indexBytes = new Map([
    [5121, 1],
    [5123, 2],
    [5125, 4],
  ]).get(indices?.componentType);
  if (!indexBytes) {
    throw new Error(
      `Malformed GLB: accessor ${index} sparse indices componentType is invalid`,
    );
  }
  const indicesView = assertBufferViewIndex(
    json,
    indices.bufferView,
    `accessor ${index} sparse indices`,
  );
  rangeWithinView({
    byteOffset: safeInteger(
      indices.byteOffset ?? 0,
      `accessor ${index} sparse indices byteOffset`,
    ),
    count,
    elementBytes: indexBytes,
    stride: indexBytes,
    view: indicesView,
    label: `accessor ${index} sparse indices`,
  });
  const values = sparse.values;
  const valuesView = assertBufferViewIndex(
    json,
    values?.bufferView,
    `accessor ${index} sparse values`,
  );
  rangeWithinView({
    byteOffset: safeInteger(
      values.byteOffset ?? 0,
      `accessor ${index} sparse values byteOffset`,
    ),
    count,
    elementBytes,
    stride: elementBytes,
    view: valuesView,
    label: `accessor ${index} sparse values`,
  });
}

function assertBufferViewIndex(json, index, label) {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= (json.bufferViews?.length ?? 0)
  ) {
    throw new Error(`Malformed GLB: ${label} bufferView is invalid`);
  }
  return json.bufferViews[index];
}

function validateAccessors(json) {
  for (const [index, accessor] of (json.accessors ?? []).entries()) {
    if (!accessor || typeof accessor !== "object" || Array.isArray(accessor)) {
      throw new Error(`Malformed GLB: accessor ${index} must be an object`);
    }
    const count = safeInteger(accessor.count, `accessor ${index} count`, {
      min: 1,
    });
    const elementBytes = accessorElementBytes(accessor, index);
    const byteOffset = safeInteger(
      accessor.byteOffset ?? 0,
      `accessor ${index} byteOffset`,
    );
    const componentBytes = COMPONENT_BYTES.get(accessor.componentType);
    if (byteOffset % componentBytes !== 0) {
      throw new Error(`Malformed GLB: accessor ${index} is misaligned`);
    }
    if (accessor.bufferView !== undefined) {
      const view = assertBufferViewIndex(
        json,
        accessor.bufferView,
        `accessor ${index}`,
      );
      const stride = view.byteStride ?? elementBytes;
      if (stride < elementBytes) {
        throw new Error(`Malformed GLB: accessor ${index} stride is too small`);
      }
      rangeWithinView({
        byteOffset,
        count,
        elementBytes,
        stride,
        view,
        label: `accessor ${index}`,
      });
    }
    validateSparseAccessor(json, accessor, index, elementBytes);
  }
}

function validateImages(json) {
  for (const [index, image] of (json.images ?? []).entries()) {
    if (!image || typeof image !== "object" || Array.isArray(image)) {
      throw new Error(`Malformed GLB: image ${index} must be an object`);
    }
    if (image.uri !== undefined) {
      throw new Error(`Malformed GLB: image URI is forbidden at index ${index}`);
    }
    const view = assertBufferViewIndex(json, image.bufferView, `image ${index}`);
    if ((view.buffer ?? 0) !== 0) {
      throw new Error(
        `Malformed GLB: image ${index} must use the physical embedded buffer`,
      );
    }
    if (typeof image.mimeType !== "string" || image.mimeType.length === 0) {
      throw new Error(`Malformed GLB: image ${index} mimeType is missing`);
    }
  }
}

export function validateGlbJsonRanges(buffer, json, parsed = parseGlb(buffer)) {
  if (json.asset?.version !== "2.0") {
    throw new Error("Malformed GLB: asset.version must be 2.0");
  }
  const { byteLengths } = bufferContract(json, parsed);
  if (!Array.isArray(json.bufferViews ?? [])) {
    throw new Error("Malformed GLB: bufferViews must be an array");
  }
  for (const [index, view] of (json.bufferViews ?? []).entries()) {
    validateBufferView(json, view, index, byteLengths);
  }
  validateAccessors(json);
  validateImages(json);
  return json;
}

export function readGlbJsonBuffer(buffer) {
  const parsed = parseGlb(buffer);
  return validateGlbJsonRanges(buffer, parsed.json, parsed);
}

export function readGlbImagePayloads(
  buffer,
  json = readGlbJsonBuffer(buffer),
) {
  const parsed = parseGlb(buffer);
  validateGlbJsonRanges(buffer, json, parsed);
  if ((json.images ?? []).length > 0 && !parsed.binChunk) {
    throw new Error("Malformed GLB: embedded images require a BIN chunk");
  }
  return (json.images ?? [])
    .map((image, index) => {
      const view = json.bufferViews[image.bufferView];
      const start = parsed.binChunk.dataOffset + (view.byteOffset ?? 0);
      const end = start + view.byteLength;
      const payload = buffer.subarray(start, end);
      return {
        bufferView: image.bufferView,
        byteLength: payload.length,
        bytes: payload.length,
        index,
        mimeType: image.mimeType,
        name: image.name ?? "",
        payload,
        sha256: createHash("sha256").update(payload).digest("hex"),
      };
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.index - right.index,
    );
}

export async function readGlbJson(filePath) {
  return readGlbJsonBuffer(await readFile(filePath));
}
