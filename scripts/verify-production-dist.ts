import { collectProductionDistErrors } from "../lib/production-dist";

const errors = await collectProductionDistErrors();

if (errors.length > 0) {
  console.error("Production artifact verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production artifact verification passed.");
}
