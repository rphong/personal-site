import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  collectProductionConfigErrors,
  requiredPublicAssets,
} from "../lib/production-validation";

describe("runtime production validation wiring", () => {
  it("accepts a complete production configuration", () => {
    expect(
      collectProductionConfigErrors({
        SITE_ENV: "production",
        SITE_URL: "https://richardphong.example",
      }),
    ).toEqual([]);
  });

  it("requires both final manifests and every canonical poster", async () => {
    const contract = JSON.parse(
      await readFile("assets/poster-contract.json", "utf8"),
    ) as {
      scenes: readonly {
        outputs: Readonly<Record<"desktop" | "mobile", string>>;
      }[];
    };
    const outputs = contract.scenes
      .flatMap((scene) => [scene.outputs.desktop, scene.outputs.mobile])
      .sort();

    expect(requiredPublicAssets).toContain("public/models/assets-manifest.json");
    expect(requiredPublicAssets).toContain(
      "public/posters/poster-manifest.json",
    );
    expect(
      requiredPublicAssets
        .filter((asset) => asset.endsWith(".webp"))
        .sort(),
    ).toEqual(outputs);
    expect(
      requiredPublicAssets.some((asset) => asset.endsWith("-reference.png")),
    ).toBe(false);
  });

  it("makes production validation await the final manifest validator", async () => {
    const source = await readFile("scripts/validate-production.ts", "utf8");
    expect(source).toContain(
      'import { validateAll } from "./assets/validate.mjs"',
    );
    expect(source).toContain(
      "await validateAll({ root, requirePosters: true })",
    );
    expect(source).not.toContain("FOUNDATION_PREVIEW_ONLY_MESSAGE");
  });
});
