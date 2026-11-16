import {
  Bell,
  Boxes,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/lib/api/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The menu entry is shown only to users holding this permission. */
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/products',
    label: 'Products',
    icon: Package,
    permission: 'products:read',
  },
  {
    href: '/warehouses',
    label: 'Warehouses',
    icon: Warehouse,
    permission: 'warehouses:read',
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: Boxes,
    permission: 'inventory:read',
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: ShoppingCart,
    permission: 'orders:read',
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: Bell,
    permission: 'notifications:read',
  },
];

/** The menu for one user: only the entries their permissions allow. */
export function visibleNavItems(permissions: readonly Permission[]): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );
}

/** The permission a path needs, so a typed-in URL is checked like a click. */
export function requiredPermission(pathname: string): Permission | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.permission;
}
