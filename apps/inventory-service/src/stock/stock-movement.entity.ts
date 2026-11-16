import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

export enum MovementType {
  In = 'IN',
  Out = 'OUT',
  TransferIn = 'TRANSFER_IN',
  TransferOut = 'TRANSFER_OUT',
}

/** One row per change to a stock level. Append-only. */
@Entity('stock_movements')
export class StockMovement extends BaseEntity {
  @Column({ type: 'uuid' })
  stockItemId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid' })
  warehouseId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: MovementType;

  /** Always positive; the type says whether stock went up or down. */
  @Column({ type: 'integer' })
  quantity!: number;

  /** On-hand quantity of the stock item right after this movement. */
  @Column({ type: 'integer' })
  quantityAfter!: number;

  /** Shared by the two movements (out + in) of one transfer. */
  @Column({ type: 'uuid', nullable: true })
  transferId!: string | null;

  /** External document, e.g. a purchase order or delivery note number. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  /** User who made the change; null for system-generated movements. */
  @Column({ type: 'uuid', nullable: true })
  performedBy!: string | null;
}
