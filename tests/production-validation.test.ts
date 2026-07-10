import { describe, expect, it } from "vitest";
import { OWNER_INPUT_SENTINEL } from "../content/site-content";
import {
  FOUNDATION_PREVIEW_ONLY_MESSAGE,
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
  it("rejects a preview, owner-gated copy, and the foundation asset phase", () => {
    expect(collectProductionConfigErrors({}, unresolvedOwnerFields)).toEqual([
      "SITE_ENV must equal production for a production release.",
      "Owner copy is still gated: home.nonWorkInterest.",
      "Owner copy is still gated: home.technicalCuriosity.",
      FOUNDATION_PREVIEW_ONLY_MESSAGE,
    ]);
  });

  it("leaves only the explicit asset-phase gate after config and copy resolve", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "https://richardphong.example",
        },
        completedOwnerFields,
      ),
    ).toEqual([FOUNDATION_PREVIEW_ONLY_MESSAGE]);
  });

  it("reports invalid production origins without losing other gates", () => {
    expect(
      collectProductionConfigErrors(
        {
          SITE_ENV: "production",
          SITE_URL: "http://richardphong.example/path",
        },
        completedOwnerFields,
      ),
    ).toEqual([
      "Production SITE_URL must use https.",
      FOUNDATION_PREVIEW_ONLY_MESSAGE,
    ]);
  });

  it("checks every foundation public artifact", () => {
    expect(requiredPublicAssets).toEqual([
      "public/Richard-Phong-Resume.pdf",
      "public/posters/home-reference.png",
      "public/posters/experience-reference.png",
      "public/posters/projects-reference.png",
      "public/posters/contact-reference.png",
      "public/images/froggie-gameplay.png",
    ]);
  });
});
