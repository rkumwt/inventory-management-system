import { EVENT_PUBLISHER } from '@ims/common';
import type { EventPublisher } from '@ims/common';
import {
  DynamicModule,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

export const OUTBOX_OPTIONS = Symbol('OUTBOX_OPTIONS');

export interface OutboxOptions {
  /** False in tests, which call `publishPending()` themselves. */
  enabled: boolean;
  pollIntervalMs: number;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 50;

/**
 * Publishes outbox rows to the broker.
 *
 * Every `pollIntervalMs` it takes the oldest unpublished rows, publishes each
 * and marks it published. If publishing fails (broker down), the row stays
 * unpublished and is retried on the next tick; nothing is lost, events are
 * only late. If the process dies after publishing but before marking, the
 * event is published again on restart, which is why consumers are idempotent.
 *
 * `FOR UPDATE SKIP LOCKED` lets several instances of a service run the relay
 * at once without publishing the same row twice.
 */
@Injectable()
export class OutboxRelay
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(OUTBOX_OPTIONS) private readonly options: OutboxOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.options.enabled) return;
    this.timer = setInterval(
      () => void this.tick(),
      this.options.pollIntervalMs,
    );
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return; // the previous tick is still publishing
    this.running = true;
    try {
      await this.publishPending();
    } catch (error) {
      this.logger.error(
        'Outbox relay tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  /** Publishes one batch. Returns how many events were published. */
  async publishPending(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .createQueryBuilder(OutboxEvent, 'event')
        .where('event.publishedAt IS NULL')
        .orderBy('event.createdAt', 'ASC')
        .limit(this.options.batchSize ?? DEFAULT_BATCH_SIZE)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      let published = 0;
      for (const row of batch) {
        try {
          await this.publisher.publish(row.payload);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Could not publish ${row.eventName} ${row.id} (attempt ${row.attempts + 1}): ${message}`,
          );
          await manager.update(OutboxEvent, row.id, {
            attempts: row.attempts + 1,
            lastError: message,
          });
          break; // keep the order: do not publish later events first
        }
        await manager.update(OutboxEvent, row.id, {
          publishedAt: new Date(),
          attempts: row.attempts + 1,
          lastError: null,
        });
        published++;
      }
      return published;
    });
  }
}

/** Requires a global EVENT_PUBLISHER provider (EventPublisherModule). */
@Module({})
export class OutboxModule {
  static forRoot(options: OutboxOptions): DynamicModule {
    return {
      module: OutboxModule,
      providers: [{ provide: OUTBOX_OPTIONS, useValue: options }, OutboxRelay],
      exports: [OutboxRelay],
    };
  }
}
