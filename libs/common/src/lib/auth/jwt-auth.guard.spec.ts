import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenClaims, AuthUser } from './auth-user';
import { Public } from './decorators';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard';
import { Permission, Role } from './roles';

const secret = 'unit-test-secret-unit-test-secret-1234';
const jwt = new JwtService({ secret });
const guard = new JwtAuthGuard(new Reflector(), jwt);

const claims: AccessTokenClaims = {
  sub: 'user-1',
  email: 'staff@example.com',
  role: Role.Staff,
  permissions: [Permission.ProductsRead],
};

class TestController {
  secured(): void {
    return;
  }

  @Public()
  open(): void {
    return;
  }
}

function contextFor(handler: keyof TestController, authorization?: string) {
  const request: { headers: Record<string, string>; user?: AuthUser } = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  it('lets message handlers through: events carry no HTTP request', async () => {
    const guard = new JwtAuthGuard(new Reflector(), {} as JwtService);
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('attaches the user for a valid token', async () => {
    const token = await jwt.signAsync(claims, { expiresIn: 60 });
    const { context, request } = contextFor('secured', `Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'staff@example.com',
      role: Role.Staff,
      permissions: [Permission.ProductsRead],
    });
  });

  it('lets @Public() routes through without a token', async () => {
    const { context } = contextFor('open');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a missing token', async () => {
    const { context } = contextFor('secured');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const token = await jwt.signAsync(claims, { expiresIn: -10 });
    const { context } = contextFor('secured', `Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid or expired access token',
    );
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({
      secret: 'another-secret-another-secret-123456',
    }).signAsync(claims);
    const { context } = contextFor('secured', `Bearer ${forged}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['Basic abc', undefined],
    ['Bearer', undefined],
    [undefined, undefined],
  ])('reads %s as %s', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});
