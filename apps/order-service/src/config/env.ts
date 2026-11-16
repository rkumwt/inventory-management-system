import { loadEnv } from '@ims/config';
import { orderEnvSchema } from './env.schema';

/**
 * Validated at import time: if anything is missing or malformed the process
 * exits here, before Nest starts. Service-specific file first, shared second.
 */
export const env = loadEnv(orderEnvSchema, {
  files: ['apps/order-service/.env', '.env'],
});
