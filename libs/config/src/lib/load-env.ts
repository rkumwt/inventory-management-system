import { config as loadDotenvFile } from 'dotenv';
import type { z } from 'zod';
import { validateEnv } from './validate-env';

export interface LoadEnvOptions {
  /**
   * `.env` files to read, most specific first. Missing files are ignored and
   * a variable that is already set is never overwritten, so the precedence is:
   * real environment > first file > later files.
   */
  files?: string[];
}

/**
 * Loads optional `.env` files, then validates `process.env` against the
 * service's schema. Call it once, at module load time, in each app's `env.ts`:
 * if the configuration is invalid the process exits before Nest starts.
 *
 * In containers no files exist and everything comes from the real environment.
 */
export function loadEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  options: LoadEnvOptions = {},
): z.infer<TSchema> {
  for (const path of options.files ?? []) {
    loadDotenvFile({ path });
  }
  return validateEnv(schema);
}
