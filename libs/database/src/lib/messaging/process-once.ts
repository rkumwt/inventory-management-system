import type { EventEnvelope } from '@ims/events';
import type { DataSource, EntityManager } from 'typeorm';
import { ProcessedEvent } from './processed-event.entity';

/**
 * Idempotent consumer. Runs `work` at most once per event ID:
 *
 * 1. In one transaction, insert the event ID into `processed_events`.
 * 2. If the ID was already there, this is a duplicate delivery: do nothing.
 * 3. Otherwise run `work` in the same transaction. If it throws, the insert
 *    is rolled back too, so a redelivery will try again.
 *
 * The broker delivers at least once (a consumer can crash after doing the
 * work but before acknowledging), so every handler goes through here.
 *
 * @returns true if the work ran, false if the event was a duplicate.
 */
export function processOnce(
  dataSource: DataSource,
  event: Pick<EventEnvelope, 'eventId' | 'eventName'>,
  work: (manager: EntityManager) => Promise<void>,
): Promise<boolean> {
  return dataSource.transaction(async (manager) => {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(ProcessedEvent)
      .values({ eventId: event.eventId, eventName: event.eventName })
      .orIgnore() // ON CONFLICT DO NOTHING
      .returning('event_id')
      .execute();

    if ((result.raw as unknown[]).length === 0) return false;
    await work(manager);
    return true;
  });
}
