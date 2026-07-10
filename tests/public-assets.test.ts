import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const expectedAssets = [
  {
    relativePath: "public/Richard-Phong-Resume.pdf",
    bytes: 133_744,
    sha256: "6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e",
  },
  {
    relativePath: "public/posters/home-reference.png",
    bytes: 323_621,
    sha256: "a986f7f511252b521e79bc623274093845a244d67e636accd62f9d84672fd8a6",
  },
  {
    relativePath: "public/posters/experience-reference.png",
    bytes: 804_876,
    sha256: "d46c5f6d72c6087cb0f4e632bcf50aa41239415aba398682443f8e777e1f47ad",
  },
  {
    relativePath: "public/posters/projects-reference.png",
    bytes: 1_027_631,
    sha256: "5da147a96636afb90d174b2c47a53289ae2530055c95bbcf8c9968daae1d3689",
  },
  {
    relativePath: "public/posters/contact-reference.png",
    bytes: 273_901,
    sha256: "759d9c87f7d5eb92dacc9c8e1d03d9ed1ee27ba0f9cdab64e5474b604381d8d2",
  },
  {
    relativePath: "public/images/froggie-gameplay.png",
    bytes: 2_337_398,
    sha256: "64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613",
  },
] as const;

describe("public foundation assets", () => {
  it.each(expectedAssets)(
    "copies $relativePath without changing bytes",
    async ({ relativePath, bytes, sha256 }) => {
      const absolutePath = path.join(root, relativePath);
      const [contents, metadata] = await Promise.all([
        readFile(absolutePath),
        stat(absolutePath),
      ]);

      expect(metadata.size).toBe(bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(sha256);
    },
  );
});
