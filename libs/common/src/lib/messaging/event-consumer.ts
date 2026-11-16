import { EventEnvelope, EventName, isEventEnvelope } from '@ims/events';
import { Logger } from '@nestjs/common';
import { runWithCorrelationId } from '../correlation/correlation';

const logger = new Logger('EventConsumer');

/** The parts of Nest's `RmqContext` this helper needs. */
export interface AckContext {
  getChannelRef(): {
    ack(message: unknown): void;
    nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
  };
  getMessage(): { fields?: { redelivered?: boolean } };
}

/**
 * Wraps every event handler with the delivery rules:
 *
 * - The handler runs with the event's correlation ID bound, so its log lines
 *   join the trace of the HTTP request that started the flow.
 * - Success: acknowledge, and the broker deletes the message.
 * - First failure: return it to the queue for one more attempt.
 * - Second failure, or a malformed message: reject without requeue, which
 *   routes it to the dead-letter queue instead of looping forever.
 *
 * Delivery is therefore at-least-once, and handlers must be idempotent
 * (see `processOnce` in @ims/database).
 */
export async function consumeEvent<TName extends EventName>(
  context: AckContext,
  data: unknown,
  eventName: TName,
  handler: (event: EventEnvelope<TName>) => Promise<void>,
): Promise<void> {
  const channel = context.getChannelRef();
  const message = context.getMessage();

  if (!isEventEnvelope(data) || data.eventName !== eventName) {
    logger.error(`Rejected a message that is not a valid ${eventName} event`);
    channel.nack(message, false, false);
    return;
  }

  try {
    await runWithCorrelationId(data.correlationId, () =>
      handler(data as EventEnvelope<TName>),
    );
    channel.ack(message);
  } catch (error) {
    const retry = !message.fields?.redelivered;
    logger.error(
      `${data.eventName} ${data.eventId} failed; ${retry ? 'requeueing' : 'dead-lettering'}`,
      error instanceof Error ? error.stack : String(error),
    );
    channel.nack(message, false, retry);
  }
}
