import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  buildPosterManifest,
  canonicalJsonSha256,
  changedChannelRatio,
  posterRenderInputsSha256,
  sha256Buffer,
} from "../../scripts/posters/lib.mjs";
import { posterOperationRoot } from "../../scripts/posters/pipeline.mjs";

type VariantName = "desktop" | "mobile";

interface PosterContract {
  readonly variants: Record<
    VariantName,
    {
      readonly viewportWidth: number;
      readonly viewportHeight: number;
      readonly deviceScaleFactor: number;
    }
  >;
  readonly scenes: readonly {
    readonly id: string;
    readonly background: string;
    readonly source:
      | { readonly kind: "web-scene"; readonly modelKey: string }
      | { readonly kind: "svg"; readonly path: string };
    readonly outputs: Record<VariantName, string>;
  }[];
}

interface PosterRecord {
  readonly sceneId: string;
  readonly variant: VariantName;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface PosterManifest {
  readonly posters: readonly PosterRecord[];
}

interface ReviewRecord extends PosterRecord {
  readonly backgroundMaxDelta: number;
  readonly changedChannelRatio: number;
  readonly foregroundBounds: ForegroundBounds;
  readonly foregroundRatio: number;
}

interface ForegroundBounds {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

const captureBaseUrl = `http://127.0.0.1:${process.env.POSTER_CAPTURE_PORT ?? "3000"}`;

function isVinextLocalFontDiagnostic(message: string) {
  return /^Not allowed to load local resource: file:\/\/\/.*\/\.vinext\/fonts\/.*\.woff2$/i.test(
    message,
  );
}

function rgbFromHex(hex: string): readonly [number, number, number] {
  const match = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid poster background ${hex}`);
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

async function decodedPixels(input: Buffer | string) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function inspectPixels(
  pixels: Buffer,
  width: number,
  height: number,
  background: readonly [number, number, number],
) {
  let foreground = 0;
  let backgroundMaxDelta = 0;
  let minimumAlpha = 255;
  let minimumForegroundX = width;
  let minimumForegroundY = height;
  let maximumForegroundX = -1;
  let maximumForegroundY = -1;
  const cornerSize = Math.min(16, width, height);
  const cornerXs = [0, width - cornerSize];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const delta = Math.max(
        Math.abs(pixels[offset] - background[0]),
        Math.abs(pixels[offset + 1] - background[1]),
        Math.abs(pixels[offset + 2] - background[2]),
      );
      if (delta > 12) {
        foreground += 1;
        minimumForegroundX = Math.min(minimumForegroundX, x);
        minimumForegroundY = Math.min(minimumForegroundY, y);
        maximumForegroundX = Math.max(maximumForegroundX, x);
        maximumForegroundY = Math.max(maximumForegroundY, y);
      }
      minimumAlpha = Math.min(minimumAlpha, pixels[offset + 3]);
      if (y < cornerSize && cornerXs.some((start) => x >= start && x < start + cornerSize)) {
        backgroundMaxDelta = Math.max(backgroundMaxDelta, delta);
      }
    }
  }

  return {
    backgroundMaxDelta,
    foregroundBounds: {
      bottom: height - 1 - maximumForegroundY,
      left: minimumForegroundX,
      right: width - 1 - maximumForegroundX,
      top: minimumForegroundY,
    },
    foregroundRatio: foreground / (width * height),
    minimumAlpha,
  };
}

async function writeDiff(
  source: Awaited<ReturnType<typeof decodedPixels>>,
  encoded: Awaited<ReturnType<typeof decodedPixels>>,
  outputPath: string,
) {
  const difference = Buffer.alloc(source.data.length);
  for (let index = 0; index < difference.length; index += 4) {
    difference[index] = Math.min(
      255,
      Math.abs(source.data[index] - encoded.data[index]) * 8,
    );
    difference[index + 1] = Math.min(
      255,
      Math.abs(source.data[index + 1] - encoded.data[index + 1]) * 8,
    );
    difference[index + 2] = Math.min(
      255,
      Math.abs(source.data[index + 2] - encoded.data[index + 2]) * 8,
    );
    difference[index + 3] = 255;
  }
  await sharp(difference, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);
}

function labelSvg(label: string, width: number, height: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#282828"/><text x="10" y="18" fill="#fff" font-family="Arial,sans-serif" font-size="13">${label}</text></svg>`,
  );
}

async function writeContactSheet({
  candidateRoot,
  contract,
  reviewRoot,
  variant,
}: {
  readonly candidateRoot: string;
  readonly contract: PosterContract;
  readonly reviewRoot: string;
  readonly variant: VariantName;
}) {
  const columns = variant === "desktop" ? 2 : 5;
  const imageWidth = variant === "desktop" ? 480 : 176;
  const imageHeight = variant === "desktop" ? 270 : 381;
  const labelHeight = 26;
  const rows = Math.ceil(contract.scenes.length / columns);
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (const [index, scene] of contract.scenes.entries()) {
    const left = (index % columns) * imageWidth;
    const top = Math.floor(index / columns) * (imageHeight + labelHeight);
    const poster = await sharp(
      path.join(candidateRoot, path.basename(scene.outputs[variant])),
    )
      .resize(imageWidth, imageHeight, { fit: "fill" })
      .png()
      .toBuffer();
    composites.push({ input: poster, left, top });
    composites.push({
      input: labelSvg(`${scene.id} / ${variant}`, imageWidth, labelHeight),
      left,
      top: top + imageHeight,
    });
  }

  await sharp({
    create: {
      width: columns * imageWidth,
      height: rows * (imageHeight + labelHeight),
      channels: 3,
      background: "#505050",
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(reviewRoot, `contact-sheet-${variant}.png`));
}

test("captures every poster contract output deterministically", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const mode = process.env.POSTER_CAPTURE_MODE;
  if (mode !== "write" && mode !== "check") {
    throw new Error("POSTER_CAPTURE_MODE must be write or check");
  }
  const operationId = process.env.POSTER_OPERATION_ID;
  if (!operationId) throw new Error("POSTER_OPERATION_ID is required");

  const root = process.cwd();
  const operationRoot = posterOperationRoot({ root, operationId });
  const candidateRoot = path.join(operationRoot, "candidates");
  const reviewRoot = path.join(root, "tmp/posters-review");
  await rm(reviewRoot, { force: true, recursive: true });
  await Promise.all([
    mkdir(candidateRoot, { recursive: true }),
    mkdir(reviewRoot, { recursive: true }),
  ]);

  const [contractBuffer, packageJson] = await Promise.all([
    readFile(path.join(root, "assets/poster-contract.json")),
    readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
  ]);
  const contract = JSON.parse(contractBuffer.toString("utf8")) as PosterContract;
  const committedManifest =
    mode === "check"
      ? (JSON.parse(
          await readFile(
            path.join(root, "public/posters/poster-manifest.json"),
            "utf8",
          ),
        ) as PosterManifest)
      : null;
  const posters: PosterRecord[] = [];
  const reviewRecords: ReviewRecord[] = [];

  for (const scene of contract.scenes) {
    for (const variantName of ["desktop", "mobile"] as const) {
      const variant = contract.variants[variantName];
      const outputWidth = Math.round(
        variant.viewportWidth * variant.deviceScaleFactor,
      );
      const outputHeight = Math.round(
        variant.viewportHeight * variant.deviceScaleFactor,
      );
      let sourceBuffer: Buffer;

      if (scene.source.kind === "svg") {
        sourceBuffer = await sharp(path.join(root, scene.source.path))
          .resize(outputWidth, outputHeight, {
            fit: "cover",
            position: "centre",
          })
          .png()
          .toBuffer();
      } else {
        const context = await browser.newContext({
          baseURL: captureBaseUrl,
          viewport: {
            width: variant.viewportWidth,
            height: variant.viewportHeight,
          },
          deviceScaleFactor: variant.deviceScaleFactor,
          reducedMotion: "reduce",
        });
        try {
          const page = await context.newPage();
          const diagnostics: string[] = [];
          page.on("pageerror", (error) => {
            diagnostics.push(`pageerror: ${error.message}`);
          });
          page.on("console", (message) => {
            const text = message.text();
            if (
              message.type() === "error" &&
              !isVinextLocalFontDiagnostic(text)
            ) {
              diagnostics.push(`console: ${text}`);
            }
          });
          const captureFallback = await sharp({
            create: {
              width: 1,
              height: 1,
              channels: 3,
              background: scene.background,
            },
          })
            .webp({ lossless: true })
            .toBuffer();
          await page.route("**/posters/*.webp", (route) =>
            route.fulfill({
              body: captureFallback,
              contentType: "image/webp",
              status: 200,
            }),
          );
          const response = await page.goto(`/scene-capture?scene=${scene.id}`);
          expect(response?.status()).toBe(200);
          const host = page.getByTestId("scene-runtime-host");
          await expect(host).toHaveAttribute("data-active-scene-id", scene.id);
          await expect(host).toHaveAttribute("data-three-status", "ready", {
            timeout: 20_000,
          });
          const canvas = page.locator("canvas");
          await expect(canvas).toHaveCount(1);
          const canvasMetrics = await canvas.evaluate((element) => {
            const htmlCanvas = element as HTMLCanvasElement;
            const bounds = htmlCanvas.getBoundingClientRect();
            const context = htmlCanvas.getContext("webgl2");
            const debug = context?.getExtension("WEBGL_debug_renderer_info");
            return {
              cssWidth: bounds.width,
              cssHeight: bounds.height,
              pixelWidth: htmlCanvas.width,
              pixelHeight: htmlCanvas.height,
              renderer:
                context && debug
                  ? String(
                      context.getParameter(debug.UNMASKED_RENDERER_WEBGL),
                    )
                  : context
                    ? String(context.getParameter(context.RENDERER))
                    : "",
            };
          });
          expect(canvasMetrics).toEqual({
            cssWidth: variant.viewportWidth,
            cssHeight: variant.viewportHeight,
            pixelWidth: outputWidth,
            pixelHeight: outputHeight,
            renderer: expect.stringMatching(/swiftshader/i),
          });
          const viewportMetrics = await page.evaluate(() => ({
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
            scrollHeight: document.documentElement.scrollHeight,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          expect(viewportMetrics).toEqual({
            innerHeight: variant.viewportHeight,
            innerWidth: variant.viewportWidth,
            scrollHeight: variant.viewportHeight,
            scrollWidth: variant.viewportWidth,
          });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            );
          });
          const graphicsStatus = await canvas.evaluate((element) => {
            const context = (element as HTMLCanvasElement).getContext("webgl2");
            if (!context) throw new Error("Capture canvas lost its WebGL 2 context");
            context.finish();
            return { error: context.getError(), noError: context.NO_ERROR };
          });
          expect(graphicsStatus.error).toBe(graphicsStatus.noError);
          sourceBuffer = await page.screenshot({
            animations: "disabled",
            caret: "hide",
            fullPage: false,
            omitBackground: false,
            scale: "device",
            type: "png",
          });
          expect(diagnostics).toEqual([]);
        } finally {
          await context.close();
        }
      }

      const source = await decodedPixels(sourceBuffer);
      expect(source.info.width).toBe(outputWidth);
      expect(source.info.height).toBe(outputHeight);
      const webp = await sharp(sourceBuffer)
        .webp({
          quality: 90,
          alphaQuality: 100,
          effort: 6,
          smartSubsample: true,
        })
        .toBuffer();
      const canonicalRelativePath = scene.outputs[variantName].replaceAll(
        "\\",
        "/",
      );
      const candidatePath = path.join(
        candidateRoot,
        path.basename(canonicalRelativePath),
      );
      await writeFile(candidatePath, webp);
      const encoded = await decodedPixels(webp);
      const fileStats = await stat(candidatePath);
      expect(encoded.info.width).toBe(outputWidth);
      expect(encoded.info.height).toBe(outputHeight);

      const comparisonRatio = changedChannelRatio(source.data, encoded.data, 8);
      expect(
        comparisonRatio,
        `${scene.id}/${variantName} changed too much during WebP encoding`,
      ).toBeLessThanOrEqual(0.08);
      const inspection = inspectPixels(
        encoded.data,
        outputWidth,
        outputHeight,
        rgbFromHex(scene.background),
      );
      expect(inspection.minimumAlpha).toBe(255);
      expect(
        inspection.backgroundMaxDelta,
        `${scene.id}/${variantName} corner background drifted`,
      ).toBeLessThanOrEqual(8);
      expect(
        inspection.foregroundRatio,
        `${scene.id}/${variantName} has no visible focal content`,
      ).toBeGreaterThan(0.001);
      if (scene.source.kind === "web-scene") {
        const horizontalMargin =
          variantName === "desktop" ? Math.ceil(outputWidth * 0.01) : 0;
        const verticalMargin = Math.ceil(
          outputHeight * (variantName === "desktop" ? 0.01 : 0.02),
        );
        for (const [edge, margin] of Object.entries(
          inspection.foregroundBounds,
        )) {
          const requiredMargin =
            edge === "left" || edge === "right"
              ? horizontalMargin
              : verticalMargin;
          expect(
            margin,
            `${scene.id}/${variantName} clips focal content at the ${edge} edge`,
          ).toBeGreaterThanOrEqual(requiredMargin);
        }
      }

      const candidateRecord: PosterRecord = {
        sceneId: scene.id,
        variant: variantName,
        path: canonicalRelativePath,
        width: outputWidth,
        height: outputHeight,
        bytes: fileStats.size,
        sha256: sha256Buffer(webp),
      };

      if (mode === "check") {
        const canonicalPath = path.join(root, canonicalRelativePath);
        const [canonical, canonicalBuffer] = await Promise.all([
          decodedPixels(canonicalPath),
          readFile(canonicalPath),
        ]);
        expect({
          width: encoded.info.width,
          height: encoded.info.height,
          channels: encoded.info.channels,
        }).toEqual({
          width: canonical.info.width,
          height: canonical.info.height,
          channels: canonical.info.channels,
        });
        expect(
          changedChannelRatio(encoded.data, canonical.data, 4),
          `${scene.id}/${variantName} exceeded the 0.1% changed-channel gate`,
        ).toBeLessThanOrEqual(0.001);
        const committedRecord = committedManifest?.posters.find(
          (poster) =>
            poster.sceneId === scene.id && poster.variant === variantName,
        );
        expect(committedRecord).toEqual({
          sceneId: scene.id,
          variant: variantName,
          path: canonicalRelativePath,
          width: canonical.info.width,
          height: canonical.info.height,
          bytes: canonicalBuffer.byteLength,
          sha256: sha256Buffer(canonicalBuffer),
        });
        posters.push(committedRecord!);
      } else {
        posters.push(candidateRecord);
      }

      const reviewBase = `${scene.id}-${variantName}`;
      await Promise.all([
        writeFile(path.join(reviewRoot, `${reviewBase}-source.png`), sourceBuffer),
        writeFile(path.join(reviewRoot, `${reviewBase}.webp`), webp),
        writeDiff(
          source,
          encoded,
          path.join(reviewRoot, `${reviewBase}-diff.png`),
        ),
      ]);
      reviewRecords.push({
        ...candidateRecord,
        backgroundMaxDelta: inspection.backgroundMaxDelta,
        changedChannelRatio: comparisonRatio,
        foregroundBounds: inspection.foregroundBounds,
        foregroundRatio: inspection.foregroundRatio,
      });
    }
  }

  const manifest = buildPosterManifest({
    browserVersion: browser.version(),
    contractSha256: canonicalJsonSha256(contractBuffer),
    renderInputsSha256: await posterRenderInputsSha256(root),
    posters,
    toolVersions: {
      playwright: packageJson.devDependencies["@playwright/test"],
      sharp: packageJson.devDependencies.sharp,
    },
  });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(
    path.join(candidateRoot, "poster-manifest.json"),
    serialized,
  );

  if (mode === "check") {
    expect(
      await readFile(
        path.join(root, "public/posters/poster-manifest.json"),
        "utf8",
      ),
    ).toBe(serialized);
  }

  await Promise.all([
    writeFile(
      path.join(reviewRoot, "review-metrics.json"),
      `${JSON.stringify(reviewRecords, null, 2)}\n`,
    ),
    writeContactSheet({ candidateRoot, contract, reviewRoot, variant: "desktop" }),
    writeContactSheet({ candidateRoot, contract, reviewRoot, variant: "mobile" }),
  ]);
});
