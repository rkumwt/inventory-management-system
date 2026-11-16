import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

@Entity('categories')
export class Category extends BaseEntity {
  /** Unique, ignoring case. */
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
