import { defineConfig } from "@playwright/test";

const serverPort = process.env.POSTER_CAPTURE_PORT ?? "3000";
const serverHostname = "127.0.0.1";
const serverUrl = `http://${serverHostname}:${serverPort}`;

export default defineConfig({
  testDir: "./tests/browser",
  snapshotPathTemplate:
    "{testDir}/visual-regression.spec.ts-snapshots/{arg}{ext}",
  testIgnore: process.env.POSTER_CAPTURE_MODE
    ? []
    : ["**/poster-capture.spec.ts"],
  fullyParallel: false,
  retries: process.env.POSTER_CAPTURE_MODE ? 0 : process.env.CI ? 2 : 0,
  use: {
    baseURL: serverUrl,
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: [
            "--enable-webgl",
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
          ],
        },
      },
    },
  ],
  webServer: {
    command: `node scripts/run-vinext.mjs dev --hostname ${serverHostname} --port ${serverPort}`,
    url: serverUrl,
    reuseExistingServer:
      process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1",
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_ENV: "preview",
      SCENE_CAPTURE: "1",
      SITE_ENV: "preview",
    },
  },
});
