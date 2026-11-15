import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehousesAndStorageLocations1731700100000 implements MigrationInterface {
  name = 'CreateWarehousesAndStorageLocations1731700100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE warehouses (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code       varchar(20)  NOT NULL,
        name       varchar(120) NOT NULL,
        address    varchar(255),
        city       varchar(80)  NOT NULL,
        country    varchar(80)  NOT NULL,
        is_active  boolean      NOT NULL DEFAULT true,
        created_at timestamptz  NOT NULL DEFAULT now(),
        updated_at timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT uq_warehouses_code UNIQUE (code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE storage_locations (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        warehouse_id uuid        NOT NULL REFERENCES warehouses (id) ON DELETE CASCADE,
        code         varchar(32) NOT NULL,
        description  varchar(255),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_storage_locations_warehouse_code UNIQUE (warehouse_id, code)
      )
    `);
    // The unique constraint above also serves lookups by warehouse_id.
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE storage_locations`);
    await queryRunner.query(`DROP TABLE warehouses`);
  }
}
