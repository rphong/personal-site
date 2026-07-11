import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSourceManifest, stringifyStable } from "./lib/manifest.mjs";
import {
  assertReviewedSourcesUnchanged,
  readSourceProvenance,
  replaceFileAtomically,
} from "./prepare-all.mjs";

const POLICY_MODELS = {
  "league-owned-art": "crane-on-league",
  "rocket-brand-safety": "rocket",
};

export function buildBrandApproval({
  key,
  reviewedBy,
  reviewedOn,
  provenance,
}) {
  const modelKey = POLICY_MODELS[key];
  if (!modelKey) throw new Error(`Unknown brand approval key: ${key}`);
  if (!reviewedBy?.trim()) throw new Error("Brand approval requires a reviewer");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn)) {
    throw new Error("Brand approval date must use YYYY-MM-DD");
  }
  const model = provenance.models?.[modelKey];
  if (!model?.canonicalSha256) {
    throw new Error(`${key}: reviewed source provenance is missing`);
  }
  const approval = {
    modelKey,
    reviewedBy: reviewedBy.trim(),
    reviewedOn,
    sourceSha256: model.canonicalSha256,
    status: "approved",
  };
  if (key === "league-owned-art") {
    const textures = model.generatorInputs?.ownedTextures;
    if (
      JSON.stringify(Object.keys(textures ?? {})) !==
      JSON.stringify(["LeagueBanDashboard", "LeagueMatchHistory"])
    ) {
      throw new Error("League approval requires the exact two owned textures");
    }
    approval.textureSha256 = Object.fromEntries(
      Object.entries(textures).map(([name, entry]) => [name, entry.sha256]),
    );
  }
  return approval;
}

async function readApprovals(filePath) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    if (value.schemaVersion !== 1 || !value.approvals) {
      throw new Error("brand-approvals.json must use schemaVersion 1");
    }
    return value;
  } catch (error) {
    if (error.code === "ENOENT") {
      return { schemaVersion: 1, approvals: {} };
    }
    throw error;
  }
}

export async function recordBrandApproval({
  root = process.cwd(),
  key,
  reviewedBy,
  reviewedOn,
}) {
  const manifest = await loadSourceManifest({ root });
  const provenance = await readSourceProvenance(root);
  await assertReviewedSourcesUnchanged({
    root,
    manifest,
    provenance,
  });
  const outputPath = path.join(root, "assets/brand-approvals.json");
  const current = await readApprovals(outputPath);
  const output = {
    schemaVersion: 1,
    approvals: {
      ...current.approvals,
      [key]: buildBrandApproval({
        key,
        reviewedBy,
        reviewedOn,
        provenance,
      }),
    },
  };
  const temporaryPath = `${outputPath}.${process.pid}.next`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await writeFile(temporaryPath, stringifyStable(output));
    await replaceFileAtomically(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return output;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await recordBrandApproval({
      key: argument("--asset"),
      reviewedBy: argument("--reviewer"),
      reviewedOn: argument("--approved-on"),
    });
    console.log("brand approval recorded");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
