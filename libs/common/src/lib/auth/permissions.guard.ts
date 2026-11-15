import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { Permission } from './roles';

/**
 * Authorisation guard. Runs after an authentication guard has populated
 * `request.user`, and checks the permissions declared with
 * `@RequirePermissions(...)` on the handler or controller.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const required =
      this.reflector.getAllAndOverride<Permission[] | undefined>(
        PERMISSIONS_KEY,
        targets,
      ) ?? [];
    if (required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const missing = required.filter(
      (permission) => !user.permissions.includes(permission),
    );
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
