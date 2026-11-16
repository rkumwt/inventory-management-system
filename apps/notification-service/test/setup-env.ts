// Runs before the integration tests import the app. Points the service at a
// dedicated test database on the local/CI Postgres; connection details come
// from the real environment (CI) or the root .env (local).
import { config } from 'dotenv';
import { join } from 'node:path';

config({ path: join(__dirname, '../../../.env') });

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  PORT: '4916',
  DB_NAME: 'ims_notification_test',
  DB_MIGRATIONS_RUN: 'true',
  JWT_ACCESS_SECRET: 'integration-test-access-secret-0123456789',
  // No broker in these tests: handlers are called directly and the outbox
  // relay is driven by hand with a fake publisher.
  RABBITMQ_URL: 'amqp://unused:unused@127.0.0.1:1',
  OUTBOX_RELAY_ENABLED: 'false',
  PRODUCT_SERVICE_URL: 'http://127.0.0.1:1',
  WAREHOUSE_SERVICE_URL: 'http://127.0.0.1:1',
});
