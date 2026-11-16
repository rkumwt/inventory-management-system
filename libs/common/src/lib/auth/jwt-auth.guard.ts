import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccessTokenClaims, AuthUser, authUserFromClaims } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

export function extractBearerToken(header?: string): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Authentication guard. Verifies the JWT access token's signature and expiry
 * and attaches the caller to `request.user`. Verification is stateless (no
 * database or network call), so every service can do it independently and
 * never has to trust a header set by someone else.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Message handlers (RabbitMQ events) have no HTTP request and no user.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer access token');
    }

    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
      request.user = authUserFromClaims(claims);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
