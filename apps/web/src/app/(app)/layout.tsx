'use client';

import { ShieldAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { requiredPermission } from '@/components/navigation';
import { useAuth } from '@/features/auth/auth-context';

/**
 * Guards every page in the (app) group:
 * - not signed in  -> redirect to /login
 * - signed in but lacking the page's permission -> "no access" message
 *
 * This is a convenience for the user, not the security boundary: the API
 * rejects any request the token does not allow, whatever the UI shows.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <FullPageSpinner label="Loading your session…" />;
  }

  const permission = requiredPermission(pathname);
  const allowed = !permission || can(permission);

  return (
    <AppShell>
      {allowed ? (
        children
      ) : (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">No access</h1>
          <p className="text-sm text-muted-foreground">
            Your role does not include this page.
          </p>
        </div>
      )}
    </AppShell>
  );
}
