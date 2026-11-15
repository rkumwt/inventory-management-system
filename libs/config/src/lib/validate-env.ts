import type { z } from 'zod';

/** Thrown at startup when the environment does not match a service's schema. */
export class ConfigValidationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map((issue) => `  - ${issue}`)
        .join('\n')}`,
    );
    this.name = 'ConfigValidationError';
  }
}

/**
 * Parses `env` against a Zod schema and returns a typed, coerced config object.
 * Throws {@link ConfigValidationError} listing every problem, so a service
 * fails fast at boot instead of failing later at first use.
 */
export function validateEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  env: Record<string, unknown> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new ConfigValidationError(
      result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}
