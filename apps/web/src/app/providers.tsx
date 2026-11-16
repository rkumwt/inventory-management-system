'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/auth-context';
import { isRetryable } from '@/lib/api/errors';

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser tab, created once.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Retry a flaky network or a 5xx once; never a 4xx.
            retry: (failures, error) => failures < 1 && isRetryable(error),
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
