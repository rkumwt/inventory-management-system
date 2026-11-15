import {
  baseEnvSchema,
  booleanFlag,
  databaseEnvSchema,
  httpEnvSchema,
  jwtVerifyEnvSchema,
} from '@ims/config';
import { z } from 'zod';

export const warehouseEnvSchema = z.object({
  ...baseEnvSchema.shape,
  ...httpEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...jwtVerifyEnvSchema.shape,
  /** Create the sample warehouses and storage locations at startup. */
  SEED_DATA: booleanFlag(false),
});

export type WarehouseEnv = z.infer<typeof warehouseEnvSchema>;

/** Injection token for the validated environment. */
export const WAREHOUSE_ENV = Symbol('WAREHOUSE_ENV');
