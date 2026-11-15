import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndRefreshTokens1731600000000 implements MigrationInterface {
  name = 'CreateUsersAndRefreshTokens1731600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         varchar(255) NOT NULL,
        name          varchar(120) NOT NULL,
        password_hash varchar(255) NOT NULL,
        role          varchar(20)  NOT NULL,
        is_active     boolean      NOT NULL DEFAULT true,
        created_at    timestamptz  NOT NULL DEFAULT now(),
        updated_at    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE refresh_tokens`);
    await queryRunner.query(`DROP TABLE users`);
  }
}
