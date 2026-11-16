// Runs before the integration tests import the app. Points the service at a
// dedicated test database on the local/CI Postgres; connection details come
// from the real environment (CI) or the root .env (local).
import { config } from 'dotenv';
import { join } from 'node:path';

config({ path: join(__dirname, '../../../.env') });

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  PORT: '4912',
  DB_NAME: 'ims_product_test',
  DB_MIGRATIONS_RUN: 'true',
  SEED_DATA: 'false',
  JWT_ACCESS_SECRET: 'integration-test-access-secret-0123456789',
});
