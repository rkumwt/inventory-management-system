'use client';

import { Boxes, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { visibleNavItems } from './navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  if (!user) return null;

  const items = visibleNavItems(user.permissions);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 px-5 font-semibold">
          <Boxes className="size-5" aria-hidden /> Inventory
        </div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-accent font-medium text-white'
                    : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white',
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          <div className="mt-3 flex items-center justify-between">
            <Badge className="bg-white/10 text-white">{user.role}</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-sidebar-muted hover:bg-sidebar-accent hover:text-white"
              onClick={() => void logout()}
            >
              <LogOut aria-hidden /> Sign out
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
