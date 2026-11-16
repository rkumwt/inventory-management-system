import { createMessagingTables, dropMessagingTables } from '@ims/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReservationsAndMessaging1731900000000 implements MigrationInterface {
  name = 'CreateReservationsAndMessaging1731900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // One row per order: what was reserved for it, and whether it still is.
    await queryRunner.query(`
      CREATE TABLE stock_reservations (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id     uuid        NOT NULL,
        warehouse_id uuid        NOT NULL,
        status       varchar(20) NOT NULL,
        items        jsonb       NOT NULL DEFAULT '[]',
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_stock_reservations_order UNIQUE (order_id),
        CONSTRAINT chk_stock_reservations_status CHECK (status IN ('RESERVED', 'REJECTED', 'RELEASED'))
      )
    `);
    await createMessagingTables(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await dropMessagingTables(queryRunner);
    await queryRunner.query(`DROP TABLE stock_reservations`);
  }
}
