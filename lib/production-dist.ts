import { readFile } from "node:fs/promises";
import path from "node:path";

type WranglerConfig = {
  readonly observability?: {
    readonly enabled?: boolean;
    readonly logs?: {
      readonly enabled?: boolean;
      readonly invocation_logs?: boolean;
    };
    readonly traces?: {
      readonly enabled?: boolean;
    };
  };
  readonly vars?: Record<string, unknown>;
};

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function collectProductionDistErrors(
  root = process.cwd(),
  expectedSiteUrl = process.env.SITE_URL,
): Promise<string[]> {
  const errors: string[] = [];
  const serverEntry = path.join(root, "dist/server/index.js");
  const wranglerPath = path.join(root, "dist/server/wrangler.json");
  const sourceHostingPath = path.join(root, ".openai/hosting.json");
  const distHostingPath = path.join(root, "dist/.openai/hosting.json");

  try {
    await readFile(serverEntry);
  } catch {
    errors.push("Production Worker output is missing: dist/server/index.js.");
  }

  let wrangler: WranglerConfig | undefined;
  try {
    wrangler = (await readJson(wranglerPath)) as WranglerConfig;
  } catch {
    errors.push(
      "Production Worker configuration is missing or invalid: dist/server/wrangler.json.",
    );
  }

  if (wrangler) {
    if (wrangler.vars?.SITE_ENV !== "production") {
      errors.push("Built Worker SITE_ENV must equal production.");
    }
    if (wrangler.vars?.SCENE_CAPTURE !== "0") {
      errors.push("Built Worker SCENE_CAPTURE must equal 0.");
    }
    if (!expectedSiteUrl || wrangler.vars?.SITE_URL !== expectedSiteUrl) {
      errors.push("Built Worker SITE_URL must match the validated SITE_URL.");
    }
    if (
      wrangler.observability?.enabled !== true ||
      wrangler.observability.logs?.enabled !== true ||
      wrangler.observability.logs.invocation_logs !== false ||
      wrangler.observability.traces?.enabled !== false
    ) {
      errors.push("Built Worker observability settings do not match the release policy.");
    }
  }

  try {
    const [sourceHosting, distHosting] = await Promise.all([
      readJson(sourceHostingPath),
      readJson(distHostingPath),
    ]);
    if (JSON.stringify(sourceHosting) !== JSON.stringify(distHosting)) {
      errors.push(
        "Built Sites metadata does not match the source .openai/hosting.json.",
      );
    }
  } catch {
    errors.push("Built Sites metadata is missing or invalid.");
  }

  return errors;
}
