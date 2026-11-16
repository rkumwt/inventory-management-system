'use client';

import { Boxes } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageSpinner } from '@/components/full-page-spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage() {
  const { status } = useAuth();
  const router = useRouter();

  // Already signed in (or just signed in): go to the app.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status !== 'unauthenticated') {
    return <FullPageSpinner label="Loading…" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Boxes className="size-5 text-primary" aria-hidden /> Inventory
          </div>
          <CardDescription>Sign in to manage stock and orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
