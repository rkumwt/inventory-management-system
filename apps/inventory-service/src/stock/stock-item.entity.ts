import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

/** How much of one product is held in one warehouse. */
@Entity('stock_items')
export class StockItem extends BaseEntity {
  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid' })
  warehouseId!: string;

  /** Units physically on hand. */
  @Column({ type: 'integer', default: 0 })
  quantity!: number;

  /** Units on hand that are promised to orders and cannot be taken out. */
  @Column({ type: 'integer', default: 0 })
  reservedQuantity!: number;

  /** The item counts as low on stock at or below this many available units. */
  @Column({ type: 'integer', default: 0 })
  lowStockThreshold!: number;

  /**
   * Optimistic lock. Every write is `UPDATE ... WHERE id = ? AND version = ?`
   * and increments it; see StockService.
   */
  @Column({ type: 'integer', default: 1 })
  version!: number;
}
