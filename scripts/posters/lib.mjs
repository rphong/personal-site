import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const POSTER_RENDER_INPUT_PATHS = [
  "app/globals.css",
  "app/layout.tsx",
  "app/scene-capture/capture-policy.ts",
  "app/scene-capture/loading.tsx",
  "app/scene-capture/page.tsx",
  "app/scene-capture/scene-capture-viewport.tsx",
  "app/three/adjacent-scene-preloader.tsx",
  "app/three/authored-ground-shadow.tsx",
  "app/three/normalized-scene-root.tsx",
  "app/three/rotation.ts",
  "app/three/runtime-events.ts",
  "app/three/scene-error-boundary.tsx",
  "app/three/scene-poster.tsx",
  "app/three/scene-preload-policy.ts",
  "app/three/scene-resource-cache.ts",
  "app/three/scene-resources.ts",
  "app/three/scene-rotation-area.tsx",
  "app/three/scene-section.tsx",
  "app/three/scene-canvas-boundary.tsx",
  "app/three/scene-canvas.tsx",
  "app/three/scene-loader.ts",
  "app/three/scene-model.tsx",
  "app/three/scene-provider.tsx",
  "app/three/scene-registry.ts",
  "app/three/scene-runtime-host.tsx",
  "app/three/scene-runtime-boundary.tsx",
  "app/three/scene-runtime-context.tsx",
  "app/three/scene-runtime.css",
  "app/three/three-preference-toggle.tsx",
  "app/three/three-preference.ts",
  "app/three/types.ts",
  "assets/poster-contract.json",
  "assets/poster-sources/eog.svg",
  "assets/poster-sources/paycom.svg",
  "build/sites-vite-plugin.ts",
  "components/site-footer.tsx",
  "components/site-nav.tsx",
  "components/site-shell.tsx",
  "content/site-content.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "public/models/assets-manifest.json",
  "scripts/posters/browser.mjs",
  "scripts/posters/capture.mjs",
  "scripts/posters/lib.mjs",
  "scripts/posters/pipeline.mjs",
  "scripts/run-vinext.mjs",
  "tests/browser/poster-capture.spec.ts",
  "vite.config.ts",
];

const TEXT_INPUT_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".mjs",
  ".mts",
  ".svg",
  ".ts",
  ".tsx",
]);

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodePoints)
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function stringifyCanonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalJsonSha256(value) {
  const parsed =
    typeof value === "string" || value instanceof Uint8Array
      ? JSON.parse(Buffer.from(value).toString("utf8"))
      : value;
  return sha256Buffer(Buffer.from(stringifyCanonicalJson(parsed)));
}

export async function pinnedPlaywrightChromiumVersion() {
  const playwrightTestPackage = fileURLToPath(
    import.meta.resolve("@playwright/test/package.json"),
  );
  const playwrightTestRequire = createRequire(playwrightTestPackage);
  const playwrightPackage = playwrightTestRequire.resolve(
    "playwright/package.json",
  );
  const playwrightRequire = createRequire(playwrightPackage);
  const playwrightCorePackage = playwrightRequire.resolve(
    "playwright-core/package.json",
  );
  const browserMetadata = JSON.parse(
    await readFile(path.join(path.dirname(playwrightCorePackage), "browsers.json"), "utf8"),
  );
  const chromium = browserMetadata.browsers?.find(
    (browser) => browser.name === "chromium",
  );
  if (!/^\d+(?:\.\d+){3}$/.test(chromium?.browserVersion ?? "")) {
    throw new Error("Pinned Playwright Chromium metadata is invalid");
  }
  return chromium.browserVersion;
}

export function normalizePosterRenderInput(relativePath, contents) {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === ".json") {
    return Buffer.from(
      stringifyCanonicalJson(JSON.parse(Buffer.from(contents).toString("utf8"))),
    );
  }
  if (TEXT_INPUT_EXTENSIONS.has(extension)) {
    return Buffer.from(
      Buffer.from(contents).toString("utf8").replace(/\r\n?/g, "\n"),
    );
  }
  return Buffer.from(contents);
}

export async function posterRenderInputsSha256(root = process.cwd()) {
  const hash = createHash("sha256");
  for (const relativePath of POSTER_RENDER_INPUT_PATHS) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(
      normalizePosterRenderInput(
        relativePath,
        await readFile(path.join(root, relativePath)),
      ),
    );
    hash.update("\0");
  }

  const [contract, modelManifest] = await Promise.all([
    readFile(path.join(root, "assets/poster-contract.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(path.join(root, "public/models/assets-manifest.json"), "utf8").then(
      JSON.parse,
    ),
  ]);
  const modelKeys = [
    ...new Set(
      contract.scenes
        .filter((scene) => scene.source.kind === "web-scene")
        .map((scene) => scene.source.modelKey),
    ),
  ].sort(compareCodePoints);
  for (const modelKey of modelKeys) {
    const model = modelManifest.models[modelKey];
    if (!model?.url || !model?.sha256) {
      throw new Error(`Poster render model ${modelKey} is missing from the manifest`);
    }
    const relativePath = `public${model.url}`;
    const contents = await readFile(path.join(root, relativePath));
    if (sha256Buffer(contents) !== model.sha256) {
      throw new Error(`${relativePath}: model bytes drifted from assets-manifest.json`);
    }
    hash.update(relativePath);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function changedChannelRatio(left, right, tolerance = 4) {
  if (left.length !== right.length || left.length === 0) return 1;
  let changed = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index] - right[index]) > tolerance) changed += 1;
  }
  return changed / left.length;
}

export function buildPosterManifest({
  browserVersion,
  contractSha256,
  renderInputsSha256,
  posters,
  toolVersions,
}) {
  const normalizedPosters = posters.map((poster) => ({
    sceneId: poster.sceneId,
    variant: poster.variant,
    path: poster.path,
    width: poster.width,
    height: poster.height,
    bytes: poster.bytes,
    sha256: poster.sha256,
  }));
  return {
    schemaVersion: 1,
    contractSha256,
    renderInputsSha256,
    renderer: {
      browser: "chromium",
      browserVersion,
      swiftShader: true,
    },
    toolVersions: {
      playwright: toolVersions.playwright,
      sharp: toolVersions.sharp,
    },
    posters: normalizedPosters.sort(
      (left, right) =>
        compareCodePoints(left.sceneId, right.sceneId) ||
        compareCodePoints(left.variant, right.variant),
    ),
  };
}
