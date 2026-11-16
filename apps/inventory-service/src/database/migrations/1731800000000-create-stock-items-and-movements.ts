import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockItemsAndMovements1731800000000 implements MigrationInterface {
  name = 'CreateStockItemsAndMovements1731800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // product_id and warehouse_id belong to other services' databases, so
    // they are plain UUIDs here: there is nothing to put a foreign key on.
    await queryRunner.query(`
      CREATE TABLE stock_items (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id          uuid        NOT NULL,
        warehouse_id        uuid        NOT NULL,
        quantity            integer     NOT NULL DEFAULT 0,
        reserved_quantity   integer     NOT NULL DEFAULT 0,
        low_stock_threshold integer     NOT NULL DEFAULT 0,
        version             integer     NOT NULL DEFAULT 1,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_stock_items_product_warehouse UNIQUE (product_id, warehouse_id),
        CONSTRAINT chk_stock_items_quantity CHECK (quantity >= 0),
        CONSTRAINT chk_stock_items_reserved CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
        CONSTRAINT chk_stock_items_threshold CHECK (low_stock_threshold >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_stock_items_warehouse_id ON stock_items (warehouse_id)`,
    );

    // Append-only ledger: rows are inserted, never updated or deleted.
    await queryRunner.query(`
      CREATE TABLE stock_movements (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stock_item_id  uuid        NOT NULL REFERENCES stock_items (id),
        product_id     uuid        NOT NULL,
        warehouse_id   uuid        NOT NULL,
        type           varchar(20) NOT NULL,
        quantity       integer     NOT NULL,
        quantity_after integer     NOT NULL,
        transfer_id    uuid,
        reference      varchar(120),
        note           varchar(500),
        performed_by   uuid,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_stock_movements_type CHECK (type IN ('IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT')),
        CONSTRAINT chk_stock_movements_quantity CHECK (quantity > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_stock_movements_item_created ON stock_movements (stock_item_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_stock_movements_created ON stock_movements (created_at DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stock_movements`);
    await queryRunner.query(`DROP TABLE stock_items`);
  }
}
