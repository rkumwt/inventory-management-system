import { BaseEntity } from '@ims/database';
import { Column, Entity } from 'typeorm';

/**
 * One row per issued refresh token. `id` is the token's `jti` claim. Only a
 * SHA-256 hash of the token is stored, so a database leak does not expose
 * usable tokens.
 */
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
