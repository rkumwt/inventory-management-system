import 'reflect-metadata';
import type { DatabaseEnv } from '@ims/config';
import { SnakeNamingStrategy, toSnakeCase } from './snake-naming.strategy';
import { buildTypeOrmOptions, numericTransformer } from './typeorm-options';

const env: DatabaseEnv = {
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'ims',
  DB_PASSWORD: 'secret',
  DB_NAME: 'ims_product',
  DB_SSL: false,
  DB_MIGRATIONS_RUN: true,
};

describe('buildTypeOrmOptions', () => {
  it('maps env to a postgres connection and never synchronizes', () => {
    const options = buildTypeOrmOptions(env, { entities: [], migrations: [] });

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'ims',
      password: 'secret',
      database: 'ims_product',
      ssl: false,
      synchronize: false,
      migrationsRun: true,
    });
    expect(options.namingStrategy).toBeInstanceOf(SnakeNamingStrategy);
  });

  it('enables verified TLS when DB_SSL is set', () => {
    const options = buildTypeOrmOptions(
      { ...env, DB_SSL: true, DB_MIGRATIONS_RUN: false },
      { entities: [], migrations: [] },
    );

    expect(options.ssl).toEqual({ rejectUnauthorized: true });
    expect(options.migrationsRun).toBe(false);
  });
});

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it.each([
    ['createdAt', 'created_at'],
    ['warehouseId', 'warehouse_id'],
    ['SKU', 'sku'],
    ['lowStockThreshold', 'low_stock_threshold'],
  ])('converts %s to %s', (input, expected) => {
    expect(toSnakeCase(input)).toBe(expected);
  });

  it('names tables, columns and join columns in snake_case', () => {
    expect(strategy.tableName('StockMovement')).toBe('stock_movement');
    expect(strategy.tableName('StockMovement', 'stock_movements')).toBe(
      'stock_movements',
    );
    expect(strategy.columnName('unitPrice', undefined, [])).toBe('unit_price');
    expect(strategy.joinColumnName('category', 'id')).toBe('category_id');
  });
});

describe('numericTransformer', () => {
  it('reads numeric strings as numbers and passes nulls through', () => {
    expect(numericTransformer.from('19.99')).toBe(19.99);
    expect(numericTransformer.from(null)).toBeNull();
    expect(numericTransformer.to(19.99)).toBe(19.99);
  });
});
