import { access } from "node:fs/promises";
import path from "node:path";
import {
  resolveDeployment,
  type RuntimeEnvironment,
} from "./deployment";

export const requiredPublicAssets = [
  "public/Richard-Phong-Resume.pdf",
  "public/og.png",
  "public/models/assets-manifest.json",
  "public/posters/poster-manifest.json",
  "public/posters/home-hero-desktop.webp",
  "public/posters/home-hero-mobile.webp",
  "public/posters/experience-hero-desktop.webp",
  "public/posters/experience-hero-mobile.webp",
  "public/posters/experience-intro-desktop.webp",
  "public/posters/experience-intro-mobile.webp",
  "public/posters/nasa-rocket-desktop.webp",
  "public/posters/nasa-rocket-mobile.webp",
  "public/posters/eog-poster-desktop.webp",
  "public/posters/eog-poster-mobile.webp",
  "public/posters/paycom-poster-desktop.webp",
  "public/posters/paycom-poster-mobile.webp",
  "public/posters/projects-hero-desktop.webp",
  "public/posters/projects-hero-mobile.webp",
  "public/posters/league-ban-desktop.webp",
  "public/posters/league-ban-mobile.webp",
  "public/posters/froggie-adventures-desktop.webp",
  "public/posters/froggie-adventures-mobile.webp",
  "public/posters/contact-hero-desktop.webp",
  "public/posters/contact-hero-mobile.webp",
] as const;

export function collectProductionConfigErrors(
  env: RuntimeEnvironment,
): string[] {
  const errors: string[] = [];

  if (env.SITE_ENV !== "production") {
    errors.push("SITE_ENV must equal production for a production release.");
  } else {
    try {
      resolveDeployment(env);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Production deployment configuration is invalid.",
      );
    }
  }

  return errors;
}

export async function collectMissingAssetErrors(
  root = process.cwd(),
): Promise<string[]> {
  const errors: string[] = [];
  for (const relativePath of requiredPublicAssets) {
    try {
      await access(path.join(root, relativePath));
    } catch {
      errors.push(`Required public asset is missing: ${relativePath}.`);
    }
  }

  return errors;
}

export async function collectProductionValidationErrors({
  env = process.env,
  root = process.cwd(),
}: {
  env?: RuntimeEnvironment;
  root?: string;
} = {}): Promise<string[]> {
  const [configErrors, assetErrors] = await Promise.all([
    Promise.resolve(collectProductionConfigErrors(env)),
    collectMissingAssetErrors(root),
  ]);
  return [...configErrors, ...assetErrors];
}
