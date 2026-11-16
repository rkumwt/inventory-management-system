import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .regex(/^https?:\/\/.+/, 'must be an http:// or https:// URL')
    .transform((value) => value.replace(/\/+$/, '')),
});

/**
 * Validated at build time and at startup: a missing or malformed value stops
 * `next build` / `next dev` with a clear message instead of producing a
 * frontend that calls "undefined/products".
 *
 * NEXT_PUBLIC_ variables must be referenced literally for Next.js to inline
 * them into the browser bundle.
 */
const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid web environment (apps/web/.env):\n${problems}`);
}

export const env = parsed.data;
