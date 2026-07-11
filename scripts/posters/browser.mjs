import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
const result = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.signal) throw new Error(`Browser install was terminated by ${result.signal}`);
process.exitCode = result.status ?? 1;
