import sharp from "sharp";

const TRANSPARENT_DELTA = 12;
const OPAQUE_DELTA = 32;

function rgbFromHex(hex) {
  const match = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid foreground background ${hex}`);
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

export async function makeFlatBackgroundTransparent(input, backgroundHex) {
  const background = rgbFromHex(backgroundHex);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(data[offset] - background[0]),
      Math.abs(data[offset + 1] - background[1]),
      Math.abs(data[offset + 2] - background[2]),
    );
    const normalized = Math.max(
      0,
      Math.min(
        1,
        (delta - TRANSPARENT_DELTA) /
          (OPAQUE_DELTA - TRANSPARENT_DELTA),
      ),
    );
    data[offset + 3] = Math.round(normalized * 255);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}
