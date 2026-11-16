import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesAndProducts1731700000000 implements MigrationInterface {
  name = 'CreateCategoriesAndProducts1731700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE categories (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name        varchar(80) NOT NULL,
        description text,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    // "Tools" and "tools" are the same category.
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_categories_name ON categories (lower(name))`,
    );

    await queryRunner.query(`
      CREATE TABLE products (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku         varchar(64)    NOT NULL,
        name        varchar(200)   NOT NULL,
        description text,
        price       numeric(12, 2) NOT NULL,
        unit        varchar(20)    NOT NULL,
        attributes  jsonb          NOT NULL DEFAULT '{}',
        category_id uuid REFERENCES categories (id) ON DELETE RESTRICT,
        is_active   boolean        NOT NULL DEFAULT true,
        created_at  timestamptz    NOT NULL DEFAULT now(),
        updated_at  timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT uq_products_sku UNIQUE (sku),
        CONSTRAINT chk_products_price CHECK (price >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_products_category_id ON products (category_id)`,
    );
    // Serves the attribute filter: attributes @> '{"color": "red"}'.
    await queryRunner.query(
      `CREATE INDEX idx_products_attributes ON products USING gin (attributes jsonb_path_ops)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE products`);
    await queryRunner.query(`DROP TABLE categories`);
  }
}
