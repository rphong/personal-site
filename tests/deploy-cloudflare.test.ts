import { describe, expect, it } from "vitest";

import {
  CLOUDFLARE_PRODUCTION_URL,
  createCloudflareDeploymentPlan,
} from "../scripts/deploy-cloudflare.mjs";

describe("Cloudflare deployment", () => {
  it("rebuilds for the public production origin before deploying", () => {
    const [build, deploy] = createCloudflareDeploymentPlan({
      cwd: "/workspace",
      env: {
        EXISTING_VALUE: "preserved",
        npm_execpath: "/tools/npm-cli.js",
      },
      nodeExecutable: "/tools/node",
    });

    expect(build.command).toBe("/tools/node");
    expect(build.args).toEqual([
      "/tools/npm-cli.js",
      "run",
      "build:production",
    ]);
    expect(deploy.command).toBe("/tools/node");
    expect(deploy.args).toEqual([
      "/tools/npm-cli.js",
      "exec",
      "--",
      "wrangler",
      "deploy",
      "--config",
      "dist/server/wrangler.json",
    ]);
    expect(build.options.env).toMatchObject({
      EXISTING_VALUE: "preserved",
      SCENE_CAPTURE: "0",
      SITE_ENV: "production",
      SITE_URL: CLOUDFLARE_PRODUCTION_URL,
    });
    expect(deploy.options.env).toBe(build.options.env);
  });

  it("forwards optional Wrangler deploy arguments", () => {
    const [, deploy] = createCloudflareDeploymentPlan({
      env: { npm_execpath: "C:\\tools\\npm-cli.js" },
      forwarded: ["--dry-run", "--outdir", ".tmp/cloudflare-dry-run"],
      nodeExecutable: "C:\\tools\\node.exe",
    });

    expect(deploy.command).toBe("C:\\tools\\node.exe");
    expect(deploy.args.slice(-3)).toEqual([
      "--dry-run",
      "--outdir",
      ".tmp/cloudflare-dry-run",
    ]);
  });
});
