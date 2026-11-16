'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/api';
import type { Permission } from '@/lib/api/types';
import { can, toSessionUser, type SessionUser } from './session';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'unauthenticated'; user: null };

interface AuthContextValue {
  status: AuthState['status'];
  user: SessionUser | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** True if the signed-in user holds every listed permission. */
  can(...permissions: Permission[]): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SIGNED_OUT: AuthState = { status: 'unauthenticated', user: null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  });

  // On page load, turn the stored refresh token back into a session.
  useEffect(() => {
    let cancelled = false;
    void api.restoreSession().then((tokens) => {
      if (cancelled) return;
      setState(
        tokens
          ? { status: 'authenticated', user: toSessionUser(tokens) }
          : SIGNED_OUT,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If a request finds the session can no longer be renewed, sign out.
  useEffect(() => {
    api.onSessionExpired(() => {
      queryClient.clear();
      setState(SIGNED_OUT);
    });
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api.login(email, password);
    setState({ status: 'authenticated', user: toSessionUser(tokens) });
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    queryClient.clear(); // never show one user's cached data to the next
    setState(SIGNED_OUT);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      login,
      logout,
      can: (...permissions) => can(state.user, ...permissions),
    }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
