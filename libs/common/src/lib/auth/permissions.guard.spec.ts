import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './auth-user';
import { Public, RequirePermissions } from './decorators';
import { PermissionsGuard } from './permissions.guard';
import { Permission, permissionsForRole, Role } from './roles';

class TestController {
  open(): void {
    return;
  }

  @Public()
  @RequirePermissions(Permission.UsersManage)
  publicRoute(): void {
    return;
  }

  @RequirePermissions(Permission.ProductsWrite)
  writeProduct(): void {
    return;
  }

  @RequirePermissions(Permission.OrdersRead, Permission.OrdersCancel)
  cancelOrder(): void {
    return;
  }
}

function contextFor(
  handler: keyof TestController,
  user?: AuthUser,
): ExecutionContext {
  return {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function userWithRole(role: Role): AuthUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    role,
    permissions: [...permissionsForRole(role)],
  };
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows routes that declare no permissions', () => {
    expect(guard.canActivate(contextFor('open'))).toBe(true);
  });

  it('allows @Public() routes without a user', () => {
    expect(guard.canActivate(contextFor('publicRoute'))).toBe(true);
  });

  it('rejects unauthenticated callers with 401', () => {
    expect(() => guard.canActivate(contextFor('writeProduct'))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a user holding the permission', () => {
    const context = contextFor('writeProduct', userWithRole(Role.Manager));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user missing the permission with 403', () => {
    const context = contextFor('writeProduct', userWithRole(Role.Staff));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('requires every listed permission, not just one', () => {
    const context = contextFor('cancelOrder', userWithRole(Role.Staff));

    expect(() => guard.canActivate(context)).toThrow(/orders:cancel/);
  });
});

describe('role permissions', () => {
  it('gives ADMIN every permission', () => {
    expect(permissionsForRole(Role.Admin)).toEqual(Object.values(Permission));
  });

  it('keeps user management away from MANAGER and STAFF', () => {
    expect(permissionsForRole(Role.Manager)).not.toContain(
      Permission.UsersManage,
    );
    expect(permissionsForRole(Role.Staff)).not.toContain(
      Permission.UsersManage,
    );
  });
});
