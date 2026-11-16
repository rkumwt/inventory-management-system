import { loadEnv } from '@ims/config';
import { inventoryEnvSchema } from './env.schema';

/**
 * Validated at import time: if anything is missing or malformed the process
 * exits here, before Nest starts. Service-specific file first, shared second.
 */
export const env = loadEnv(inventoryEnvSchema, {
  files: ['apps/inventory-service/.env', '.env'],
});
