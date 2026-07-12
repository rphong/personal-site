import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  canonicalJsonSha256,
  posterRenderInputsSha256,
} from "../scripts/posters/lib.mjs";

const root = process.cwd();

const immutableAssets = [
  {
    relativePath: "public/Richard-Phong-Resume.pdf",
    bytes: 133_744,
    sha256: "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e",
  },
] as const;

const sourceReferences = [
  {
    relativePath: "ReferenceImages/Main Page - Mint.png",
    bytes: 323_621,
    sha256: "a986f7f511252b521e79bc623274093845a244d67e636accd62f9d84672fd8a6",
  },
  {
    relativePath: "ReferenceImages/Experience - Pink.png",
    bytes: 804_876,
    sha256: "d46c5f6d72c6087cb0f4e632bcf50aa41239415aba398682443f8e777e1f47ad",
  },
  {
    relativePath: "ReferenceImages/Projects - Blue.png",
    bytes: 1_027_631,
    sha256: "5da147a96636afb90d174b2c47a53289ae2530055c95bbcf8c9968daae1d3689",
  },
  {
    relativePath: "ReferenceImages/Experience - Purple.png",
    bytes: 273_901,
    sha256: "759d9c87f7d5eb92dacc9c8e1d03d9ed1ee27ba0f9cdab64e5474b604381d8d2",
  },
  {
    relativePath: "ReferenceImages/Froggie Gameplay.png",
    bytes: 2_337_398,
    sha256: "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613",
  },
] as const;

const variants = ["desktop", "mobile"] as const;
type PosterVariant = (typeof variants)[number];

interface PosterContract {
  readonly variants: Readonly<
    Record<
      PosterVariant,
      {
        readonly viewportWidth: number;
        readonly viewportHeight: number;
        readonly deviceScaleFactor: number;
      }
    >
  >;
  readonly scenes: readonly {
    readonly id: string;
    readonly outputs: Readonly<Record<PosterVariant, string>>;
  }[];
}

interface PosterManifest {
  readonly contractSha256: string;
  readonly renderInputsSha256: string;
  readonly posters: readonly {
    readonly sceneId: string;
    readonly variant: PosterVariant;
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly width: number;
    readonly height: number;
  }[];
}

function absolutePath(relativePath: string): string {
  return path.join(root, relativePath);
}

describe("final public assets", () => {
  it.each(immutableAssets)(
    "preserves $relativePath byte-for-byte",
    async ({ relativePath, bytes, sha256 }) => {
      const contents = await readFile(absolutePath(relativePath));

      expect(contents.byteLength).toBe(bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(sha256);
    },
  );

  it.each(sourceReferences)(
    "preserves non-public source reference $relativePath",
    async ({ relativePath, bytes, sha256 }) => {
      const contents = await readFile(absolutePath(relativePath));

      expect(contents.byteLength).toBe(bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(sha256);
    },
  );

  it("matches every poster contract output to the committed manifest", async () => {
    const [contractBuffer, manifestSource] = await Promise.all([
      readFile(absolutePath("assets/poster-contract.json")),
      readFile(absolutePath("public/posters/poster-manifest.json"), "utf8"),
    ]);
    const contract = JSON.parse(
      contractBuffer.toString("utf8"),
    ) as PosterContract;
    const manifest = JSON.parse(manifestSource) as PosterManifest;

    expect(manifest.contractSha256).toBe(canonicalJsonSha256(contract));
    expect(manifest.renderInputsSha256).toBe(
      await posterRenderInputsSha256(root),
    );

    const expectedPosters = contract.scenes
      .flatMap((scene) =>
        variants.map((variant) => ({
          sceneId: scene.id,
          variant,
          path: scene.outputs[variant],
        })),
      )
      .sort((left, right) => left.path.localeCompare(right.path));
    const actualPosters = manifest.posters
      .map(({ sceneId, variant, path: posterPath }) => ({
        sceneId,
        variant,
        path: posterPath,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));

    expect(actualPosters).toEqual(expectedPosters);

    for (const poster of manifest.posters) {
      const [contents, metadata, file] = await Promise.all([
        readFile(absolutePath(poster.path)),
        sharp(absolutePath(poster.path)).metadata(),
        stat(absolutePath(poster.path)),
      ]);
      const variant = contract.variants[poster.variant];

      expect(file.size).toBe(poster.bytes);
      expect(contents.byteLength).toBe(poster.bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(
        poster.sha256,
      );
      expect(metadata.width).toBe(poster.width);
      expect(metadata.height).toBe(poster.height);
      expect(poster.width).toBe(
        variant.viewportWidth * variant.deviceScaleFactor,
      );
      expect(poster.height).toBe(
        variant.viewportHeight * variant.deviceScaleFactor,
      );
    }
  });

  it("does not publish retired full-frame or raw gameplay exports", async () => {
    const retiredPublicFiles = [
      "public/posters/home-reference.png",
      "public/posters/experience-reference.png",
      "public/posters/projects-reference.png",
      "public/posters/contact-reference.png",
      "public/images/froggie-gameplay.png",
    ] as const;

    for (const retiredPublicFile of retiredPublicFiles) {
      await expect(access(absolutePath(retiredPublicFile))).rejects.toThrow();
    }
  });
});
