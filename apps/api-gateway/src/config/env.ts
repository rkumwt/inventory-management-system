import { loadEnv } from '@ims/config';
import { gatewayEnvSchema } from './env.schema';

/** Validated at import time; the process exits here if config is invalid. */
export const env = loadEnv(gatewayEnvSchema, {
  files: ['apps/api-gateway/.env', '.env'],
});
