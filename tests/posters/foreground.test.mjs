import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("keeps every layered route hero poster transparent", async () => {
  const contract = JSON.parse(
    await readFile("assets/poster-contract.json", "utf8"),
  );
  const heroScenes = contract.scenes.filter((scene) =>
    scene.id.endsWith("-hero"),
  );

  assert.deepEqual(
    heroScenes.map((scene) => scene.id),
    ["home-hero", "experience-hero", "projects-hero", "contact-hero"],
  );

  for (const scene of heroScenes) {
    assert.equal(scene.transparent, true, `${scene.id} must composite over HTML`);
    for (const output of Object.values(scene.outputs)) {
      assert.equal(
        (await sharp(output).metadata()).hasAlpha,
        true,
        `${output} must retain alpha for title layering`,
      );
    }
  }
});
