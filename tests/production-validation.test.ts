import { describe, expect, it } from "vitest";
import {
  collectProductionConfigErrors,
  requiredPublicAssets,
} from "../lib/production-validation";

describe("production validation", () => {
  it("rejects a preview", () => {
    expect(collectProductionConfigErrors({})).toEqual([
      "SITE_ENV must equal production for a production release.",
    ]);
  });

  it("passes a valid production configuration", () => {
    expect(
      collectProductionConfigErrors({
        SITE_ENV: "production",
        SITE_URL: "https://richardphong.example",
      }),
    ).toEqual([]);
  });

  it("reports an invalid production origin", () => {
    expect(
      collectProductionConfigErrors({
        SITE_ENV: "production",
        SITE_URL: "http://richardphong.example/path",
      }),
    ).toEqual(["Production SITE_URL must use https."]);
  });

  it("requires final manifests, social card, and all canonical posters", () => {
    expect(requiredPublicAssets).toHaveLength(24);
    expect(
      requiredPublicAssets.filter((asset) => asset.endsWith(".webp")),
    ).toHaveLength(20);
    expect(requiredPublicAssets).toContain(
      "public/models/assets-manifest.json",
    );
    expect(requiredPublicAssets).toContain(
      "public/posters/poster-manifest.json",
    );
    expect(requiredPublicAssets).toContain("public/og.png");
  });
});
