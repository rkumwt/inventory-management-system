import { createMessagingTables, dropMessagingTables } from '@ims/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersAndMessaging1732000000000 implements MigrationInterface {
  name = 'CreateOrdersAndMessaging1732000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE orders (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number        varchar(32)    NOT NULL,
        warehouse_id        uuid           NOT NULL,
        status              varchar(20)    NOT NULL,
        total_amount        numeric(14, 2) NOT NULL,
        note                varchar(500),
        cancellation_reason varchar(500),
        created_by          uuid           NOT NULL,
        created_by_email    varchar(255)   NOT NULL,
        created_at          timestamptz    NOT NULL DEFAULT now(),
        updated_at          timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT uq_orders_order_number UNIQUE (order_number),
        CONSTRAINT chk_orders_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
        CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC)`,
    );

    // Product details are copied in when the order is placed: an order must
    // keep showing the name and price it was placed at.
    await queryRunner.query(`
      CREATE TABLE order_items (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id     uuid           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
        product_id   uuid           NOT NULL,
        sku          varchar(64)    NOT NULL,
        product_name varchar(200)   NOT NULL,
        quantity     integer        NOT NULL,
        unit_price   numeric(12, 2) NOT NULL,
        line_total   numeric(14, 2) NOT NULL,
        created_at   timestamptz    NOT NULL DEFAULT now(),
        updated_at   timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT chk_order_items_quantity CHECK (quantity > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_order_items_order_id ON order_items (order_id)`,
    );

    await createMessagingTables(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await dropMessagingTables(queryRunner);
    await queryRunner.query(`DROP TABLE order_items`);
    await queryRunner.query(`DROP TABLE orders`);
  }
}
