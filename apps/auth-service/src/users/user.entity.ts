import { Role } from '@ims/common';
import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

@Entity('users')
export class User extends BaseEntity {
  /** Always stored lower-cased; unique. */
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: Role;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
