import {
  baseEnvSchema,
  booleanFlag,
  databaseEnvSchema,
  httpEnvSchema,
  jwtVerifyEnvSchema,
} from '@ims/config';
import { z } from 'zod';

export const productEnvSchema = z.object({
  ...baseEnvSchema.shape,
  ...httpEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...jwtVerifyEnvSchema.shape,
  /** Create the sample categories and products at startup. */
  SEED_DATA: booleanFlag(false),
});

export type ProductEnv = z.infer<typeof productEnvSchema>;

/** Injection token for the validated environment. */
export const PRODUCT_ENV = Symbol('PRODUCT_ENV');
