import { collectProductionValidationErrors } from "../lib/production-validation";
import { validateAll } from "./assets/validate.mjs";

const root = process.cwd();
const errors = await collectProductionValidationErrors({ root });

try {
  await validateAll({ root, requirePosters: true });
} catch (error) {
  errors.push(
    `3D asset validation failed: ${
      error instanceof Error ? error.message : "unknown validation error"
    }`,
  );
}

if (errors.length > 0) {
  console.error("Production validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production validation passed.");
}
