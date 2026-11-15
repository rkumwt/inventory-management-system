import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthUser } from './auth-user';
import { Permission } from './roles';

export const IS_PUBLIC_KEY = 'ims:isPublic';
export const PERMISSIONS_KEY = 'ims:permissions';

/** Marks a route as reachable without authentication (login, health, ...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires the caller to hold ALL of the listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Injects the authenticated user: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);
