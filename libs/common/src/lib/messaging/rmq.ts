import { EVENTS_EXCHANGE, EventQueue } from '@ims/events';
import type { INestApplication } from '@nestjs/common';
import { RmqOptions, Transport } from '@nestjs/microservices';
import { connect } from 'amqplib';

/** Messages that failed twice are routed here instead of being lost. */
export const DEAD_LETTER_EXCHANGE = 'ims.events.dlx';
export const DEAD_LETTER_QUEUE = 'ims.events.dlq';

/**
 * Options for publishing to the shared topic exchange. The event name is the
 * routing key; the publisher does not know which services consume it.
 */
export function rmqPublisherOptions(url: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      exchange: EVENTS_EXCHANGE,
      exchangeType: 'topic',
      wildcards: true,
      persistent: true,
    },
  };
}

/**
 * Options for a service's consumer. Each service has one durable queue,
 * bound to the exchange once per `@EventPattern` it declares. Several
 * instances of a service share the queue (competing consumers).
 *
 * - `noAck: false`: a message is removed only after the handler acknowledges
 *   it, so a crash mid-handler means redelivery, not loss.
 * - `prefetchCount: 1`: one message at a time per instance, in queue order.
 */
export function rmqConsumerOptions(url: string, queue: EventQueue): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      queueOptions: {
        durable: true,
        arguments: { 'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE },
      },
      exchange: EVENTS_EXCHANGE,
      exchangeType: 'topic',
      wildcards: true,
      noAck: false,
      prefetchCount: 1,
    },
  };
}

/** Declares the dead-letter exchange and queue (idempotent). */
export async function assertDeadLetterTopology(url: string): Promise<void> {
  const connection = await connect(url);
  try {
    const channel = await connection.createChannel();
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', {
      durable: true,
    });
    await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, '');
    await channel.close();
  } finally {
    await connection.close();
  }
}

/**
 * Attaches a RabbitMQ consumer to an HTTP app (a Nest "hybrid" application),
 * so one process serves the REST API and handles events.
 */
export async function connectEventConsumer(
  app: INestApplication,
  options: { url: string; queue: EventQueue },
): Promise<void> {
  await assertDeadLetterTopology(options.url);
  app.connectMicroservice<RmqOptions>(
    rmqConsumerOptions(options.url, options.queue),
  );
  await app.startAllMicroservices();
}
