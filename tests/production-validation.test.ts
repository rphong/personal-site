import { describe, expect, it } from "vitest";
import { OWNER_INPUT_SENTINEL } from "../content/site-content";
import {
  collectProductionConfigErrors,
  requiredPublicAssets,
} from "../lib/production-validation";

const completedOwnerFields = {
  nonWorkInterest: "I spend time on a specific activity Richard has approved.",
  technicalCuriosity:
    "I am exploring a technical curiosity Richard has approved.",
};

const unresolvedOwnerFields = {
  nonWorkInterest: `${OWNER_INPUT_SENTINEL} home.nonWorkInterest`,
  technicalCuriosity:
    `${OWNER_INPUT_SENTINEL} home.technicalCuriosity`,
};

describe("production validation", () => {
  it("rejects a preview and owner-gated copy", () => {
    expect(collectProductionConfigErrors({}, unresolvedOwnerFields)).toEqual([
      "SITE_ENV must equal production for a production release.",
      "Owner copy is still gated: home.nonWorkInterest.",
      "Owner copy is still gated: home.technicalCuriosity.",
    ]);
  });

  it("passes config and copy once their explicit inputs resolve", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "https://richardphong.example",
        },
        completedOwnerFields,
      ),
    ).toEqual([]);
  });

  it("reports an invalid production origin", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "http://richardphong.example/path",
        },
        completedOwnerFields,
      ),
    ).toEqual(["Production SITE_URL must use https."]);
  });

  it("requires final manifests and all twenty canonical posters", () => {
    expect(requiredPublicAssets).toHaveLength(23);
    expect(
      requiredPublicAssets.filter((asset) => asset.endsWith(".webp")),
    ).toHaveLength(20);
    expect(requiredPublicAssets).toContain(
      "public/models/assets-manifest.json",
    );
    expect(requiredPublicAssets).toContain(
      "public/posters/poster-manifest.json",
    );
  });
});
