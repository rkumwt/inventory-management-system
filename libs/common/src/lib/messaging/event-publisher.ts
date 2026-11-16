import type { EventEnvelope } from '@ims/events';
import {
  DynamicModule,
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { rmqPublisherOptions } from './rmq';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/** Sends an event to the message broker. Rejects if it was not accepted. */
export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

/**
 * Publishes to the RabbitMQ topic exchange through the Nest RMQ transport.
 * Services never call this directly from business code: they write events to
 * their outbox table, and the outbox relay publishes them.
 */
@Injectable()
export class RmqEventPublisher implements EventPublisher, OnModuleDestroy {
  private readonly client: ClientProxy;

  constructor(url: string) {
    this.client = ClientProxyFactory.create(rmqPublisherOptions(url));
  }

  /** Connects on first use; resolves once the broker confirmed the message. */
  async publish(event: EventEnvelope): Promise<void> {
    await lastValueFrom(this.client.emit(event.eventName, event));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}

@Global()
@Module({})
export class EventPublisherModule {
  static forRoot(options: { url: string }): DynamicModule {
    return {
      module: EventPublisherModule,
      providers: [
        {
          provide: EVENT_PUBLISHER,
          useFactory: () => new RmqEventPublisher(options.url),
        },
      ],
      exports: [EVENT_PUBLISHER],
    };
  }
}
