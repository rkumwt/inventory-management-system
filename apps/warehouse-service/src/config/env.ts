import { loadEnv } from '@ims/config';
import { warehouseEnvSchema } from './env.schema';

/**
 * Validated at import time: if anything is missing or malformed the process
 * exits here, before Nest starts. Service-specific file first, shared second.
 */
export const env = loadEnv(warehouseEnvSchema, {
  files: ['apps/warehouse-service/.env', '.env'],
});
