import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectProductionDistErrors } from "../lib/production-dist";

const temporaryRoots: string[] = [];

async function createFixture({
  headSamplingRate = 1,
  sceneCapture = "0",
  siteEnv = "production",
  siteUrl = "https://richard.example",
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "personal-site-dist-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, ".openai"), { recursive: true });
  await mkdir(path.join(root, "dist/.openai"), { recursive: true });
  await mkdir(path.join(root, "dist/server"), { recursive: true });

  const hosting = { project_id: "site-project", d1: null, r2: null };
  const wrangler = {
    vars: {
      SCENE_CAPTURE: sceneCapture,
      SITE_ENV: siteEnv,
      SITE_URL: siteUrl,
    },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        head_sampling_rate: headSamplingRate,
        invocation_logs: false,
      },
      traces: { enabled: false },
    },
  };

  await Promise.all([
    writeFile(
      path.join(root, ".openai/hosting.json"),
      JSON.stringify(hosting),
    ),
    writeFile(
      path.join(root, "dist/.openai/hosting.json"),
      JSON.stringify(hosting),
    ),
    writeFile(path.join(root, "dist/server/index.js"), "export default {};"),
    writeFile(
      path.join(root, "dist/server/wrangler.json"),
      JSON.stringify(wrangler),
    ),
  ]);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("production artifact verification", () => {
  it("accepts a complete production artifact", async () => {
    const root = await createFixture();
    await expect(
      collectProductionDistErrors(root, "https://richard.example"),
    ).resolves.toEqual([]);
  });

  it("rejects preview and scene-capture builds", async () => {
    const root = await createFixture({
      siteEnv: "preview",
      sceneCapture: "1",
    });
    await expect(
      collectProductionDistErrors(root, "https://richard.example"),
    ).resolves.toEqual(
      expect.arrayContaining([
        "Built Worker SITE_ENV must equal production.",
        "Built Worker SCENE_CAPTURE must equal 0.",
      ]),
    );
  });

  it("rejects a mismatched production origin", async () => {
    const root = await createFixture();
    await expect(
      collectProductionDistErrors(root, "https://different.example"),
    ).resolves.toContain(
      "Built Worker SITE_URL must match the validated SITE_URL.",
    );
  });

  it("rejects reduced observability sampling", async () => {
    const root = await createFixture({ headSamplingRate: 0.5 });
    await expect(
      collectProductionDistErrors(root, "https://richard.example"),
    ).resolves.toContain(
      "Built Worker observability settings do not match the release policy.",
    );
  });
});
