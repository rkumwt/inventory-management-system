// Runs before the integration tests import the app. Uses the local/CI Redis
// (database 15, so development counters are untouched) and a stub upstream.
import { config } from 'dotenv';
import { join } from 'node:path';

config({ path: join(__dirname, '../../../.env') });

export const STUB_UPSTREAM_PORT = 4901;

const redisUrl = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
redisUrl.pathname = '/15';

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  PORT: '4910',
  REDIS_URL: redisUrl.toString(),
  JWT_ACCESS_SECRET: 'integration-test-access-secret-0123456789',
  AUTH_SERVICE_URL: `http://127.0.0.1:${STUB_UPSTREAM_PORT}`,
  PRODUCT_SERVICE_URL: `http://127.0.0.1:${STUB_UPSTREAM_PORT}`,
  WAREHOUSE_SERVICE_URL: `http://127.0.0.1:${STUB_UPSTREAM_PORT}`,
  INVENTORY_SERVICE_URL: `http://127.0.0.1:${STUB_UPSTREAM_PORT}`,
  UPSTREAM_TIMEOUT_MS: '1000',
  UPSTREAM_RETRIES: '1',
  RATE_LIMIT_MAX: '100',
  AUTH_RATE_LIMIT_MAX: '3',
});
