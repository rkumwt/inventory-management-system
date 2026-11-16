import type { EventEnvelope } from '@ims/events';
import type { EntityManager } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

/**
 * Records an event for publishing. Must be called with the EntityManager of
 * the transaction that makes the business change:
 *
 *   await dataSource.transaction(async (manager) => {
 *     await manager.save(order);
 *     await addToOutbox(manager, createEvent(EventName.OrderCreated, ...));
 *   });
 *
 * This is the Outbox pattern. Publishing straight to the broker inside the
 * transaction cannot be made atomic: the message could go out and the commit
 * fail, or the commit succeed and the publish fail. A row in the same
 * database can.
 */
export async function addToOutbox(
  manager: EntityManager,
  event: EventEnvelope,
): Promise<void> {
  await manager.insert(OutboxEvent, {
    id: event.eventId,
    eventName: event.eventName,
    payload: event,
  });
}
