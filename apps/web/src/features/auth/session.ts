import type { AuthTokens, Permission, Role } from '@/lib/api/types';

/** The signed-in user as the UI needs it. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
}

interface AccessTokenClaims {
  sub: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

/**
 * Reads the claims out of a JWT without verifying it. That is fine here: the
 * result only decides what the UI shows. Every request is still authorised
 * by the services, which do verify the signature.
 */
export function decodeClaims(token: string): AccessTokenClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Malformed access token');

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    Array.from(
      atob(base64),
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
    ).join(''),
  );
  return JSON.parse(json) as AccessTokenClaims;
}

export function toSessionUser(tokens: AuthTokens): SessionUser {
  const claims = decodeClaims(tokens.accessToken);
  return {
    id: tokens.user.id,
    email: tokens.user.email,
    name: tokens.user.name,
    role: tokens.user.role,
    permissions: claims.permissions ?? [],
  };
}

/** True if the user holds every listed permission. */
export function can(
  user: Pick<SessionUser, 'permissions'> | null | undefined,
  ...required: Permission[]
): boolean {
  return (
    !!user &&
    required.every((permission) => user.permissions.includes(permission))
  );
}
