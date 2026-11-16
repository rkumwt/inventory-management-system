import {
  baseEnvSchema,
  booleanFlag,
  databaseEnvSchema,
  httpEnvSchema,
  jwtVerifyEnvSchema,
  rabbitmqEnvSchema,
  serviceUrl,
} from '@ims/config';
import { z } from 'zod';

export const inventoryEnvSchema = z.object({
  ...baseEnvSchema.shape,
  ...httpEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...jwtVerifyEnvSchema.shape,
  ...rabbitmqEnvSchema.shape,

  // Synchronous lookups in the services that own products and warehouses
  PRODUCT_SERVICE_URL: serviceUrl,
  WAREHOUSE_SERVICE_URL: serviceUrl,
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  /** Extra attempts after a failed lookup (lookups are GETs, so safe). */
  UPSTREAM_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

  /** Create the sample stock levels at startup. */
  SEED_DATA: booleanFlag(false),
});

export type InventoryEnv = z.infer<typeof inventoryEnvSchema>;

/** Injection token for the validated environment. */
export const INVENTORY_ENV = Symbol('INVENTORY_ENV');
