import {
  baseEnvSchema,
  booleanFlag,
  databaseEnvSchema,
  httpEnvSchema,
  jwtIssueEnvSchema,
} from '@ims/config';
import { z } from 'zod';

export const authEnvSchema = z
  .object({
    ...baseEnvSchema.shape,
    ...httpEnvSchema.shape,
    ...databaseEnvSchema.shape,
    ...jwtIssueEnvSchema.shape,
    /** Create the sample admin / manager / staff users at startup. */
    SEED_DATA: booleanFlag(false),
    SEED_USER_PASSWORD: z.string().min(8).optional(),
  })
  .refine((env) => !env.SEED_DATA || env.SEED_USER_PASSWORD !== undefined, {
    path: ['SEED_USER_PASSWORD'],
    message: 'is required when SEED_DATA=true',
  });

export type AuthEnv = z.infer<typeof authEnvSchema>;

/** Injection token for the validated environment. */
export const AUTH_ENV = Symbol('AUTH_ENV');
