import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  snapshotPathTemplate:
    "{testDir}/visual-regression.spec.ts-snapshots/{arg}{ext}",
  testIgnore: process.env.POSTER_CAPTURE_MODE
    ? []
    : ["**/poster-capture.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
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
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
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
