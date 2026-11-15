import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

@Entity('warehouses')
export class Warehouse extends BaseEntity {
  /** Short human-friendly identifier, e.g. `WH-NYC`. Upper-cased; unique. */
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 80 })
  city!: string;

  @Column({ type: 'varchar', length: 80 })
  country!: string;

  /** Archived warehouses stay in the database; see WarehousesService.archive. */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
