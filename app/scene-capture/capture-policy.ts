export function isSceneCaptureEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.SCENE_CAPTURE === "1" && env.SITE_ENV === "preview";
}
