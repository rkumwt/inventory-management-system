import { Permission, Role } from './roles';

/** The authenticated caller, attached to `request.user` by an auth guard. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

/** Claims carried inside the JWT access token. */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

export function authUserFromClaims(claims: AccessTokenClaims): AuthUser {
  return {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    permissions: claims.permissions,
  };
}
