import { BaseEntity } from '@ims/database';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Warehouse } from '../warehouses/warehouse.entity';

/** A place inside a warehouse where goods are kept: an aisle, rack or bin. */
@Entity('storage_locations')
export class StorageLocation extends BaseEntity {
  @Column({ type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Warehouse;

  /** e.g. `A-01-03` (aisle-rack-shelf). Upper-cased; unique per warehouse. */
  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;
}
