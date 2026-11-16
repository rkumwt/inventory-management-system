import type { EventEnvelope } from '@ims/events';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * An event waiting to be published. Written in the same database transaction
 * as the business change that caused it, so either both exist or neither.
 */
@Entity('outbox_events')
export class OutboxEvent {
  /** Same value as the event's `eventId`. */
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  eventName!: string;

  /** The complete envelope, exactly as it will be published. */
  @Column({ type: 'jsonb' })
  payload!: EventEnvelope;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Null until the broker has confirmed the message. */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;
}
