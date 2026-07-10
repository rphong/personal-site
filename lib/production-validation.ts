import { access } from "node:fs/promises";
import path from "node:path";
import {
  getOwnerGatedFields,
  home,
  type OwnerHomeFields,
} from "../content/site-content";
import {
  resolveDeployment,
  type RuntimeEnvironment,
} from "./deployment";

export const FOUNDATION_PREVIEW_ONLY_MESSAGE =
  "Foundation reference posters are preview-only; production requires deterministic scene posters and every required GLB.";

export const requiredPublicAssets = [
  "public/Richard-Phong-Resume.pdf",
  "public/posters/home-reference.png",
  "public/posters/experience-reference.png",
  "public/posters/projects-reference.png",
  "public/posters/contact-reference.png",
  "public/images/froggie-gameplay.png",
] as const;

export function collectProductionConfigErrors(
  env: RuntimeEnvironment,
  ownerFields: OwnerHomeFields = home,
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

  errors.push(
    ...getOwnerGatedFields(ownerFields).map(
      (field) => `Owner copy is still gated: ${field}.`,
    ),
  );
  errors.push(FOUNDATION_PREVIEW_ONLY_MESSAGE);

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
  ownerFields = home,
  root = process.cwd(),
}: {
  env?: RuntimeEnvironment;
  ownerFields?: OwnerHomeFields;
  root?: string;
} = {}): Promise<string[]> {
  const [configErrors, assetErrors] = await Promise.all([
    Promise.resolve(collectProductionConfigErrors(env, ownerFields)),
    collectMissingAssetErrors(root),
  ]);

  return [...configErrors, ...assetErrors];
}
