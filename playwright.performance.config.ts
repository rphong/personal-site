import { defineConfig } from "@playwright/test";

const serverPort = process.env.PERFORMANCE_PORT ?? "3100";
const inspectorPort = process.env.PERFORMANCE_INSPECTOR_PORT ?? "9232";
const serverUrl = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/performance",
  use: {
    baseURL: serverUrl,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium-production",
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
    // Exercise the generated Worker and asset binding used by the hosted site.
    // This also avoids Vinext 0.0.50's Windows-only static-cache path bug.
    command: `wrangler dev --config dist/server/wrangler.json --ip 127.0.0.1 --port ${serverPort} --inspector-port ${inspectorPort}`,
    url: serverUrl,
    reuseExistingServer: process.env.PERFORMANCE_EXTERNAL_SERVER === "1",
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_ENV: "preview",
      SITE_ENV: "preview",
    },
  },
});
