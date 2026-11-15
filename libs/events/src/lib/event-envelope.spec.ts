import { createEvent, isEventEnvelope } from './event-envelope';
import { EventName } from './event-names';

describe('createEvent', () => {
  it('wraps a payload in an envelope with a unique id', () => {
    const payload = {
      orderId: 'order-1',
      warehouseId: 'wh-1',
      items: [{ productId: 'p-1', quantity: 2 }],
    };

    const first = createEvent(EventName.StockReserved, payload, 'corr-1');
    const second = createEvent(EventName.StockReserved, payload, 'corr-1');

    expect(first).toMatchObject({
      eventName: 'stock.reserved',
      version: 1,
      correlationId: 'corr-1',
      payload,
    });
    expect(first.eventId).not.toBe(second.eventId);
    expect(new Date(first.occurredAt).toISOString()).toBe(first.occurredAt);
  });
});

describe('isEventEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const event = createEvent(
      EventName.LowStockDetected,
      {
        productId: 'p-1',
        warehouseId: 'wh-1',
        availableQuantity: 3,
        threshold: 10,
      },
      'corr-1',
    );

    expect(isEventEnvelope(JSON.parse(JSON.stringify(event)))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'order.created'],
    ['an unknown event name', { eventId: 'x', eventName: 'nope' }],
    [
      'a missing payload',
      {
        eventId: 'x',
        eventName: EventName.OrderCreated,
        occurredAt: 'now',
        correlationId: 'c',
      },
    ],
  ])('rejects %s', (_label, value) => {
    expect(isEventEnvelope(value)).toBe(false);
  });
});
