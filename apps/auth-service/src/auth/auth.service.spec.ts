import { AccessTokenClaims, Permission, Role } from '@ims/common';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService, hashToken, TokenConfig } from './auth.service';
import { RefreshToken } from './refresh-token.entity';

const ACCESS_SECRET = 'access-secret-for-unit-tests-0123456789';
const config: TokenConfig = {
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_SECRET: 'refresh-secret-for-unit-tests-0123456789',
  JWT_REFRESH_TTL_SECONDS: 3600,
};

const user = {
  id: '0b0e7c1e-0000-4000-8000-000000000001',
  email: 'staff@ims.local',
  name: 'Sam Staff',
  passwordHash: 'hash',
  role: Role.Staff,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
} as User;

/** In-memory stand-in for the refresh_tokens table. */
function createTokenStore() {
  const rows = new Map<string, RefreshToken>();
  const repository = {
    create: (row: RefreshToken) => row,
    save: async (row: RefreshToken) => {
      rows.set(row.id, { ...row });
      return row;
    },
    findOne: async ({ where }: { where: { id: string } }) =>
      rows.get(where.id) ?? null,
    // Mirrors `UPDATE ... SET revoked_at WHERE <id|user_id> AND revoked_at IS NULL`
    update: async (
      where: { id?: string; userId?: string },
      patch: Partial<RefreshToken>,
    ) => {
      let affected = 0;
      for (const row of rows.values()) {
        const matches =
          (where.id === undefined || row.id === where.id) &&
          (where.userId === undefined || row.userId === where.userId) &&
          row.revokedAt === null;
        if (matches) {
          Object.assign(row, patch);
          affected++;
        }
      }
      return { affected };
    },
  };
  return {
    rows,
    repository: repository as unknown as Repository<RefreshToken>,
  };
}

function setup(overrides: Partial<User> = {}) {
  const account = { ...user, ...overrides } as User;
  const users = {
    findByEmail: jest.fn(async (email: string) =>
      email === account.email ? account : null,
    ),
    findById: jest.fn(async (id: string) =>
      id === account.id ? account : null,
    ),
    verifyPassword: jest.fn(
      async (_user: User, password: string) => password === 'correct-password',
    ),
    create: jest.fn(async (input: object) => ({ ...account, ...input })),
  };
  const store = createTokenStore();
  const jwt = new JwtService({ secret: ACCESS_SECRET });
  const service = new AuthService(
    users as unknown as UsersService,
    store.repository,
    jwt,
    config,
  );
  return { service, users, store, jwt, account };
}

const credentials = { email: user.email, password: 'correct-password' };

describe('AuthService', () => {
  describe('register', () => {
    it('always creates a STAFF user, whatever the caller sends', async () => {
      const { service, users } = setup();

      await service.register({
        email: 'new@ims.local',
        name: 'New User',
        password: 'a-long-password',
      });

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@ims.local', role: Role.Staff }),
      );
    });
  });

  describe('login', () => {
    it('returns an access token carrying role and permissions', async () => {
      const { service, jwt } = setup();

      const result = await service.login(credentials);
      const claims = await jwt.verifyAsync<
        AccessTokenClaims & { exp: number; iat: number }
      >(result.accessToken);

      expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(claims).toMatchObject({
        sub: user.id,
        email: user.email,
        role: Role.Staff,
      });
      expect(claims.permissions).toContain(Permission.OrdersCreate);
      expect(claims.permissions).not.toContain(Permission.UsersManage);
      expect(claims.exp - claims.iat).toBe(900);
    });

    it('stores only a hash of the refresh token', async () => {
      const { service, store } = setup();

      const { refreshToken } = await service.login(credentials);
      const [row] = [...store.rows.values()];

      expect(store.rows.size).toBe(1);
      expect(row?.tokenHash).toBe(hashToken(refreshToken));
      expect(JSON.stringify(row)).not.toContain(refreshToken);
      expect(row?.revokedAt).toBeNull();
    });

    it.each([
      ['a wrong password', { ...credentials, password: 'wrong' }, {}],
      ['an unknown email', { ...credentials, email: 'ghost@ims.local' }, {}],
      ['a deactivated account', credentials, { isActive: false }],
    ])('rejects %s with the same generic error', async (_label, dto, state) => {
      const { service, store } = setup(state);

      await expect(service.login(dto)).rejects.toMatchObject({
        response: {
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      expect(store.rows.size).toBe(0);
    });
  });

  describe('refresh', () => {
    it('rotates: the old token is revoked and a new pair is issued', async () => {
      const { service, store } = setup();
      const first = await service.login(credentials);

      const second = await service.refresh(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      const rows = [...store.rows.values()];
      expect(rows).toHaveLength(2);
      expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
    });

    it('treats reuse of a rotated token as theft and revokes every session', async () => {
      const { service, store } = setup();
      const first = await service.login(credentials);
      const second = await service.refresh(first.refreshToken);

      await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({
        response: { error: 'REFRESH_TOKEN_REVOKED' },
      });

      expect(
        [...store.rows.values()].every((row) => row.revokedAt !== null),
      ).toBe(true);
      await expect(service.refresh(second.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lets only one of two concurrent refreshes succeed', async () => {
      const { service } = setup();
      const { refreshToken } = await service.login(credentials);

      const results = await Promise.allSettled([
        service.refresh(refreshToken),
        service.refresh(refreshToken),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    it('rejects a token signed with the wrong secret', async () => {
      const { service } = setup();
      const forged = await new JwtService({ secret: ACCESS_SECRET }).signAsync({
        sub: user.id,
        jti: 'whatever',
      });

      await expect(service.refresh(forged)).rejects.toMatchObject({
        response: { error: 'INVALID_REFRESH_TOKEN' },
      });
    });

    it('rejects an expired stored token', async () => {
      const { service, store } = setup();
      const { refreshToken } = await service.login(credentials);
      for (const row of store.rows.values()) row.expiresAt = new Date(0);

      await expect(service.refresh(refreshToken)).rejects.toMatchObject({
        response: { error: 'INVALID_REFRESH_TOKEN' },
      });
    });

    it('rejects when the account has been deactivated since login', async () => {
      const { service, account } = setup();
      const { refreshToken } = await service.login(credentials);
      account.isActive = false;

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the token so it can no longer be refreshed', async () => {
      const { service } = setup();
      const { refreshToken } = await service.login(credentials);

      await service.logout(refreshToken);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('is idempotent and ignores garbage tokens', async () => {
      const { service } = setup();
      const { refreshToken } = await service.login(credentials);

      await service.logout(refreshToken);
      await expect(service.logout(refreshToken)).resolves.toBeUndefined();
      await expect(service.logout('not-a-jwt')).resolves.toBeUndefined();
    });
  });
});
