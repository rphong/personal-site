import { collectProductionValidationErrors } from "../lib/production-validation";

const errors = await collectProductionValidationErrors();

if (errors.length > 0) {
  console.error("Production validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Production validation passed.");
}
