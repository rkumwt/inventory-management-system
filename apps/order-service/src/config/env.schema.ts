import {
  baseEnvSchema,
  databaseEnvSchema,
  httpEnvSchema,
  jwtVerifyEnvSchema,
  rabbitmqEnvSchema,
  serviceUrl,
} from '@ims/config';
import { z } from 'zod';

export const orderEnvSchema = z.object({
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
});

export type OrderEnv = z.infer<typeof orderEnvSchema>;

/** Injection token for the validated environment. */
export const ORDER_ENV = Symbol('ORDER_ENV');
