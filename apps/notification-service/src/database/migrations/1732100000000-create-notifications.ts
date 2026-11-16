import { createProcessedEventsTable } from '@ims/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1732100000000 implements MigrationInterface {
  name = 'CreateNotifications1732100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type           varchar(30)  NOT NULL,
        recipient      varchar(255) NOT NULL,
        subject        varchar(255) NOT NULL,
        body           text         NOT NULL,
        event_id       uuid         NOT NULL,
        correlation_id varchar(128) NOT NULL,
        created_at     timestamptz  NOT NULL DEFAULT now(),
        updated_at     timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_notifications_created ON notifications (created_at DESC)`,
    );
    await createProcessedEventsTable(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE processed_events`);
    await queryRunner.query(`DROP TABLE notifications`);
  }
}
