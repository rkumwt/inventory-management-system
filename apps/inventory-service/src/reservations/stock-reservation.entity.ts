import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';
import type { StockLine } from '../stock/stock-rules';

export enum ReservationStatus {
  /** Stock is being held for the order. */
  Reserved = 'RESERVED',
  /** There was not enough stock; nothing is held. */
  Rejected = 'REJECTED',
  /** The order was cancelled; nothing is held (any more). */
  Released = 'RELEASED',
}

/** What inventory-service did about one order's request for stock. */
@Entity('stock_reservations')
export class StockReservation extends BaseEntity {
  /** Unique: an order has at most one reservation. */
  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'uuid' })
  warehouseId!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: ReservationStatus;

  /** Quantity held per product (one entry per product). */
  @Column({ type: 'jsonb', default: [] })
  items!: StockLine[];
}
