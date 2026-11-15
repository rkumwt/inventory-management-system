import { Client } from 'pg';

/** Creates the test database if it does not exist yet. */
export async function ensureTestDatabase(): Promise<void> {
  const database = process.env['DB_NAME'];
  if (!database?.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests against "${database}"`);
  }

  const client = new Client({
    host: process.env['DB_HOST'],
    port: Number(process.env['DB_PORT']),
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    database: 'postgres',
  });
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await client.end();
  }
}
