import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

export enum NotificationType {
  OrderConfirmed = 'ORDER_CONFIRMED',
  OrderCancelled = 'ORDER_CANCELLED',
  LowStock = 'LOW_STOCK',
}

/** A record of one email that was (mock-)sent. */
@Entity('notifications')
export class Notification extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  recipient!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  /** The event that caused this notification. */
  @Column({ type: 'uuid' })
  eventId!: string;

  /** Ties the email back to the HTTP request that started the flow. */
  @Column({ type: 'varchar', length: 128 })
  correlationId!: string;
}
