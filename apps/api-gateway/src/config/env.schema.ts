import {
  baseEnvSchema,
  httpEnvSchema,
  jwtVerifyEnvSchema,
  redisEnvSchema,
  serviceUrl,
} from '@ims/config';
import { z } from 'zod';

export const gatewayEnvSchema = z.object({
  ...baseEnvSchema.shape,
  ...httpEnvSchema.shape,
  ...jwtVerifyEnvSchema.shape,
  ...redisEnvSchema.shape,

  // Downstream services (one entry per service as later phases add them)
  AUTH_SERVICE_URL: serviceUrl,
  PRODUCT_SERVICE_URL: serviceUrl,
  WAREHOUSE_SERVICE_URL: serviceUrl,
  INVENTORY_SERVICE_URL: serviceUrl,
  ORDER_SERVICE_URL: serviceUrl,
  NOTIFICATION_SERVICE_URL: serviceUrl,

  // Resilience for synchronous calls
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  /** Extra attempts for idempotent requests (GET) after a failure. */
  UPSTREAM_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

  // Rate limiting (per client IP, counters stored in Redis)
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  /** Stricter limit for login / register / refresh to slow down guessing. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;
