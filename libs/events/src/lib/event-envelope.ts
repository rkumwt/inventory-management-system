import { randomUUID } from 'node:crypto';
import { EventName } from './event-names';
import { EventPayloadMap } from './event-payloads';

/**
 * Wire format of every message on the bus.
 *
 * - `eventId` is unique per event and is what consumers store to stay
 *   idempotent (at-least-once delivery means duplicates will happen).
 * - `correlationId` ties the event back to the HTTP request that caused it.
 */
export interface EventEnvelope<TName extends EventName = EventName> {
  eventId: string;
  eventName: TName;
  version: number;
  occurredAt: string;
  correlationId: string;
  payload: EventPayloadMap[TName];
}

export const EVENT_SCHEMA_VERSION = 1;

export function createEvent<TName extends EventName>(
  eventName: TName,
  payload: EventPayloadMap[TName],
  correlationId: string,
): EventEnvelope<TName> {
  return {
    eventId: randomUUID(),
    eventName,
    version: EVENT_SCHEMA_VERSION,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload,
  };
}

const eventNames = new Set<string>(Object.values(EventName));

/** Runtime guard for messages arriving from the broker. */
export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['eventId'] === 'string' &&
    typeof candidate['eventName'] === 'string' &&
    eventNames.has(candidate['eventName']) &&
    typeof candidate['occurredAt'] === 'string' &&
    typeof candidate['correlationId'] === 'string' &&
    typeof candidate['payload'] === 'object' &&
    candidate['payload'] !== null
  );
}
