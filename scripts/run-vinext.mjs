import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_MODES = new Set(["build", "dev", "start"]);

function resolveVinextCli() {
  const entryPath = fileURLToPath(import.meta.resolve("vinext"));
  return path.join(path.dirname(entryPath), "cli.js");
}

export function createVinextInvocation({
  cwd = process.cwd(),
  env = process.env,
  forwarded = [],
  mode,
} = {}) {
  if (!SUPPORTED_MODES.has(mode)) {
    throw new TypeError(
      `Unsupported Vinext mode ${JSON.stringify(mode)}; expected dev, build, or start.`,
    );
  }
  if (!Array.isArray(forwarded) || forwarded.some((value) => typeof value !== "string")) {
    throw new TypeError("Forwarded Vinext arguments must be an array of strings.");
  }

  return {
    command: process.execPath,
    args: [resolveVinextCli(), mode, ...forwarded],
    options: {
      cwd,
      env: {
        ...env,
        WRANGLER_LOG_PATH: path.join(cwd, ".wrangler/wrangler.log"),
      },
      shell: false,
      stdio: "inherit",
    },
  };
}

export function runVinext(options = {}) {
  const invocation = createVinextInvocation(options);
  const result = spawnSync(
    invocation.command,
    invocation.args,
    invocation.options,
  );

  if (result.error) {
    throw new Error("Failed to launch the local Vinext CLI.", {
      cause: result.error,
    });
  }
  if (result.signal) {
    throw new Error(`The local Vinext CLI was terminated by ${result.signal}.`);
  }
  if (!Number.isInteger(result.status)) {
    throw new Error("The local Vinext CLI exited without a status code.");
  }

  return result.status;
}

function isDirectRun() {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  try {
    process.exitCode = runVinext({
      forwarded: process.argv.slice(3),
      mode: process.argv[2],
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
