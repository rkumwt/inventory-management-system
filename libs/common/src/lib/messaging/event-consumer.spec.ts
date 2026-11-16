import { createEvent, EventName } from '@ims/events';
import { Logger } from '@nestjs/common';
import { getCorrelationId } from '../correlation/correlation';
import { consumeEvent } from './event-consumer';

const event = createEvent(
  EventName.LowStockDetected,
  { productId: 'p', warehouseId: 'w', availableQuantity: 1, threshold: 5 },
  'corr-42',
);

function setup(redelivered = false) {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { fields: { redelivered } };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  };
  return { channel, message, context };
}

describe('consumeEvent', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('acknowledges after the handler succeeds, with the correlation ID bound', async () => {
    const { channel, message, context } = setup();
    let seen: string | undefined;

    await consumeEvent(context, event, event.eventName, async () => {
      seen = getCorrelationId();
    });

    expect(seen).toBe('corr-42');
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('requeues once when the handler fails for the first time', async () => {
    const { channel, message, context } = setup(false);

    await consumeEvent(context, event, event.eventName, async () => {
      throw new Error('database down');
    });

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('dead-letters a message that fails again after redelivery', async () => {
    const { channel, message, context } = setup(true);

    await consumeEvent(context, event, event.eventName, async () => {
      throw new Error('still broken');
    });

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('dead-letters an event of the wrong type for this handler', async () => {
    const { channel, message, context } = setup();
    const handler = jest.fn();

    await consumeEvent(context, event, EventName.OrderCreated, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('dead-letters a malformed message without calling the handler', async () => {
    const { channel, message, context } = setup();
    const handler = jest.fn();

    await consumeEvent(context, { hello: 'world' }, event.eventName, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
