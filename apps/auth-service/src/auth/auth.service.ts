import { AccessTokenClaims, permissionsForRole, Role } from '@ims/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { AUTH_ENV, AuthEnv } from '../config/env.schema';
import { toUserResponse } from '../users/dto/user.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthTokensResponse, LoginDto, RegisterDto } from './dto/auth.dto';
import { RefreshToken } from './refresh-token.entity';

export type TokenConfig = Pick<
  AuthEnv,
  'JWT_ACCESS_TTL_SECONDS' | 'JWT_REFRESH_SECRET' | 'JWT_REFRESH_TTL_SECONDS'
>;

interface RefreshTokenClaims {
  sub: string;
  jti: string;
}

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    @Inject(AUTH_ENV) private readonly config: TokenConfig,
  ) {}

  /** Self-registration always creates the least-privileged role. */
  register(dto: RegisterDto): Promise<User> {
    return this.users.create({ ...dto, role: Role.Staff });
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches =
      user !== null && (await this.users.verifyPassword(user, dto.password));

    // One message for every failure, so callers cannot probe which emails exist.
    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    return this.issueTokens(user);
  }

  /**
   * Refresh token rotation: each refresh token works exactly once and is
   * replaced by a new pair. Presenting a token that was already used or
   * logged out means it was probably stolen, so every session of that user
   * is revoked.
   */
  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const claims = await this.verifyRefreshToken(refreshToken);
    const stored = await this.refreshTokens.findOne({
      where: { id: claims.jti },
    });

    if (!stored || stored.tokenHash !== hashToken(refreshToken)) {
      throw invalidRefreshToken();
    }
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException({
        error: 'REFRESH_TOKEN_REVOKED',
        message: 'Refresh token has been revoked; please sign in again',
      });
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive || stored.expiresAt <= new Date()) {
      throw invalidRefreshToken();
    }

    // Conditional update: of two concurrent refreshes, only one can win.
    const revoked = await this.refreshTokens.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (revoked.affected !== 1) throw invalidRefreshToken();

    return this.issueTokens(user);
  }

  /** Idempotent: logging out with an unknown or expired token is not an error. */
  async logout(refreshToken: string): Promise<void> {
    let claims: RefreshTokenClaims;
    try {
      claims = await this.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await this.refreshTokens.update(
      { id: claims.jti, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokens(user: User): Promise<AuthTokensResponse> {
    const accessClaims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: [...permissionsForRole(user.role)],
    };
    const accessToken = await this.jwt.signAsync(accessClaims, {
      expiresIn: this.config.JWT_ACCESS_TTL_SECONDS,
    });

    const jti = randomUUID();
    const refreshClaims: RefreshTokenClaims = { sub: user.id, jti };
    const refreshToken = await this.jwt.signAsync(refreshClaims, {
      secret: this.config.JWT_REFRESH_SECRET,
      expiresIn: this.config.JWT_REFRESH_TTL_SECONDS,
    });

    await this.refreshTokens.save(
      this.refreshTokens.create({
        id: jti,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + this.config.JWT_REFRESH_TTL_SECONDS * 1000,
        ),
        revokedAt: null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.JWT_ACCESS_TTL_SECONDS,
      user: toUserResponse(user),
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenClaims>(token, {
        secret: this.config.JWT_REFRESH_SECRET,
      });
    } catch {
      throw invalidRefreshToken();
    }
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid or expired',
  });
}
