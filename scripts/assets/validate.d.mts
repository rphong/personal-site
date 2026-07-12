export interface ValidateAllOptions {
  readonly root?: string;
  readonly outputPath?: string;
  readonly requirePosters?: boolean;
}

export function validateAll(options?: ValidateAllOptions): Promise<unknown>;
