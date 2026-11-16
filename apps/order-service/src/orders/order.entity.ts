import { BaseEntity, numericTransformer } from '@ims/database';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { OrderStatus } from '../saga/order-state';

@Entity('orders')
export class Order extends BaseEntity {
  /** Human-friendly identifier, e.g. `ORD-20261116-K3F9QZ`. Unique. */
  @Column({ type: 'varchar', length: 32 })
  orderNumber!: string;

  /** The warehouse the whole order is fulfilled from. */
  @Column({ type: 'uuid' })
  warehouseId!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: OrderStatus;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancellationReason!: string | null;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'varchar', length: 255 })
  createdByEmail!: string;

  @OneToMany(() => OrderItem, (item) => item.order)
  items?: OrderItem[];
}

/** A product on an order, with its SKU, name and price at the time. */
@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  productName!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice!: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  lineTotal!: number;
}
