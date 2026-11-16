import type { QueryRunner } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { ProcessedEvent } from './processed-event.entity';

/** Entities a service that both publishes and consumes events registers. */
export const messagingEntities = [OutboxEvent, ProcessedEvent];

/*
 * Each event-driven service calls these from one of its own migrations: the
 * tables live in that service's database, next to the data they must be
 * transactional with.
 */

/** For services that publish events. */
export async function createOutboxTable(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE outbox_events (
      id           uuid PRIMARY KEY,
      event_name   varchar(100) NOT NULL,
      payload      jsonb        NOT NULL,
      created_at   timestamptz  NOT NULL DEFAULT now(),
      published_at timestamptz,
      attempts     integer      NOT NULL DEFAULT 0,
      last_error   text
    )
  `);
  // The relay only ever looks for unpublished rows, oldest first.
  await queryRunner.query(`
    CREATE INDEX idx_outbox_events_unpublished
      ON outbox_events (created_at) WHERE published_at IS NULL
  `);
}

/** For services that consume events. */
export async function createProcessedEventsTable(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE processed_events (
      event_id     uuid PRIMARY KEY,
      event_name   varchar(100) NOT NULL,
      processed_at timestamptz  NOT NULL DEFAULT now()
    )
  `);
}

export async function createMessagingTables(
  queryRunner: QueryRunner,
): Promise<void> {
  await createOutboxTable(queryRunner);
  await createProcessedEventsTable(queryRunner);
}

export async function dropMessagingTables(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(`DROP TABLE processed_events`);
  await queryRunner.query(`DROP TABLE outbox_events`);
}
