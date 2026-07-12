import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { makeFlatBackgroundTransparent } from "../../scripts/posters/foreground.mjs";

test("turns a flat scene background transparent while preserving foreground", async () => {
  const source = await sharp(
    Buffer.from([
      158, 204, 192,
      140, 186, 174,
      90, 50, 40,
    ]),
    { raw: { width: 3, height: 1, channels: 3 } },
  )
    .png()
    .toBuffer();

  const { data, info } = await sharp(
    await makeFlatBackgroundTransparent(source, "#9ECCC0"),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assert.equal(info.width, 3);
  assert.equal(info.height, 1);
  assert.equal(data[3], 0);
  assert.ok(data[7] > 0 && data[7] < 255);
  assert.equal(data[11], 255);
  assert.deepEqual([...data.subarray(8, 11)], [90, 50, 40]);
});

test("rejects malformed background colors", async () => {
  await assert.rejects(
    makeFlatBackgroundTransparent(Buffer.from("not-an-image"), "mint"),
    /Invalid foreground background/,
  );
});
