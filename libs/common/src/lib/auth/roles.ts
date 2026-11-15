export enum Role {
  Admin = 'ADMIN',
  Manager = 'MANAGER',
  Staff = 'STAFF',
}

/** Fine-grained permissions. Guards check these, never roles directly. */
export enum Permission {
  UsersManage = 'users:manage',
  ProductsRead = 'products:read',
  ProductsWrite = 'products:write',
  WarehousesRead = 'warehouses:read',
  WarehousesWrite = 'warehouses:write',
  InventoryRead = 'inventory:read',
  InventoryAdjust = 'inventory:adjust',
  InventoryTransfer = 'inventory:transfer',
  OrdersRead = 'orders:read',
  OrdersCreate = 'orders:create',
  OrdersCancel = 'orders:cancel',
}

const allPermissions = Object.values(Permission);

/** Static role -> permission mapping, embedded in the access token at login. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.Admin]: allPermissions,
  [Role.Manager]: allPermissions.filter(
    (permission) => permission !== Permission.UsersManage,
  ),
  [Role.Staff]: [
    Permission.ProductsRead,
    Permission.WarehousesRead,
    Permission.InventoryRead,
    Permission.InventoryAdjust,
    Permission.OrdersRead,
    Permission.OrdersCreate,
  ],
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
