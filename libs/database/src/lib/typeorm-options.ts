import type { DatabaseEnv } from '@ims/config';
import type { DataSourceOptions, ValueTransformer } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy';

type Postgres = Extract<DataSourceOptions, { type: 'postgres' }>;

export interface ServiceDatabaseOptions {
  entities: NonNullable<Postgres['entities']>;
  migrations: NonNullable<Postgres['migrations']>;
  /**
   * Apply pending migrations on startup. Convenient locally and fine for an
   * MVP; in production run migrations as a separate deploy step instead.
   */
  migrationsRun?: boolean;
  logging?: boolean;
}

/**
 * Builds the TypeORM options for one service's own database. The same object
 * feeds `TypeOrmModule.forRoot(...)` at runtime and `new DataSource(...)` for
 * the migration CLI, so the two can never drift apart.
 *
 * `synchronize` is always false: the schema changes only through migrations.
 */
export function buildTypeOrmOptions(
  env: DatabaseEnv,
  options: ServiceDatabaseOptions,
): Postgres {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL ? { rejectUnauthorized: true } : false,
    entities: options.entities,
    migrations: options.migrations,
    migrationsRun: options.migrationsRun ?? false,
    migrationsTableName: 'migrations',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: options.logging ?? false,
  };
}

/**
 * PostgreSQL `numeric` comes back from the driver as a string to avoid
 * precision loss. For money-sized values we convert at the entity boundary:
 *
 *   @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
