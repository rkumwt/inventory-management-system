import { requiredPermission, visibleNavItems } from '@/components/navigation';
import type { AuthTokens, Permission } from '@/lib/api/types';
import { can, decodeClaims, toSessionUser } from './session';

const STAFF: Permission[] = [
  'products:read',
  'warehouses:read',
  'inventory:read',
  'inventory:adjust',
  'orders:read',
  'orders:create',
];

function tokenWith(claims: object): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

describe('session', () => {
  it('reads the permissions out of the access token', () => {
    const claims = decodeClaims(
      tokenWith({ sub: 'u1', role: 'STAFF', permissions: STAFF }),
    );

    expect(claims.permissions).toEqual(STAFF);
  });

  it('decodes non-ASCII claims correctly', () => {
    const claims = decodeClaims(
      tokenWith({ sub: 'u1', email: 'zoë@ims.local', permissions: [] }),
    );

    expect(claims.email).toBe('zoë@ims.local');
  });

  it('rejects something that is not a JWT', () => {
    expect(() => decodeClaims('not-a-token')).toThrow();
  });

  it('combines the user from the response with the token permissions', () => {
    const tokens: AuthTokens = {
      accessToken: tokenWith({ sub: 'u1', role: 'STAFF', permissions: STAFF }),
      refreshToken: 'r',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: 'u1',
        email: 'staff@ims.local',
        name: 'Sam Staff',
        role: 'STAFF',
        isActive: true,
      },
    };

    expect(toSessionUser(tokens)).toEqual({
      id: 'u1',
      email: 'staff@ims.local',
      name: 'Sam Staff',
      role: 'STAFF',
      permissions: STAFF,
    });
  });

  it('can() needs every listed permission, and a signed-in user', () => {
    const user = { permissions: STAFF };

    expect(can(user, 'orders:create')).toBe(true);
    expect(can(user, 'orders:create', 'orders:cancel')).toBe(false);
    expect(can(null, 'orders:read')).toBe(false);
  });
});

describe('role-based navigation', () => {
  it('hides menu entries the user has no permission for', () => {
    const labels = visibleNavItems(STAFF).map((item) => item.label);

    expect(labels).toEqual([
      'Dashboard',
      'Products',
      'Warehouses',
      'Inventory',
      'Orders',
    ]);
  });

  it('shows Notifications to users who may read them', () => {
    const labels = visibleNavItems([...STAFF, 'notifications:read']).map(
      (item) => item.label,
    );

    expect(labels).toContain('Notifications');
  });

  it('knows which permission a URL needs, including nested pages', () => {
    expect(requiredPermission('/orders')).toBe('orders:read');
    expect(requiredPermission('/orders/123')).toBe('orders:read');
    expect(requiredPermission('/notifications')).toBe('notifications:read');
    expect(requiredPermission('/dashboard')).toBeUndefined();
  });
});
