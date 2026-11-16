import { BaseEntity, numericTransformer } from '@ims/database';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Category } from '../categories/category.entity';

/** Units a product can be counted or measured in. */
export enum ProductUnit {
  Piece = 'pcs',
  Box = 'box',
  Pack = 'pack',
  Kilogram = 'kg',
  Litre = 'l',
  Metre = 'm',
}

/** Free-form, product-specific details such as colour or voltage. */
export type ProductAttributes = Record<string, string | number | boolean>;

@Entity('products')
export class Product extends BaseEntity {
  /** Always stored upper-cased; unique. */
  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;

  @Column({ type: 'varchar', length: 20 })
  unit!: ProductUnit;

  @Column({ type: 'jsonb', default: {} })
  attributes!: ProductAttributes;

  @Column({ type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category?: Category | null;

  /** Archived products stay in the database; see ProductsService.archive. */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
