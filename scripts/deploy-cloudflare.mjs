import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLOUDFLARE_PRODUCTION_URL =
  "https://personal-site.richard-phong424.workers.dev";

/**
 * @typedef {object} CloudflareDeploymentOptions
 * @property {string} [cwd]
 * @property {Record<string, string | undefined>} [env]
 * @property {string[]} [forwarded]
 * @property {string} [nodeExecutable]
 */

/** @param {CloudflareDeploymentOptions} [options] */
export function createCloudflareDeploymentPlan({
  cwd = process.cwd(),
  env = process.env,
  forwarded = [],
  nodeExecutable = process.execPath,
} = /** @type {CloudflareDeploymentOptions} */ ({})) {
  if (
    !Array.isArray(forwarded) ||
    forwarded.some((value) => typeof value !== "string")
  ) {
    throw new TypeError("Forwarded Wrangler arguments must be strings.");
  }

  const productionEnv = {
    ...env,
    SCENE_CAPTURE: "0",
    SITE_ENV: "production",
    SITE_URL: CLOUDFLARE_PRODUCTION_URL,
  };
  const options = {
    cwd,
    env: productionEnv,
    shell: false,
    stdio: "inherit",
  };
  const npmCli = env.npm_execpath;
  if (!npmCli) {
    throw new Error(
      "npm_execpath is unavailable; run this entrypoint through npm run deploy:cloudflare.",
    );
  }

  return [
    {
      args: [npmCli, "run", "build:production"],
      command: nodeExecutable,
      options,
    },
    {
      args: [
        npmCli,
        "exec",
        "--",
        "wrangler",
        "deploy",
        "--config",
        "dist/server/wrangler.json",
        ...forwarded,
      ],
      command: nodeExecutable,
      options,
    },
  ];
}

/** @param {CloudflareDeploymentOptions} [options] */
export function runCloudflareDeployment(options = {}) {
  for (const invocation of createCloudflareDeploymentPlan(options)) {
    const result = spawnSync(
      invocation.command,
      invocation.args,
      invocation.options,
    );

    if (result.error) {
      throw new Error(`Failed to launch ${invocation.command}.`, {
        cause: result.error,
      });
    }
    if (result.signal) {
      throw new Error(
        `${invocation.command} was terminated by ${result.signal}.`,
      );
    }
    if (!Number.isInteger(result.status)) {
      throw new Error(`${invocation.command} exited without a status code.`);
    }
    if (result.status !== 0) {
      return result.status;
    }
  }

  return 0;
}

function isDirectRun() {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  try {
    process.exitCode = runCloudflareDeployment({
      forwarded: process.argv.slice(2),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
