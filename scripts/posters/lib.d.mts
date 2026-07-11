export const POSTER_RENDER_INPUT_PATHS: readonly string[];
export function posterRenderInputsSha256(root?: string): Promise<string>;
export function sha256Buffer(buffer: Uint8Array): string;
export function stringifyCanonicalJson(value: unknown): string;
export function canonicalJsonSha256(value: unknown): string;
export function pinnedPlaywrightChromiumVersion(): Promise<string>;
export function normalizePosterRenderInput(
  relativePath: string,
  contents: Uint8Array,
): Uint8Array;
export function changedChannelRatio(
  left: Uint8Array,
  right: Uint8Array,
  tolerance?: number,
): number;
export function buildPosterManifest<T extends object>(input: {
  browserVersion: string;
  contractSha256: string;
  renderInputsSha256: string;
  posters: readonly T[];
  toolVersions: { readonly playwright: string; readonly sharp: string };
}): Record<string, unknown> & {
  readonly posters: readonly T[];
};
