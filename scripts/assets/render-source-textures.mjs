import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { loadSourceManifest, sha256File } from "./lib/manifest.mjs";

const LEAGUE_SVG_NAMES = [
  "league-ban-dashboard",
  "league-match-history",
];

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validateOwnedLeagueSvg(name, buffer) {
  const fileName = `${name}.svg`;
  const source = buffer.toString("utf8");
  if (!/<svg\b[^>]*>[\s\S]*<\/svg>\s*$/i.test(source)) {
    throw new Error(`${fileName} failed owned SVG policy: valid SVG root required`);
  }
  if (/<image\b/i.test(source)) {
    throw new Error(`${fileName} failed owned SVG policy: raster images are forbidden`);
  }
  if (/\b(?:riot|champion|item|logo)\b/i.test(source)) {
    throw new Error(`${fileName} failed owned SVG policy: third-party brand assets are forbidden`);
  }
}

async function promoteRenderedTextures(outputs, operationId) {
  const promotions = outputs.map((output, index) => ({
    ...output,
    backupMoved: false,
    outputMoved: false,
    backupPath: `${output.outputPath}.${operationId}.${index}.backup`,
  }));
  try {
    for (const promotion of promotions) {
      try {
        await access(promotion.backupPath);
        throw new Error(`Stale texture backup exists: ${promotion.backupPath}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    for (const promotion of promotions) {
      try {
        await rename(promotion.outputPath, promotion.backupPath);
        promotion.backupMoved = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await rename(promotion.candidatePath, promotion.outputPath);
      promotion.outputMoved = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const promotion of [...promotions].reverse()) {
      try {
        if (promotion.outputMoved) {
          await rm(promotion.outputPath, { force: true });
        }
        if (promotion.backupMoved) {
          await rename(promotion.backupPath, promotion.outputPath);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Texture promotion failed and rollback was incomplete",
      );
    }
    throw error;
  }

  for (const promotion of promotions) {
    if (!promotion.backupMoved) continue;
    try {
      await rm(promotion.backupPath, { force: true });
    } catch (error) {
      console.warn(
        `Rendered texture backup cleanup failed: ${promotion.backupPath}: ${error.message}`,
      );
    }
  }
}

export async function stageSourceTextures({
  root = process.cwd(),
  operationId = `${process.pid}-${randomUUID()}`,
} = {}) {
  const manifest = await loadSourceManifest({ root });
  const textureRoot = path.join(root, "assets/blender/textures");
  const capture = manifest.froggieCapture;
  const referencePath = path.join(root, capture.source);
  const [referenceBuffer, ...svgBuffers] = await Promise.all([
    readFile(referencePath),
    ...LEAGUE_SVG_NAMES.map((name) =>
      readFile(path.join(textureRoot, `${name}.svg`))),
  ]);
  for (let index = 0; index < LEAGUE_SVG_NAMES.length; index += 1) {
    validateOwnedLeagueSvg(LEAGUE_SVG_NAMES[index], svgBuffers[index]);
  }
  const referenceSha256 = sha256Buffer(referenceBuffer);
  if (
    referenceBuffer.length !== capture.bytes ||
    referenceSha256 !== capture.sha256
  ) {
    throw new Error(
      "Froggie gameplay reference does not match the reviewed bytes/SHA-256 in assets/scene-sources.json.",
    );
  }
  await mkdir(textureRoot, { recursive: true });
  const outputs = [
    ...LEAGUE_SVG_NAMES.map((name) => ({
      key: name,
      outputPath: path.join(textureRoot, `${name}.png`),
      relativePath: path.relative(
        root,
        path.join(textureRoot, `${name}.png`),
      ).replaceAll("\\", "/"),
      candidatePath: path.join(textureRoot, `.${name}.${operationId}.next.png`),
    })),
    {
      key: "FroggieGameplay",
      outputPath: path.join(root, capture.output.path),
      relativePath: capture.output.path,
      candidatePath: `${path.join(root, capture.output.path)}.${operationId}.next.png`,
    },
  ];

  try {
    await Promise.all([
      ...LEAGUE_SVG_NAMES.map((name, index) =>
        sharp(svgBuffers[index], { density: 96 })
          .resize(1024, 576, { fit: "fill" })
          .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
          .toFile(outputs[index].candidatePath)),
      sharp(referenceBuffer)
        .extract(capture.crop)
        .resize(capture.output.width, capture.output.height, {
          fit: capture.output.fit,
          position: "center",
          background: capture.output.background,
          kernel: sharp.kernel.lanczos3,
        })
        .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
        .toFile(outputs.at(-1).candidatePath),
    ]);

    const generated = {};
    for (const output of outputs) {
      generated[output.key] = {
        path: output.relativePath,
        sha256: await sha256File(output.candidatePath),
      };
    }
    let cleaned = false;
    return {
      candidates: outputs,
      cleanup: async () => {
        if (cleaned) return;
        cleaned = true;
        for (const output of outputs) {
          await rm(output.candidatePath, { force: true });
        }
      },
      generated,
      operationId,
    };
  } catch (error) {
    for (const output of outputs) {
      await rm(output.candidatePath, { force: true });
    }
    throw error;
  }
}

export async function renderSourceTextures({ root = process.cwd() } = {}) {
  const staged = await stageSourceTextures({ root });
  try {
    await promoteRenderedTextures(staged.candidates, staged.operationId);
    return staged.generated;
  } finally {
    await staged.cleanup();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await renderSourceTextures();
    console.log("source textures rendered");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
